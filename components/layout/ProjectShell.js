import Link from "next/link";
import { ChevronRight, LayoutDashboard, Kanban, ClipboardList, Users } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "../ThemeToggle";
import UserMenu from "./UserMenu";

const TABS = [
  { key: "overview", path: "", label: "Overview", icon: LayoutDashboard },
  { key: "board", path: "/board", label: "Board", icon: Kanban },
  { key: "changelog", path: "/changelog", label: "Changelog", icon: ClipboardList },
  { key: "collaborators", path: "/collaborators", label: "Collaborators", icon: Users },
];

// The layout for everything inside a single project (Overview / Board /
// Changelog / Collaborators). No left sidebar here on purpose — once
// you're in a project there's nowhere else to jump to except back to the
// dashboard, so a persistent rail just eats width the board wants. Cross-
// project navigation lives on the dashboard's sidebar instead.
export default function ProjectShell({ project, active, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/dashboard" className="shrink-0">
            <Logo compact />
          </Link>
          <ChevronRight size={14} className="shrink-0 text-ink-tertiary" />
          <span className="truncate text-sm font-medium text-ink-primary">{project.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle />
          <div className="h-5 w-px bg-border" />
          <UserMenu />
        </div>
      </header>

      <div className="border-b border-border bg-surface px-4 sm:px-6">
        <nav className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const href = `/projects/${project.id}${tab.path}`;
            const isActive = active === tab.key;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-accent text-ink-primary"
                    : "border-transparent text-ink-tertiary hover:border-border-strong hover:text-ink-primary"
                }`}
              >
                <tab.icon size={14} strokeWidth={2} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
