import { useState } from "react";
import { createServiceClient } from "../../lib/supabase/server";
import Logo from "../../components/layout/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import FormField from "../../components/ui/FormField";
import { CircleCheck, Smartphone } from "lucide-react";

export async function getServerSideProps({ params }) {
  const supabase = createServiceClient();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", params.projectId).single();
  if (!project) return { notFound: true };
  return { props: { project } };
}

// Public, anonymous form: a tester submits their device's UDID so the
// developer can add it to the next Ad Hoc provisioning profile, instead
// of collecting UDIDs by email/Slack one at a time.
export default function RegisterDevice({ project }) {
  const [udid, setUdid] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!udid.trim()) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/public/register-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, udid, deviceName, email }),
    });
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't submit your device.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo compact />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          {done ? (
            <Card className="flex flex-col items-center gap-3 p-6 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-success-subtle text-success-subtle-fg">
                <CircleCheck size={18} strokeWidth={2} />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-ink-primary">Device submitted</h1>
                <p className="mt-1 text-sm text-ink-tertiary">
                  {project.name}'s team can now add it to the next build.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
                  <Smartphone size={17} strokeWidth={2} />
                </span>
                <div>
                  <h1 className="text-lg font-semibold text-ink-primary">Register your device</h1>
                  <p className="text-sm text-ink-tertiary">For {project.name}'s Ad Hoc distribution</p>
                </div>
              </div>

              <div className="rounded-md bg-subtle px-3.5 py-3 text-xs text-ink-secondary">
                <p className="font-medium text-ink-primary">How to find your UDID</p>
                <p className="mt-1">
                  On newer iOS: Settings → General → About → tap the Serial Number a few times to reveal
                  the Identifier (UDID). Or connect your device to a Mac and check Finder's device info
                  page.
                </p>
              </div>

              <form onSubmit={submit} className="flex flex-col gap-3">
                <FormField label="Device UDID" htmlFor="udid" required>
                  <Input
                    id="udid"
                    required
                    value={udid}
                    onChange={(e) => setUdid(e.target.value)}
                    placeholder="00008030-001A2B3C4D5E6F7G"
                  />
                </FormField>
                <FormField label="Device name" htmlFor="deviceName" hint="Optional — e.g. &quot;Jane's iPhone 15&quot;">
                  <Input id="deviceName" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
                </FormField>
                <FormField label="Your email" htmlFor="email" hint="Optional — in case the team needs to follow up">
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormField>
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" loading={submitting} disabled={!udid.trim()} className="w-full">
                  Submit
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
