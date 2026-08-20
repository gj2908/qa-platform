import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings, Building2, ListChecks, Download } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { getAvatarColor } from "../../lib/avatarColor";
import { usePwaInstall } from "../../lib/usePwaInstall";
import ThemeToggle from "../ThemeToggle";
import PwaInstallInstructions from "./PwaInstallInstructions";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const user = useCurrentUser();
  const email = user?.email || "";
  const fullName = user?.user_metadata?.full_name?.trim() || "";
  const displayName = fullName || email;
  const ref = useRef(null);
  const { canShowInstall, canPromptInstall, needsIOSInstructions, promptInstall } = usePwaInstall();

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function handleInstallClick() {
    setOpen(false);
    if (canPromptInstall) {
      await promptInstall();
    } else if (needsIOSInstructions) {
      setShowIOSInstructions(true);
    }
  }

  const initial = displayName ? displayName[0].toUpperCase() : "?";
  const color = getAvatarColor(email);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-opacity hover:opacity-80 ${color.bg} ${color.text}`}
        title={displayName}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-md border border-border bg-surface-raised p-1 shadow-lg">
          <div className="truncate border-b border-border px-2.5 py-2">
            {fullName ? (
              <>
                <p className="truncate text-sm font-medium text-ink-primary">{fullName}</p>
                <p className="truncate text-xs text-ink-tertiary">{email}</p>
              </>
            ) : (
              <p className="truncate text-xs text-ink-tertiary">{email || "Loading…"}</p>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-sm text-ink-secondary">Theme</span>
            <ThemeToggle />
          </div>
          <Link
            href="/my-tasks"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded px-2.5 py-1.5 text-sm text-ink-secondary hover:bg-hover hover:text-ink-primary sm:hidden"
          >
            <ListChecks size={14} strokeWidth={2} />
            My tasks
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded px-2.5 py-1.5 text-sm text-ink-secondary hover:bg-hover hover:text-ink-primary"
          >
            <Settings size={14} strokeWidth={2} />
            Settings
          </Link>
          <Link
            href="/organizations"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded px-2.5 py-1.5 text-sm text-ink-secondary hover:bg-hover hover:text-ink-primary"
          >
            <Building2 size={14} strokeWidth={2} />
            Organizations
          </Link>
          {canShowInstall && (
            <button
              onClick={handleInstallClick}
              className="mt-1 flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm text-ink-secondary hover:bg-hover hover:text-ink-primary"
            >
              <Download size={14} strokeWidth={2} />
              Install app
            </button>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm text-danger hover:bg-danger-subtle"
          >
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}
      <PwaInstallInstructions open={showIOSInstructions} onClose={() => setShowIOSInstructions(false)} />
    </div>
  );
}
