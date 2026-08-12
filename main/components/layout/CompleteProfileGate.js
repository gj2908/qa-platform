import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser } from "../../lib/useCurrentUser";
import FormField from "../ui/FormField";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { User } from "lucide-react";

// Accounts that existed before the "name" feature shipped were backfilled
// with no full_name. Rather than silently showing their email everywhere,
// this blocks the app (no close/cancel/backdrop-dismiss) until they add
// one — new sign-ups already require a name, so they never see this.
export default function CompleteProfileGate() {
  const user = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const needsName = !!user && !user.user_metadata?.full_name && !done;
  if (!needsName) return null;

  async function save(e) {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
    if (authError) {
      setSaving(false);
      setError(authError.message);
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: trimmed })
      .eq("id", user.id);
    setSaving(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-8 sm:items-center sm:pt-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="absolute inset-0 bg-neutral-950/50"
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
            <User size={14} strokeWidth={2.25} />
          </span>
          <h2 className="text-sm font-semibold text-ink-primary">Add your name to continue</h2>
        </div>

        <form onSubmit={save} className="flex flex-col gap-4 px-5 py-5">
          <p className="text-sm text-ink-tertiary">
            Collaborators will see this instead of your email address.
          </p>
          <FormField label="Full name" htmlFor="gateFullName" required error={error}>
            <Input
              id="gateFullName"
              required
              placeholder="Jane Cooper"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={!!error}
              autoFocus
            />
          </FormField>
          <Button type="submit" loading={saving} disabled={!fullName.trim()}>
            Continue
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
