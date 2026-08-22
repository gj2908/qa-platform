import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import NavTab from "./NavTab";
import { Tooltip, TooltipTrigger, TooltipContent } from "../shadcn/tooltip";

const STORAGE_KEY = "qa-platform-sidebar-collapsed";

// Persistent, collapsible left nav for project pages (Overview, Board, ...,
// Settings) — replaces the horizontal tab row that used to live in TopNav.
// Desktop-only (`sm:` and up); below that, TopNav's existing Sheet-based
// drawer is still the nav surface for these same tabs. Collapse state is one
// global boolean in localStorage, same lazy-init-from-localStorage shape
// lib/theme.js uses for the theme preference — no dedicated lib module
// needed for a single flag.
export default function ProjectSidebar({ projectId, tabs, active }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col justify-between border-r border-border bg-surface transition-[width] duration-150 sm:flex ${
        collapsed ? "w-[60px]" : "w-[232px]"
      }`}
    >
      <nav className="flex flex-col gap-0.5 overflow-y-auto p-2">
        {tabs.map((tab) => {
          const link = (
            <NavTab
              href={`/projects/${projectId}${tab.path}`}
              label={tab.label}
              icon={tab.icon}
              active={active === tab.key}
              collapsed={collapsed}
            />
          );
          if (!collapsed) return <div key={tab.key}>{link}</div>;
          return (
            <Tooltip key={tab.key}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{tab.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex w-full items-center gap-2.5 rounded-md p-2 text-ink-tertiary transition-colors hover:bg-hover hover:text-ink-primary ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
          {!collapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
