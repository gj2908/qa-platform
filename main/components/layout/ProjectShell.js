import { useEffect, useState } from "react";
import { LayoutDashboard, Kanban, CalendarDays, ClipboardList, Users, Bug, FlaskConical, ToggleLeft } from "lucide-react";
import TopNav from "./TopNav";
import NavTab from "./NavTab";
import CompleteProfileGate from "./CompleteProfileGate";
import VerifyEmailGate from "./VerifyEmailGate";
import RequireMfaGate from "./RequireMfaGate";
import OrgAnnouncementBanner from "./OrgAnnouncementBanner";
import CommandPalette from "../CommandPalette";
import { addRecentlyViewed } from "../../lib/recentlyViewed";
import { createClient } from "../../lib/supabase/client";

const TABS = [
  { key: "overview", path: "", label: "Overview", icon: LayoutDashboard },
  { key: "board", path: "/board", label: "Board", icon: Kanban },
  { key: "calendar", path: "/calendar", label: "Calendar", icon: CalendarDays },
  { key: "changelog", path: "/changelog", label: "Changelog", icon: ClipboardList },
  { key: "crashes", path: "/crashes", label: "Crashes", icon: Bug },
  { key: "test-cases", path: "/test-cases", label: "Test cases", icon: FlaskConical },
  { key: "flags", path: "/flags", label: "Flags", icon: ToggleLeft },
  { key: "collaborators", path: "/collaborators", label: "Collaborators", icon: Users },
];

// The layout for everything inside a single project (Overview / Board /
// Changelog / Collaborators). No sidebar — the tabs live centered in the
// single top bar (see TopNav), so the board gets the full page width.
export default function ProjectShell({ project, active, children }) {
  const [orgBranding, setOrgBranding] = useState(null);

  useEffect(() => {
    addRecentlyViewed(project);
  }, [project.id, project.name]);

  // Ungrouped projects (the common case) skip this entirely — org_id is
  // null, no query, no change from before this existed.
  useEffect(() => {
    if (!project.org_id) {
      setOrgBranding(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("organizations")
      .select("name, logo_url, domain")
      .eq("id", project.org_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOrgBranding(data || null);
      });
    return () => {
      cancelled = true;
    };
  }, [project.org_id]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav
        crumb={project.name}
        orgBranding={orgBranding}
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
      <OrgAnnouncementBanner />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <CompleteProfileGate />
      <VerifyEmailGate />
      <RequireMfaGate />
      <CommandPalette />
    </div>
  );
}
