import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { createClientBrowser } from "../lib/supabase";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  UploadCloud,
  HardDrive,
  LogOut,
  ShieldAlert,
  Activity,
  Search,
  Webhook,
  Key,
  ListChecks,
  Settings,
} from "lucide-react";

const TABS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/uploads", label: "Uploads", icon: UploadCloud },
  { href: "/storage", label: "Storage", icon: HardDrive },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/tokens", label: "Tokens", icon: Key },
  { href: "/tasks", label: "Overdue", icon: ListChecks },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setResults(await res.json());
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const hasResults =
    results && (results.users.length > 0 || results.projects.length > 0 || results.releases.length > 0);

  return (
    <div ref={boxRef} className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search users, projects, releases…"
        className="h-8 w-56 rounded-md border border-slate-300 bg-white pl-8 pr-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {!results && <p className="px-2 py-1.5 text-xs text-slate-500">Searching…</p>}
          {results && !hasResults && <p className="px-2 py-1.5 text-xs text-slate-500">No matches.</p>}
          {results?.users.length > 0 && (
            <div className="mb-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">Users</p>
              {results.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setOpen(false);
                    router.push("/users");
                  }}
                  className="block w-full truncate rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {u.email}
                </button>
              ))}
            </div>
          )}
          {results?.projects.length > 0 && (
            <div className="mb-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">Projects</p>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setOpen(false);
                    router.push("/projects");
                  }}
                  className="block w-full truncate rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {results?.releases.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">Releases</p>
              {results.releases.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(r.project_id ? "/projects" : "/uploads");
                  }}
                  className="block w-full truncate rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {r.app_name} v{r.version}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminShell({ children }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClientBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.reload();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">QA Platform Admin</span>
        </div>
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = router.pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={14} strokeWidth={2} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <GlobalSearch />
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
