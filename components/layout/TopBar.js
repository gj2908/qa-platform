import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";
import ThemeToggle from "../ThemeToggle";
import UserMenu from "./UserMenu";

export default function TopBar({ title, breadcrumbs, onOpenMobileSidebar }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="rounded-md p-1.5 text-ink-tertiary hover:bg-hover hover:text-ink-primary lg:hidden"
        >
          <Menu size={18} />
        </button>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <ChevronRight size={13} className="shrink-0 text-ink-tertiary" />}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="truncate text-ink-tertiary hover:text-ink-primary"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-ink-primary">{crumb.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
        ) : (
          <h1 className="truncate text-sm font-medium text-ink-primary">{title}</h1>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <ThemeToggle />
        <div className="h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
