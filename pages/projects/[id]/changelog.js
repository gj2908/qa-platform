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
