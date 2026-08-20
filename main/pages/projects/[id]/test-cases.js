import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import { createClient } from "../../../lib/supabase/client";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Textarea from "../../../components/ui/Textarea";
import Select from "../../../components/ui/Select";
import FormField from "../../../components/ui/FormField";
import EmptyState from "../../../components/ui/EmptyState";
import { relativeTime } from "../../../lib/format";
import { FlaskConical, Plus, Trash2, ChevronDown, ChevronRight, CircleCheck, CircleX, CircleSlash } from "lucide-react";

const RUN_META = {
  pass: { label: "Pass", icon: CircleCheck, tone: "success" },
  fail: { label: "Fail", icon: CircleX, tone: "danger" },
  blocked: { label: "Blocked", icon: CircleSlash, tone: "warning" },
  not_run: { label: "Not run", icon: null, tone: "neutral" },
};

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });
  if (!role) return { notFound: true };

  const { data: testCases } = await supabase
    .from("test_cases")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  const { data: releases } = await supabase
    .from("releases")
    .select("id, app_name, version, build_number, platform")
    .eq("project_id", params.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  const testCaseIds = (testCases || []).map((t) => t.id);
  let runsByTestCase = {};
  if (testCaseIds.length > 0) {
    const { data: runs } = await supabase
      .from("test_case_runs")
      .select("*")
      .in("test_case_id", testCaseIds)
      .order("run_at", { ascending: false });
    for (const r of runs || []) {
      if (!runsByTestCase[r.test_case_id]) runsByTestCase[r.test_case_id] = [];
      runsByTestCase[r.test_case_id].push(r);
    }
  }

  return {
    props: { project, role, testCases: testCases || [], releases: releases || [], runsByTestCase },
  };
}

function RunForm({ testCase, releases, onLog, editable }) {
  const [releaseId, setReleaseId] = useState(releases[0]?.id || "");
  const [status, setStatus] = useState("pass");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!editable || releases.length === 0) return null;

  async function submit(e) {
    e.preventDefault();
    if (!releaseId) return;
    setSaving(true);
    await onLog(testCase, { releaseId, status, notes: notes.trim() || null });
    setSaving(false);
    setNotes("");
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-1.5">
      <Select value={releaseId} onChange={(e) => setReleaseId(e.target.value)} className="h-7 w-auto text-xs">
        {releases.map((r) => (
          <option key={r.id} value={r.id}>
            {r.app_name} v{r.version} ({r.platform})
          </option>
        ))}
      </Select>
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-7 w-auto text-xs">
        <option value="pass">Pass</option>
        <option value="fail">Fail</option>
        <option value="blocked">Blocked</option>
      </Select>
      <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-7 w-40 text-xs" />
      <Button type="submit" size="sm" loading={saving}>
        Log run
      </Button>
    </form>
  );
}

