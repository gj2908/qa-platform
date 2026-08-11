import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, LayoutGrid } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

export default function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && projects === null) {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("id,name")
        .order("created_at", { ascending: false });
      setProjects(data || []);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2 text-left text-sm transition-colors hover:bg-hover"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-subtle text-ink-tertiary">
          <LayoutGrid size={12} strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-ink-primary">Jump to project</span>
        <ChevronsUpDown size={13} className="shrink-0 text-ink-tertiary" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-md border border-border bg-surface-raised p-1 shadow-lg">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded px-2.5 py-1.5 text-sm text-ink-secondary hover:bg-hover hover:text-ink-primary"
          >
            All projects
          </Link>
          <div className="my-1 h-px bg-border" />
          {projects === null && (
            <div className="px-2.5 py-2 text-xs text-ink-tertiary">Loading…</div>
          )}
          {projects?.length === 0 && (
            <div className="px-2.5 py-2 text-xs text-ink-tertiary">No projects yet</div>
          )}
          <div className="max-h-64 overflow-y-auto thin-scrollbar">
            {projects?.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded px-2.5 py-1.5 text-sm text-ink-secondary hover:bg-hover hover:text-ink-primary"
              >
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
