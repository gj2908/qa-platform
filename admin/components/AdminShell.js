import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClientBrowser } from "../lib/supabase";
import ThemeToggle from "./ThemeToggle";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Building2,
  UploadCloud,
  HardDrive,
  LogOut,
  Activity,
  Search,
  Webhook,
  Key,
  ListChecks,
  Settings,
  PanelLeft,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

// The brand mark: a checkmark, no background container — same glyph as
// main/'s Logo.js, tinted with this app's own indigo primary accent
// (tailwind.config.js's `primary`) instead of main/'s blue, so the two
// are visually distinguishable while still reading as the same family.
function CheckmarkMark({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M5 12.5 L10.2 17.7 L19.5 6.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Grouped into sections so the sidebar reads as a hierarchy instead of a
// flat list of 10 items — this is what used to overflow a single-row top
// bar before the redesign.
const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Platform",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/organizations", label: "Organizations", icon: Building2 },
      { href: "/uploads", label: "Uploads", icon: UploadCloud },
      { href: "/storage", label: "Storage", icon: HardDrive },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/tokens", label: "Tokens", icon: Key },
      { href: "/tasks", label: "Overdue", icon: ListChecks },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];
const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
const SIDEBAR_COLLAPSE_KEY = "qa-admin-sidebar-collapsed";

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
        className="h-8 w-44 rounded-md border border-slate-300 bg-white pl-8 pr-2 text-sm text-slate-900 transition-all focus:w-64 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:w-56"
      />
      <AnimatePresence>
        {open && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
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
                      router.push(`/projects/${p.id}`);
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
                      router.push(r.project_id ? `/projects/${r.project_id}` : "/uploads");
                    }}
                    className="block w-full truncate rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {r.app_name} v{r.version}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserMenu({ email, onSignOut }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md p-1 pr-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
          {(email || "?")[0].toUpperCase()}
        </span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-20 mt-1 w-52 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="truncate px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400">{email}</p>
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut size={14} strokeWidth={2} />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavList({ onNavigate }) {
  const router = useRouter();
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-600">
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(router.pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className="relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors"
                >
                  {active && (
                    <motion.div
                      layoutId="admin-nav-active"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      className="absolute inset-0 rounded-md bg-primary-600"
                    />
                  )}
                  <Icon
                    size={15}
                    strokeWidth={2}
                    className={`relative z-10 ${active ? "text-white" : "text-slate-500 dark:text-slate-400"}`}
                  />
                  <span className={`relative z-10 ${active ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminShell({ children }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState(null);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    createClientBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email || null));
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  }

  async function signOut() {
    const supabase = createClientBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.reload();
  }

  const activeItem = ALL_ITEMS.find((item) => isActive(router.pathname, item.href));

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile off-canvas drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:hidden"
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <CheckmarkMark size={16} className="text-primary-600 dark:text-primary-400" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Vrsnify Admin</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={16} />
                </button>
              </div>
              <NavList onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 232 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:flex"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <CheckmarkMark size={16} className="text-primary-600 dark:text-primary-400" />
          </span>
          {!collapsed && <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Vrsnify Admin</span>}
        </div>
        {collapsed ? (
          <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-4">
            {ALL_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(router.pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                    active ? "bg-primary-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                </Link>
              );
            })}
          </nav>
        ) : (
          <NavList />
        )}
        <button
          onClick={toggleCollapsed}
          className="flex h-12 shrink-0 items-center justify-center border-t border-slate-200 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-300"
        >
          <PanelLeft size={15} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </motion.aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeItem?.label || "Admin"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <ThemeToggle />
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />
            <UserMenu email={email} onSignOut={signOut} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={router.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
