import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { FolderKanban, PackageCheck, ListTodo, Search } from "lucide-react";

const DEBOUNCE_MS = 200;

function buildFlatResults(results) {
  const flat = [];
  for (const p of results.projects) {
    flat.push({ key: `p-${p.id}`, icon: FolderKanban, label: p.name, sublabel: "Project", href: `/projects/${p.id}` });
  }
  for (const r of results.releases) {
    flat.push({
      key: `r-${r.id}`,
      icon: PackageCheck,
      label: r.app_name || `v${r.version}`,
      sublabel: `Release · v${r.version}${r.build_number ? ` (${r.build_number})` : ""} · ${r.platform}`,
      href: `/distribute/${r.id}`,
    });
  }
  for (const t of results.tasks) {
    flat.push({ key: `t-${t.id}`, icon: ListTodo, label: t.title, sublabel: "Task", href: `/projects/${t.project_id}/board` });
  }
  return flat;
}

// Global Cmd/Ctrl+K search — jumps to any project, release, or task the
// signed-in user can see. Keyboard-triggered only, no visible trigger
// added to TopNav so the top bar itself stays untouched.
export default function CommandPalette() {
  const router = useRouter();
  // When browsing inside an org's own pages, scope search to that org's
  // projects — someone navigating org-first is almost always looking
  // for something within it, not across every project they can see.
  const orgId = router.pathname.startsWith("/organizations/[id]") ? router.query.id : null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ projects: [], releases: [], tasks: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({ projects: [], releases: [], tasks: [] });
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults({ projects: [], releases: [], tasks: [] });
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: query.trim() });
      if (orgId) params.set("orgId", orgId);
      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.ok) {
        setResults(await res.json());
        setActiveIndex(0);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, orgId]);

  if (!open) return null;

  const flat = buildFlatResults(results);

  function go(item) {
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flat[activeIndex]) {
      e.preventDefault();
      go(flat[activeIndex]);
    }
  }

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 pt-[12vh]"
    >
      <div className="absolute inset-0 bg-neutral-950/50" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search size={15} strokeWidth={2.25} className="shrink-0 text-ink-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={orgId ? "Search this organization…" : "Search projects, releases, tasks…"}
            className="w-full bg-transparent text-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {query.trim() && flat.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-tertiary">No results.</p>
          )}
          {flat.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors ${
                  i === activeIndex ? "bg-hover" : ""
                }`}
              >
                <Icon size={15} strokeWidth={2} className="shrink-0 text-ink-tertiary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-primary">{item.label}</p>
                  <p className="truncate text-xs text-ink-tertiary">{item.sublabel}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
