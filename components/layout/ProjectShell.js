import { LayoutDashboard, Kanban, ClipboardList, Users } from "lucide-react";
import TopNav from "./TopNav";
import NavTab from "./NavTab";

const TABS = [
  { key: "overview", path: "", label: "Overview", icon: LayoutDashboard },
  { key: "board", path: "/board", label: "Board", icon: Kanban },
  { key: "changelog", path: "/changelog", label: "Changelog", icon: ClipboardList },
  { key: "collaborators", path: "/collaborators", label: "Collaborators", icon: Users },
];

// The layout for everything inside a single project (Overview / Board /
// Changelog / Collaborators). No sidebar — the tabs live centered in the
// single top bar (see TopNav), so the board gets the full page width.
export default function ProjectShell({ project, active, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav
        crumb={project.name}
        center={TABS.map((tab) => (
          <NavTab
            key={tab.key}
            href={`/projects/${project.id}${tab.path}`}
            label={tab.label}
            icon={tab.icon}
            active={active === tab.key}
          />
        ))}
      />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
