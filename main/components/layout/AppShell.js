import TopNav from "./TopNav";
import CompleteProfileGate from "./CompleteProfileGate";
import VerifyEmailGate from "./VerifyEmailGate";
import CommandPalette from "../CommandPalette";

// Layout for the dashboard/account-level pages. No sidebar — matches
// ProjectShell's single top-bar pattern. No centered nav here: Home
// already covers "back to dashboard", and Settings lives in the profile
// menu (see UserMenu) rather than duplicated as a tab.
export default function AppShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <CompleteProfileGate />
      <VerifyEmailGate />
      <CommandPalette />
    </div>
  );
}
