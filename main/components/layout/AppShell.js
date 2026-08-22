import TopNav from "./TopNav";
import CompleteProfileGate from "./CompleteProfileGate";
import VerifyEmailGate from "./VerifyEmailGate";
import RequireMfaGate from "./RequireMfaGate";
import OrgAnnouncementBanner from "./OrgAnnouncementBanner";
import CommandPalette from "../CommandPalette";
import { UserProvider } from "../../lib/UserContext";

// Layout for the dashboard/account-level pages: single top-bar, no sidebar
// — unlike ProjectShell, which now has a persistent ProjectSidebar for its
// larger tab set. This shell has no tab set of its own: Home already covers
// "back to dashboard", and Settings lives in the profile menu (see
// UserMenu) rather than duplicated as a tab.
export default function AppShell({ children }) {
  return (
    <UserProvider>
      <div className="flex min-h-screen flex-col bg-canvas">
        <TopNav />
        <OrgAnnouncementBanner />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <CompleteProfileGate />
        <VerifyEmailGate />
        <RequireMfaGate />
        <CommandPalette />
      </div>
    </UserProvider>
  );
}
