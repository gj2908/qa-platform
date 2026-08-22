import { forwardRef } from "react";
import Link from "next/link";

// Single vertical-list style, used identically by ProjectSidebar (desktop)
// and TopNav's mobile Sheet — there's no horizontal tab bar anywhere
// anymore, so no responsive dual-mode styling is needed here. Wrapped in
// forwardRef so ProjectSidebar can use it as a Radix Tooltip trigger
// (`asChild`) when collapsed, without Radix losing the underlying <a>'s ref.
const NavTab = forwardRef(function NavTab({ href, label, icon: Icon, active, collapsed = false, ...props }, ref) {
  return (
    <Link
      ref={ref}
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors ${
        collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
      } ${
        active
          ? "bg-accent-subtle text-accent-subtle-fg"
          : "text-ink-secondary hover:bg-hover hover:text-ink-primary"
      }`}
      {...props}
    >
      {Icon && <Icon size={16} strokeWidth={2} className="shrink-0" />}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
});

export default NavTab;
