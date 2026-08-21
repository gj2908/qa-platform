import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone, X } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { useOrgIds } from "../../lib/useOrgIds";

// Org-authored, dismissible-per-member banner shown across every project
// under an org — distinct from admin/'s cross-tenant platform_settings
// banner. Not a blocking gate (per main/CLAUDE.md's gate convention),
// just a slim bar, so there's no "checking" loading state — it simply
// pops in via framer-motion once (if) an active, undismissed
// announcement is found.
export default function OrgAnnouncementBanner() {
  const user = useCurrentUser();
  const orgIds = useOrgIds(user?.email);
  const [announcement, setAnnouncement] = useState(null); // { id, message, orgName }

  useEffect(() => {
    if (!orgIds || orgIds.length === 0) return;
    let cancelled = false;
    const supabase = createClient();

    async function check() {
      const { data: announcements } = await supabase
        .from("org_announcements")
        .select("id, message, org_id, expires_at, created_at, organizations(name)")
        .in("org_id", orgIds)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });
      if (!announcements || announcements.length === 0) return;

      const { data: dismissals } = await supabase
        .from("org_announcement_dismissals")
        .select("announcement_id")
        .eq("email", user.email);
      const dismissedIds = new Set((dismissals || []).map((d) => d.announcement_id));

      const active = announcements.find((a) => !dismissedIds.has(a.id));
      if (active && !cancelled) {
        setAnnouncement({ id: active.id, message: active.message, orgName: active.organizations?.name || "" });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [orgIds, user?.email]);

  async function dismiss() {
    if (!announcement || !user?.email) return;
    const { id } = announcement;
    setAnnouncement(null);
    const supabase = createClient();
    await supabase.from("org_announcement_dismissals").insert({ email: user.email, announcement_id: id });
  }

  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 border-b border-border bg-accent-subtle px-4 py-2 text-sm text-accent-subtle-fg sm:px-6 lg:px-8">
            <Megaphone size={14} strokeWidth={2.25} className="shrink-0" />
            <p className="min-w-0 flex-1 truncate">
              <span className="font-medium">{announcement.orgName}:</span> {announcement.message}
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 rounded p-0.5 text-accent-subtle-fg/70 transition-colors hover:text-accent-subtle-fg"
              aria-label="Dismiss announcement"
            >
              <X size={14} strokeWidth={2.25} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
