import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { House, ListChecks, Menu } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <Link
          href="/my-tasks"
          title="My tasks"
          aria-label="My tasks"
          className="hidden shrink-0 items-center gap-1.5 rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary sm:flex"
        >
          <ListChecks size={17} strokeWidth={2} />
        </Link>
        <div ref={menuRef} className="relative shrink-0 sm:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            title="Menu"
            aria-label="Menu"
            className="flex items-center gap-1.5 rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
          >
            <Menu size={17} strokeWidth={2} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 rounded-md border border-border bg-surface-raised p-2 shadow-lg">
              <p className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-tertiary">
                Theme
              </p>
              <ThemeToggle />
            </div>
          )}
        </div>
        <NotificationBell />
        <div className="h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
