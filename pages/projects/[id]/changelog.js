import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  const { data: releases } = await supabase
    .from("releases")
    .select("*")
    .eq("project_id", params.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (!project) return { notFound: true };
  return { props: { project, releases: releases || [] } };
}

const PLATFORM_LABEL = { ios: "iOS", android: "Android", web: "Web" };

export default function Changelog({ project, releases }) {
  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/">← All projects</Link>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>{project.name} — Changelog</h1>
        <Link href={`/projects/${project.id}/new-release`}>New release</Link>
      </div>

      {releases.map((r) => (
        <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong>
              {PLATFORM_LABEL[r.platform]} · v{r.version}
              {r.build_number ? ` (${r.build_number})` : ""}
            </strong>
            <span style={{ fontSize: 12, color: "#999" }}>
              {new Date(r.created_at).toLocaleDateString()}
            </span>
          </div>
          {r.platform === "ios" && r.provisioning_info?.type === "Enterprise" && (
            <div
              style={{
                display: "inline-block",
                marginTop: 8,
                marginRight: 8,
                padding: "3px 10px",
                background: "#eef7ee",
                border: "1px solid #bcdcc2",
                color: "#285a2c",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              Enterprise — installs on any device
            </div>
          )}
          {r.platform === "ios" &&
            (r.provisioning_info?.type === "Development" || r.provisioning_info?.type === "Ad Hoc") && (
              <div
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  marginRight: 8,
                  padding: "3px 10px",
                  background: "#fff8e1",
                  border: "1px solid #f0dfa8",
                  color: "#7a5b00",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                {r.provisioning_info.type} — {r.provisioning_info.deviceCount} registered device
                {r.provisioning_info.deviceCount === 1 ? "" : "s"}
              </div>
            )}
          {r.platform === "ios" && !r.provisioning_info?.type && r.ota_ready === false && (
            <div
              style={{
                display: "inline-block",
                marginTop: 8,
                marginRight: 8,
                padding: "3px 10px",
                background: "#fdecec",
                border: "1px solid #f5c2c2",
                color: "#a33",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              Signing couldn&apos;t be verified for OTA
            </div>
          )}
          {r.notes && <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{r.notes}</p>}
          <Link
            href={`/distribute/${r.id}`}
            style={{
              display: "inline-block",
              marginTop: 8,
              padding: "6px 14px",
              background: "#111",
              color: "#fff",
              borderRadius: 6,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Open install page
          </Link>
        </div>
      ))}
      {releases.length === 0 && <p style={{ color: "#999" }}>No releases yet.</p>}
    </div>
  );
}
