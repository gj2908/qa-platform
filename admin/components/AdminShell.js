import Link from "next/link";
import { useRouter } from "next/router";
import { createClientBrowser } from "../lib/supabase";
import { LayoutDashboard, Users, FolderKanban, UploadCloud, HardDrive, LogOut, ShieldAlert } from "lucide-react";

const TABS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/uploads", label: "Uploads", icon: UploadCloud },
  { href: "/storage", label: "Storage", icon: HardDrive },
];

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
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <LogOut size={14} strokeWidth={2} />
          Sign out
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
