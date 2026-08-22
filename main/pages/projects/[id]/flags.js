import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import { createClient } from "../../../lib/supabase/client";
import ProjectShell from "../../../components/layout/ProjectShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import FormField from "../../../components/ui/FormField";
import EmptyState from "../../../components/ui/EmptyState";
import Switch from "../../../components/ui/Switch";
import { ToggleLeft, Plus, Trash2 } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", params.id).single();
  if (!project) return { notFound: true };

  const { data: role } = await supabase.rpc("project_role", { p_project_id: params.id });
  if (!role) return { notFound: true };

  const { data: flags } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  return { props: { project, role, flags: flags || [] } };
}

export default function Flags({ project, role, flags: initialFlags }) {
  const [flags, setFlags] = useState(initialFlags);
  const [creating, setCreating] = useState(false);
  const [newFlag, setNewFlag] = useState({ key: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editable = role === "owner" || role === "editor";

  async function createFlag(e) {
    e.preventDefault();
    const key = newFlag.key.trim();
    if (!key) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error: insertError } = await supabase
      .from("feature_flags")
      .insert({ project_id: project.id, key, description: newFlag.description.trim() || null, created_by: user.id })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message.includes("duplicate") ? "A flag with that key already exists." : insertError.message);
      return;
    }
    setFlags([data, ...flags]);
    setNewFlag({ key: "", description: "" });
    setCreating(false);
  }

  async function updateFlag(flag, patch) {
    const supabase = createClient();
    setFlags(flags.map((f) => (f.id === flag.id ? { ...f, ...patch } : f)));
    await supabase.from("feature_flags").update(patch).eq("id", flag.id);
  }

  async function deleteFlag(flag) {
    const supabase = createClient();
    setFlags(flags.filter((f) => f.id !== flag.id));
    await supabase.from("feature_flags").delete().eq("id", flag.id);
  }

  return (
    <ProjectShell project={project} active="flags" role={role}>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ToggleLeft size={18} className="text-ink-secondary" strokeWidth={2} />
            <h1 className="text-xl font-semibold text-ink-primary">Feature flags</h1>
          </div>
          {editable && !creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={13} strokeWidth={2.25} />
              New flag
            </Button>
          )}
        </div>
        <p className="-mt-2 text-sm text-ink-tertiary">
          Queried by your app at runtime via <code className="rounded bg-subtle px-1 py-0.5 text-xs">GET /api/v1/feature-flags</code>, same
          Bearer token as the update-check API. Rollout percentage uses the same device bucketing as staged release rollout.
        </p>

        {creating && (
          <Card className="p-4">
            <form onSubmit={createFlag} className="flex flex-col gap-3">
              <FormField label="Key" htmlFor="flagKey" required hint="Referenced by your app code, e.g. new_onboarding_flow.">
                <Input id="flagKey" required autoFocus value={newFlag.key} onChange={(e) => setNewFlag({ ...newFlag, key: e.target.value })} />
              </FormField>
              <FormField label="Description" htmlFor="flagDescription">
                <Input id="flagDescription" value={newFlag.description} onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })} />
              </FormField>
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={saving} disabled={!newFlag.key.trim()}>
                  Create
                </Button>
              </div>
            </form>
          </Card>
        )}

        {flags.length === 0 && !creating ? (
          <EmptyState icon={ToggleLeft} title="No feature flags yet" description="Gate a feature behind a flag your app checks at launch." />
        ) : (
          <div className="flex flex-col gap-2">
            {flags.map((f) => (
              <Card key={f.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-ink-primary">{f.key}</p>
                    {f.description && <p className="mt-0.5 truncate text-xs text-ink-tertiary">{f.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={f.enabled}
                      disabled={!editable}
                      onChange={(next) => updateFlag(f, { enabled: next })}
                    />
                    {editable && (
                      <button onClick={() => deleteFlag(f)} className="rounded p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger">
                        <Trash2 size={13} strokeWidth={2.25} />
                      </button>
                    )}
                  </div>
                </div>
                {f.enabled && (
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <span className="shrink-0 text-xs text-ink-tertiary">Rollout</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={f.rollout_percent}
                      disabled={!editable}
                      onChange={(e) => updateFlag(f, { rollout_percent: parseInt(e.target.value, 10) })}
                      className="flex-1 accent-accent"
                    />
                    <span className="w-10 shrink-0 text-right text-xs font-medium text-ink-secondary">{f.rollout_percent}%</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProjectShell>
  );
}
