import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MailPlus } from "lucide-react";
import Button from "./Button";

// Shown before finalizing an add-collaborator/add-org-member submit
// whenever some of the entered emails have no account yet — unlike
// ConfirmDialog (styled for a destructive "Cancel truly aborts"
// action), the add itself proceeds either way here; this only decides
// whether an invite-to-signup email goes out, so both actions are
// neutral-styled and neither is "the escape hatch."
export default function InviteEmailPrompt({ open, emails = [], loading = false, onSendInvite, onSkip }) {
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (!open) setRemember(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape" && !loading) onSkip(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onSkip]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-neutral-950/50"
            onClick={() => !loading && onSkip(false)}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-sm rounded-lg border border-border bg-surface-raised p-5 shadow-lg"
          >
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
                <MailPlus size={17} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink-primary">
                  {emails.length === 1 ? "This person isn't registered yet" : `${emails.length} people aren't registered yet`}
                </h2>
                <p className="mt-1 text-sm text-ink-tertiary">
                  They'll need to create an account using exactly{" "}
                  {emails.length === 1 ? (
                    <>
                      this address: <span className="font-medium text-ink-secondary">{emails[0]}</span>
                    </>
                  ) : (
                    "these addresses"
                  )}{" "}
                  to get access.
                </p>
                {emails.length > 1 && (
                  <ul className="mt-2 max-h-24 overflow-y-auto rounded-md bg-subtle px-3 py-2 text-xs text-ink-secondary">
                    {emails.map((e) => (
                      <li key={e} className="truncate">
                        {e}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-accent"
              />
              Don't ask me again
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => onSkip(remember)} disabled={loading}>
                Just add, skip the email
              </Button>
              <Button size="sm" onClick={() => onSendInvite(remember)} loading={loading}>
                Send invite email
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
