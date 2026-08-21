import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "../ThemeToggle";

// logoUrl/orgName/accentColor are optional — a visitor arriving via an
// org's connected custom domain sees that org's branding (see
// pages/login.js's getServerSideProps + lib/orgBranding.js's
// getOrgByDomain); everyone else gets the default Vrsnify mark.
export default function AuthLayout({ children, logoUrl = null, orgName = null, accentColor = null }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {accentColor && <style dangerouslySetInnerHTML={{ __html: `:root{--accent:${accentColor};}` }} />}
      <div className="flex items-center justify-between px-6 py-5">
        <Link href="/">
          <Logo logoUrl={logoUrl} orgName={orgName} />
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </div>
  );
}
