import { useRouter } from "next/router";
import { LayoutGrid, Settings as SettingsIcon } from "lucide-react";
import TopNav from "./TopNav";
import NavTab from "./NavTab";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

// Layout for the dashboard/account-level pages. No sidebar — matches
// ProjectShell's single top-bar-with-centered-nav pattern.
export default function AppShell({ children }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav
        center={NAV_ITEMS.map((item) => (
          <NavTab
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={router.pathname === item.href}
          />
        ))}
      />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
