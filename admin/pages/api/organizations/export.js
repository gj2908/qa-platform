import { createServiceClient } from "../../../lib/supabase";
import { requireAdmin } from "../../../lib/requireAdmin";
import { logAdminAction } from "../../../lib/logAdminAction";
import { csvRow } from "../../../lib/csv";

const BATCH_SIZE = 1000;
const ROW_CAP = 5000; // across projects + collaborators + releases + tasks combined, json mode only

const TASK_STATUSES = ["backlog", "todo", "in_progress", "review", "done"];

// Broader-than-activity compliance export, for a platform operator to
// pull a fuller picture of everything under an org — projects,
// collaborators, release metadata (no file_path/signed URLs, this is
// metadata only), and task-status tallies. Distinct from main/'s
// org-admin-facing pages/api/organizations/[id]/activity-export.js,
// which only exports project_activity and is scoped to a single org's
// own admin, not a platform operator.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { orgId } = req.query;
  if (!orgId) {
    res.status(400).json({ error: "Missing orgId" });
    return;
  }
  const format = req.query.format === "csv" ? "csv" : "json";

  const service = createServiceClient();
  const { data: org } = await service.from("organizations").select("*").eq("id", orgId).single();
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const { data: projects } = await service
    .from("projects")
    .select("id, name, created_by, created_at, require_approval, digest_enabled")
    .eq("org_id", orgId)
    .order("name");
  const projectList = projects || [];
  const projectIds = projectList.map((p) => p.id);

  // best-effort audit log — logAdminAction already swallows its own
  // errors; awaited so it isn't racing serverless function teardown
  // against the export response below.
  await logAdminAction(service, {
    adminEmail: admin.email,
    action: "org_data_exported",
    targetType: "organization",
    targetId: orgId,
    detail: format,
  });

  if (format === "json") {
    let total = projectList.length;
    let truncated = total > ROW_CAP;

    const collaborators = truncated ? [] : await fetchCapped(
      (from, to) =>
        service
          .from("project_collaborators")
          .select("project_id, email, role")
          .in("project_id", projectIds)
          .range(from, to),
      projectIds,
      total
    );
    total += collaborators.rows.length;
    truncated = truncated || collaborators.truncated;

    const releases = truncated ? { rows: [] } : await fetchCapped(
      (from, to) =>
        service
          .from("releases")
          .select("project_id, platform, version, status, file_size_bytes, created_at")
          .in("project_id", projectIds)
          .range(from, to),
      projectIds,
      total
    );
    total += releases.rows.length;
    truncated = truncated || releases.truncated;

    const tasks = truncated ? { rows: [] } : await fetchCapped(
      (from, to) => service.from("tasks").select("project_id, status").in("project_id", projectIds).range(from, to),
      projectIds,
      total
    );
    total += tasks.rows.length;
    truncated = truncated || tasks.truncated;

    const collaboratorsByProject = groupBy(collaborators.rows, "project_id");
    const releasesByProject = groupBy(releases.rows, "project_id");
    const taskCountsByProject = tallyTaskCounts(tasks.rows);

    const projectsOut = projectList.map((p) => ({
      ...p,
      collaborators: (collaboratorsByProject[p.id] || []).map(({ email, role }) => ({ email, role })),
      releases: (releasesByProject[p.id] || []).map(({ platform, version, status, file_size_bytes, created_at }) => ({
        platform,
        version,
        status,
        file_size_bytes,
        created_at,
      })),
      taskCounts: taskCountsByProject[p.id] || {},
    }));

    const body = { org, projects: projectsOut };
    if (truncated) body.truncated = true;
    res.status(200).json(body);
    return;
  }

  // format === "csv" — multiple sections in one response, each streamed
  // in batches (mirrors main/'s activity-export.js), never buffered
  // whole in memory first.
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="org-export-${orgId}.csv"`);

  res.write(`Projects\n`);
  res.write(csvRow(["Project ID", "Name", "Created By", "Created At", "Require Approval", "Digest Enabled"]));
  for (const p of projectList) {
    res.write(csvRow([p.id, p.name, p.created_by || "", p.created_at, p.require_approval, p.digest_enabled]));
  }
  res.write("\n");

  const nameById = Object.fromEntries(projectList.map((p) => [p.id, p.name]));

  res.write(`Collaborators\n`);
  res.write(csvRow(["Project", "Email", "Role"]));
  await streamInBatches(
    (from, to) =>
      service.from("project_collaborators").select("project_id, email, role").in("project_id", projectIds).range(from, to),
    projectIds,
    (row) => res.write(csvRow([nameById[row.project_id] || "", row.email, row.role]))
  );
  res.write("\n");

  res.write(`Releases\n`);
  res.write(csvRow(["Project", "Platform", "Version", "Status", "File Size (bytes)", "Created At"]));
  await streamInBatches(
    (from, to) =>
      service
        .from("releases")
        .select("project_id, platform, version, status, file_size_bytes, created_at")
        .in("project_id", projectIds)
        .range(from, to),
    projectIds,
    (row) =>
      res.write(
        csvRow([nameById[row.project_id] || "", row.platform, row.version, row.status, row.file_size_bytes ?? "", row.created_at])
      )
  );
  res.write("\n");

  res.write(`Task Counts\n`);
  res.write(csvRow(["Project", "Status", "Count"]));
  const taskRows = [];
  await streamInBatches(
    (from, to) => service.from("tasks").select("project_id, status").in("project_id", projectIds).range(from, to),
    projectIds,
    (row) => taskRows.push(row)
  );
  const taskCountsByProject = tallyTaskCounts(taskRows);
  for (const p of projectList) {
    const counts = taskCountsByProject[p.id] || {};
    for (const status of TASK_STATUSES) {
      if (counts[status]) res.write(csvRow([p.name, status, counts[status]]));
    }
  }

  res.end();
}

// Fetches every row across projectIds in BATCH_SIZE pages, honoring a
// row budget already spent by earlier sections (json mode's combined
// 5000-row cap). Returns { rows, truncated }.
async function fetchCapped(queryFactory, projectIds, alreadySpent) {
  if (projectIds.length === 0) return { rows: [], truncated: false };
  const rows = [];
  let offset = 0;
  let truncated = false;
  for (;;) {
    const spent = alreadySpent + rows.length;
    if (spent >= ROW_CAP) {
      truncated = true;
      break;
    }
    const remaining = ROW_CAP - spent;
    const limit = Math.min(BATCH_SIZE, remaining);
    const { data: batch } = await queryFactory(offset, offset + limit - 1);
    for (const r of batch || []) rows.push(r);
    if (!batch || batch.length < limit) break;
    offset += limit;
  }
  return { rows, truncated };
}

// CSV mode's equivalent of fetchCapped, but writes each row out as it
// arrives instead of accumulating — no row cap here since streaming
// already keeps memory flat (matches activity-export.js, which has no
// cap either).
async function streamInBatches(queryFactory, projectIds, onRow) {
  if (projectIds.length === 0) return;
  let offset = 0;
  for (;;) {
    const { data: batch } = await queryFactory(offset, offset + BATCH_SIZE - 1);
    for (const row of batch || []) onRow(row);
    if (!batch || batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
}

function groupBy(rows, key) {
  const out = {};
  for (const row of rows) {
    (out[row[key]] ||= []).push(row);
  }
  return out;
}

function tallyTaskCounts(taskRows) {
  const out = {};
  for (const t of taskRows) {
    const counts = (out[t.project_id] ||= {});
    counts[t.status] = (counts[t.status] || 0) + 1;
  }
  return out;
}
