import { useState } from "react";
import Link from "next/link";
import { createServerSupabase } from "../lib/supabase/server";
import { createClient } from "../lib/supabase/client";

export async function getServerSideProps({ req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return { props: { projects: projects || [] } };
}

export default function Dashboard({ projects }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createProject(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("projects").insert({ name, created_by: user.id });
    window.location.reload();
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div style={{ maxWidth: 720, margin: "60px auto", padding: "0 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Projects</h1>
        <button onClick={signOut} style={{ background: "none", border: "1px solid #ccc", borderRadius: 6, padding: "6px 12px" }}>
          Sign out
        </button>
      </div>

      <form onSubmit={createProject} style={{ display: "flex", gap: 8, margin: "20px 0" }}>
        <input
          placeholder="New project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button type="submit" disabled={creating} style={{ padding: "10px 16px", borderRadius: 6, background: "#111", color: "#fff", border: "none" }}>
          Create
        </button>
      </form>

      <div style={{ display: "grid", gap: 12 }}>
        {projects.map((p) => (
          <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 16, background: "#fff" }}>
            <h3 style={{ margin: "0 0 8px" }}>{p.name}</h3>
            <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
              <Link href={`/projects/${p.id}/board`}>Board</Link>
              <Link href={`/projects/${p.id}/changelog`}>Changelog</Link>
              <Link href={`/projects/${p.id}/new-release`}>New release</Link>
            </div>
          </div>
        ))}
        {projects.length === 0 && <p style={{ color: "#999" }}>No projects yet — create one above.</p>}
      </div>
    </div>
  );
}