function TestCaseRow({ testCase, releases, runs, onDelete, onLog, editable }) {
  const [expanded, setExpanded] = useState(false);
  const latestRun = runs?.[0];
  const meta = latestRun ? RUN_META[latestRun.status] : null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          {expanded ? (
            <ChevronDown size={14} className="mt-0.5 shrink-0 text-ink-tertiary" />
          ) : (
            <ChevronRight size={14} className="mt-0.5 shrink-0 text-ink-tertiary" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-primary">{testCase.title}</p>
            {latestRun && (
              <p className="mt-0.5 text-xs text-ink-tertiary">
                Last run {relativeTime(latestRun.run_at)} — {latestRun.run_by || "someone"}
              </p>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {meta && <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>}
          {editable && (
            <button onClick={() => onDelete(testCase)} className="rounded p-1 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger">
              <Trash2 size={13} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-sm">
          {testCase.description && <p className="text-ink-secondary">{testCase.description}</p>}
          {testCase.steps && (
            <div>
              <p className="text-xs font-medium text-ink-tertiary">Steps</p>
              <p className="whitespace-pre-wrap text-ink-secondary">{testCase.steps}</p>
            </div>
          )}
          {testCase.expected_result && (
            <div>
              <p className="text-xs font-medium text-ink-tertiary">Expected result</p>
              <p className="whitespace-pre-wrap text-ink-secondary">{testCase.expected_result}</p>
            </div>
          )}
          {runs && runs.length > 1 && (
            <div>
              <p className="text-xs font-medium text-ink-tertiary">History</p>
              <div className="mt-1 flex flex-col gap-1">
                {runs.slice(0, 5).map((r) => {
                  const rMeta = RUN_META[r.status];
                  return (
                    <div key={r.id} className="flex items-center gap-2 text-xs text-ink-tertiary">
                      <Badge tone={rMeta.tone} icon={rMeta.icon}>{rMeta.label}</Badge>
                      <span>{relativeTime(r.run_at)}</span>
                      {r.notes && <span className="min-w-0 truncate">— {r.notes}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <RunForm testCase={testCase} releases={releases} onLog={onLog} editable={editable} />
        </div>
      )}
    </Card>
  );
}

export default function TestCases({ project, role, testCases: initialTestCases, releases, runsByTestCase: initialRuns }) {
  const [testCases, setTestCases] = useState(initialTestCases);
  const [runsByTestCase, setRunsByTestCase] = useState(initialRuns);
  const [creating, setCreating] = useState(false);
  const [newCase, setNewCase] = useState({ title: "", description: "", steps: "", expected_result: "" });
  const [saving, setSaving] = useState(false);
  const editable = role === "owner" || role === "editor";

  async function createTestCase(e) {
    e.preventDefault();
    if (!newCase.title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("test_cases")
      .insert({ project_id: project.id, ...newCase, created_by: user.id })
      .select()
      .single();
    setSaving(false);
    if (error || !data) return;
    setTestCases([data, ...testCases]);
    setNewCase({ title: "", description: "", steps: "", expected_result: "" });
    setCreating(false);
  }

  async function deleteTestCase(testCase) {
    const supabase = createClient();
    setTestCases(testCases.filter((t) => t.id !== testCase.id));
    await supabase.from("test_cases").delete().eq("id", testCase.id);
  }

  async function logRun(testCase, { releaseId, status, notes }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("test_case_runs")
      .insert({
        test_case_id: testCase.id,
        release_id: releaseId,
        project_id: project.id,
        status,
        notes,
        run_by: user.email,
      })
      .select()
      .single();
    if (data) {
      setRunsByTestCase((r) => ({ ...r, [testCase.id]: [data, ...(r[testCase.id] || [])] }));
    }
  }

  return (
    <ProjectShell project={project} active="test-cases">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-ink-secondary" strokeWidth={2} />
            <h1 className="text-xl font-semibold text-ink-primary">Test cases</h1>
          </div>
          {editable && !creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={13} strokeWidth={2.25} />
              New test case
            </Button>
          )}
        </div>

        {creating && (
          <Card className="p-4">
            <form onSubmit={createTestCase} className="flex flex-col gap-3">
              <FormField label="Title" htmlFor="tcTitle" required>
                <Input id="tcTitle" required autoFocus value={newCase.title} onChange={(e) => setNewCase({ ...newCase, title: e.target.value })} />
              </FormField>
              <FormField label="Description" htmlFor="tcDescription">
                <Textarea id="tcDescription" rows={2} value={newCase.description} onChange={(e) => setNewCase({ ...newCase, description: e.target.value })} />
              </FormField>
              <FormField label="Steps" htmlFor="tcSteps">
                <Textarea id="tcSteps" rows={3} value={newCase.steps} onChange={(e) => setNewCase({ ...newCase, steps: e.target.value })} />
              </FormField>
              <FormField label="Expected result" htmlFor="tcExpected">
                <Textarea id="tcExpected" rows={2} value={newCase.expected_result} onChange={(e) => setNewCase({ ...newCase, expected_result: e.target.value })} />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={saving} disabled={!newCase.title.trim()}>
                  Create
                </Button>
              </div>
            </form>
          </Card>
        )}

        {testCases.length === 0 && !creating ? (
          <EmptyState
            icon={FlaskConical}
            title="No test cases yet"
            description="Track reusable QA checklists here, then log a pass/fail against each release."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {testCases.map((tc) => (
              <TestCaseRow
                key={tc.id}
                testCase={tc}
                releases={releases}
                runs={runsByTestCase[tc.id]}
                onDelete={deleteTestCase}
                onLog={logRun}
                editable={role === "owner" || role === "editor" || role === "commenter"}
              />
            ))}
          </div>
        )}
      </div>
    </ProjectShell>
  );
}
