import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser } from "../../lib/useCurrentUser";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const user = useCurrentUser();
  const email = user?.email || "";
  const fullName = user?.user_metadata?.full_name?.trim() || "";
  const displayName = fullName || email;
  const ref = useRef(null);

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

  const initial = displayName ? displayName[0].toUpperCase() : "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-subtle-fg transition-opacity hover:opacity-80"
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
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded px-2.5 py-1.5 text-sm text-ink-secondary hover:bg-hover hover:text-ink-primary"
          >
            <Settings size={14} strokeWidth={2} />
            Settings
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm text-danger hover:bg-danger-subtle"
          >
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
