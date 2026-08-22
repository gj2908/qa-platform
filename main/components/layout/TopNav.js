import { House, ListChecks, Menu } from "lucide-react";
import Link from "next/link";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "../shadcn/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "../shadcn/tooltip";

// The single shared header for the whole app now that there's no sidebar
// anywhere: a Home button back to the dashboard on the left, a centered
// nav (project page tabs, desktop-only — sm: and up) in the middle, and
// account controls on the right. A 3-column grid (side columns
// `minmax(0,1fr)`, middle `auto`) keeps the center nav visually centered
// and sized to its own content — unlike equal-thirds flexbox (three
// `flex-1` children), which forces the center into a fixed third
// regardless of how much room the tabs actually need, clipping them on
// narrower laptop widths. Below `sm:`, the center nav disappears and its
// tabs move into a slide-in Sheet instead — theme lives only in the
// profile dropdown now (UserMenu.js), not in this bar at all.
export default function TopNav({ crumb, center, orgBranding }) {
  return (
    <header className="sticky top-0 z-20 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      <div className="col-start-1 flex items-center gap-2 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              aria-label="Home"
              className="flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
            >
              <House size={17} strokeWidth={2} />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Home</TooltipContent>
        </Tooltip>
        {orgBranding && (
          <>
            <span className="text-ink-disabled">/</span>
            {orgBranding.logo_url ? (
              <span title={orgBranding.domain || orgBranding.name} className="shrink-0">
                <Logo compact logoUrl={orgBranding.logo_url} orgName={orgBranding.name} />
              </span>
            ) : (
              <span
                title={orgBranding.domain || orgBranding.name}
                className="shrink-0 truncate text-sm font-medium text-ink-secondary"
              >
                {orgBranding.name}
              </span>
            )}
          </>
        )}
        {crumb && (
          <>
            <span className="text-ink-disabled">/</span>
            <span className="truncate text-sm font-medium text-ink-primary">{crumb}</span>
          </>
        )}
      </div>

      {center && (
        <nav className="col-start-2 hidden min-w-0 items-stretch justify-center gap-1 overflow-x-auto sm:flex">
          {center}
        </nav>
      )}

      <div className="col-start-3 flex min-w-0 items-center justify-end gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/my-tasks"
              aria-label="My tasks"
              className="hidden shrink-0 items-center gap-1.5 rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary sm:flex"
            >
              <ListChecks size={17} strokeWidth={2} />
            </Link>
          </TooltipTrigger>
          <TooltipContent>My tasks</TooltipContent>
        </Tooltip>
        {center && (
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Menu"
                className="flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary sm:hidden"
              >
                <Menu size={17} strokeWidth={2} />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-1 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Navigate</SheetTitle>
              </SheetHeader>
              <div className="mt-2 flex flex-col gap-0.5">{center}</div>
            </SheetContent>
          </Sheet>
        )}
        <NotificationBell />
        <div className="h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
