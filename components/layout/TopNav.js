import Link from "next/link";
import { House, ListChecks } from "lucide-react";
import ThemeToggle from "../ThemeToggle";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";

// The single shared header for the whole app now that there's no sidebar
// anywhere: a Home button back to the dashboard on the left, a centered
// nav (page tabs, or the top-level Dashboard/Settings links) in the
// middle, and theme/account on the right. Three equal-width flex sections
// keep the center nav visually centered regardless of how wide the left
// or right content is.
export default function TopNav({ crumb, center }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <Link
          href="/dashboard"
          title="Home"
          aria-label="Home"
          className="flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
        >
          <House size={17} strokeWidth={2} />
        </Link>
        {crumb && (
          <>
            <span className="text-ink-disabled">/</span>
            <span className="truncate text-sm font-medium text-ink-primary">{crumb}</span>
          </>
        )}
      </div>

      {center && (
        <nav className="no-scrollbar flex flex-1 items-center justify-center gap-1 overflow-x-auto">
          {center}
        </nav>
      )}

      <div className="flex flex-1 shrink-0 items-center justify-end gap-3">
        <ThemeToggle />
        <Link
          href="/my-tasks"
          title="My tasks"
          aria-label="My tasks"
          className="flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
        >
          <ListChecks size={17} strokeWidth={2} />
        </Link>
        <NotificationBell />
        <div className="h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
