import Link from "next/link";
import { useRouter } from "next/router";
import { LayoutGrid, Settings as SettingsIcon, X } from "lucide-react";
import Logo from "./Logo";
import ProjectSwitcher from "./ProjectSwitcher";

// Only ever rendered for the dashboard/account-level pages now — once
// you're inside a project, ProjectShell's top tabs take over and there's
// no sidebar at all (see components/layout/ProjectShell.js).
const NAV_ITEMS = [
  { href: "/dashboard", label: "Projects", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const router = useRouter();

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-neutral-950/40 lg:hidden"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-tertiary hover:bg-hover hover:text-ink-primary lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-3 pt-3">
          <ProjectSwitcher />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 thin-scrollbar">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = router.asPath === href || router.asPath.startsWith(href + "?");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-accent-subtle text-accent-subtle-fg"
                        : "text-ink-secondary hover:bg-hover hover:text-ink-primary"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
