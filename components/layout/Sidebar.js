import Link from "next/link";
import { useRouter } from "next/router";
import { Kanban, ClipboardList, Rocket, LayoutGrid, LogOut, X } from "lucide-react";
import Logo from "./Logo";
import ProjectSwitcher from "./ProjectSwitcher";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUserEmail } from "../../lib/useCurrentUserEmail";

export default function Sidebar({ project, mobileOpen, onClose }) {
  const router = useRouter();
  const email = useCurrentUserEmail();

  const navItems = project
    ? [
        { href: `/projects/${project.id}/board`, label: "Board", icon: Kanban },
        { href: `/projects/${project.id}/changelog`, label: "Changelog", icon: ClipboardList },
        { href: `/projects/${project.id}/new-release`, label: "New release", icon: Rocket },
      ]
    : [{ href: "/", label: "Projects", icon: LayoutGrid }];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

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
          <Link href="/">
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
          <ProjectSwitcher currentProject={project} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 thin-scrollbar">
          <ul className="flex flex-col gap-0.5">
            {navItems.map(({ href, label, icon: Icon }) => {
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

        <div className="flex items-center gap-2.5 border-t border-border p-3">
          <Link
            href="/settings"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-hover"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-subtle-fg">
              {email ? email[0].toUpperCase() : "?"}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">
              {email || "Loading…"}
            </span>
          </Link>
          <button
            onClick={signOut}
            title="Sign out"
            className="shrink-0 rounded-md p-1.5 text-ink-tertiary hover:bg-danger-subtle hover:text-danger"
          >
            <LogOut size={15} strokeWidth={2} />
          </button>
        </div>
      </aside>
    </>
  );
}
