import { useState } from "react";
import Link from "next/link";
import { LogOut, Settings, User, Building2, ListChecks, Download } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser, useAvatarUrl } from "../../lib/UserContext";
import { usePwaInstall } from "../../lib/usePwaInstall";
import ThemeToggle from "../ThemeToggle";
import PwaInstallInstructions from "./PwaInstallInstructions";
import Avatar from "../ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../shadcn/dropdown-menu";

export default function UserMenu() {
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const user = useCurrentUser();
  const avatarUrl = useAvatarUrl();
  const email = user?.email || "";
  const fullName = user?.user_metadata?.full_name?.trim() || "";
  const displayName = fullName || email;
  const { canShowInstall, canPromptInstall, needsIOSInstructions, promptInstall } = usePwaInstall();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function handleInstallClick() {
    if (canPromptInstall) {
      await promptInstall();
    } else if (needsIOSInstructions) {
      setShowIOSInstructions(true);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="rounded-full transition-opacity hover:opacity-80" title={displayName}>
            <Avatar avatarUrl={avatarUrl} seed={email} displayName={displayName} size="md" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2.5 px-1 py-1 font-normal">
            <Avatar avatarUrl={avatarUrl} seed={email} displayName={displayName} size="md" />
            <div className="min-w-0">
              {fullName ? (
                <>
                  <p className="truncate text-sm font-medium text-ink-primary">{fullName}</p>
                  <p className="truncate text-xs font-normal text-ink-tertiary">{email}</p>
                </>
              ) : (
                <p className="truncate text-xs font-normal text-ink-tertiary">{email || "Loading…"}</p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-sm text-ink-secondary">Theme</span>
            <ThemeToggle />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="sm:hidden">
            <Link href="/my-tasks">
              <ListChecks size={14} strokeWidth={2} />
              My tasks
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <User size={14} strokeWidth={2} />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings size={14} strokeWidth={2} />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/organizations">
              <Building2 size={14} strokeWidth={2} />
              Organizations
            </Link>
          </DropdownMenuItem>
          {canShowInstall && (
            <DropdownMenuItem onSelect={handleInstallClick}>
              <Download size={14} strokeWidth={2} />
              Install app
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={signOut}>
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PwaInstallInstructions open={showIOSInstructions} onClose={() => setShowIOSInstructions(false)} />
    </>
  );
}
