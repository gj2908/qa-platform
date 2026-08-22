import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Logo from "../components/layout/Logo";
import ThemeToggle from "../components/ThemeToggle";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";
import {
  Apple,
  Bell,
  Bug,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  CloudUpload,
  FileCheck,
  Globe,
  Kanban,
  Rocket,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { formatBytes } from "../lib/format";

const PLATFORMS = [
  { key: "ios", label: "iOS", hint: ".ipa", icon: Apple },
  { key: "android", label: "Android", hint: ".apk / .aab", icon: Smartphone },
  { key: "web", label: "Web app", hint: "link", icon: Globe },
];

const TRUST_POINTS = [
  "No account required to try it",
  "Instant, shareable install link",
  "iOS, Android, and Web in one place",
];

const FEATURES = [
  {
    icon: Rocket,
    title: "Distribute builds instantly",
    description:
      "Drop an .ipa, .apk/.aab, or a web link — testers get a shareable install page with zero setup.",
  },
  {
    icon: Kanban,
    title: "Track work on a board",
    description:
      "A kanban board for every project, backlog through done, with due dates, priority, and team assignment.",
  },
  {
    icon: Bug,
    title: "Catch issues before release",
    description:
      "Crash reports grouped automatically, plus structured test cases, so nothing ships untested.",
  },
];

const TEAM_FEATURES = [
  {
    icon: Users,
    title: "Role-based access",
    description: "Owner, editor, commenter, viewer — Google-Drive-style permissions on every project.",
  },
  {
    icon: ClipboardList,
    title: "Team task assignment",
    description: "Assign work to one teammate, or to the whole project team at once.",
  },
  {
    icon: Bell,
    title: "Shared activity & notifications",
    description: "One activity log per project, with a notification bell that keeps everyone in sync.",
  },
];

export default function PublicLanding() {
  const router = useRouter();
  const [platform, setPlatform] = useState("ios");
  const [email, setEmail] = useState("");
  const [appName, setAppName] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  function validate() {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (platform === "web" && !webUrl.trim()) next.webUrl = "App URL is required.";
    if (platform !== "web" && !file) next.file = "Choose a build file to upload.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleFile(selected) {
    if (!selected) return;
    setFile(selected);
    setErrors((e) => ({ ...e, file: undefined }));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("email", email.trim());
      formData.append("platform", platform);
      formData.append("appName", appName);
      formData.append("notes", notes);
      if (platform === "web") formData.append("webUrl", webUrl);
      if (file) formData.append("file", file);

      const res = await fetch("/api/public/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      router.push(`/share/${data.releaseId}`);
    } catch (err) {
      setError(err.message || "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-hover hover:text-ink-primary"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero — headline/trust points on the left, the working upload tool
          on the right as a live "try it now" panel, not a separate page. */}
      <section className="px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-10 lg:pb-24 lg:pt-16">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="lg:pt-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-tertiary">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              QA & build distribution for shipping teams
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink-primary sm:text-5xl">
              Ship builds. Track work.
              <br />
              <span className="text-accent">Catch bugs before your users do.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-secondary">
              Vrsnify is the QA and build-distribution hub for teams shipping mobile and web apps —
              one place for releases, a kanban board, crash reports, and test cases.
            </p>
            <ul className="mt-7 flex flex-col gap-2.5">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-2.5 text-sm text-ink-secondary">
                  <CheckCircle2 size={16} className="shrink-0 text-success" strokeWidth={2} />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full">
            <Card className="p-5 shadow-lg sm:p-6">
              <div className="mb-5">
                <h2 className="text-sm font-semibold text-ink-primary">Try it now — no account needed</h2>
                <p className="mt-1 text-xs text-ink-tertiary">
                  Drop a build or paste a link, get a shareable install page instantly.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FormField label="Platform">
                  <div className="grid grid-cols-3 gap-2">
                    {PLATFORMS.map(({ key, label, hint, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPlatform(key);
                          setErrors({});
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-center transition-colors ${
                          platform === key
                            ? "border-accent bg-accent-subtle text-accent-subtle-fg"
                            : "border-border text-ink-secondary hover:bg-hover"
                        }`}
                      >
                        <Icon size={17} strokeWidth={2} />
                        <span className="text-xs font-medium">{label}</span>
                        <span className="text-[11px] text-ink-tertiary">{hint}</span>
                      </button>
                    ))}
                  </div>
                </FormField>

                <FormField
                  label="Your email"
                  htmlFor="email"
                  required
                  error={errors.email}
                  hint="We'll tie this upload to your email — sign in with it later to see your uploads."
                >
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    error={!!errors.email}
                  />
                </FormField>

                <FormField
                  label="App name"
                  htmlFor="appName"
                  hint={
                    platform === "web"
                      ? "Optional — auto-detected if left blank."
                      : "Always taken from the build itself — it's what shows on the device after install, so it can't be overridden here."
                  }
                >
                  <Input
                    id="appName"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder={platform === "web" ? "Auto-detected" : "Detected automatically from the build file"}
                    disabled={platform !== "web" && !!file}
                  />
                </FormField>

                {platform === "web" ? (
                  <FormField label="App URL" htmlFor="webUrl" required error={errors.webUrl}>
                    <Input
                      id="webUrl"
                      type="url"
                      value={webUrl}
                      onChange={(e) => setWebUrl(e.target.value)}
                      placeholder="https://app.yourcompany.com"
                      error={!!errors.webUrl}
                    />
                  </FormField>
                ) : (
                  <FormField
                    label={`Build file (${platform === "ios" ? ".ipa" : ".apk / .aab"})`}
                    required
                    error={errors.file}
                  >
                    {file ? (
                      <div className="flex items-center gap-3 rounded-md border border-border bg-subtle px-3 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-subtle text-success-subtle-fg">
                          <FileCheck size={15} strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-primary">{file.name}</p>
                          <p className="text-xs text-ink-tertiary">{formatBytes(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="shrink-0 rounded p-1 text-ink-tertiary hover:bg-hover hover:text-ink-primary"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={handleDrop}
                        className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors hover:bg-hover ${
                          dragActive ? "border-accent bg-accent-subtle" : errors.file ? "border-danger" : "border-border"
                        }`}
                      >
                        <CloudUpload size={20} className="text-ink-tertiary" strokeWidth={1.75} />
                        <span className="text-sm text-ink-secondary">
                          <span className="font-medium text-accent">Choose a file</span> or drag it here
                        </span>
                        <input
                          type="file"
                          accept={platform === "ios" ? ".ipa" : ".apk,.aab"}
                          onChange={(e) => handleFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </FormField>
                )}

                <FormField label="Notes" htmlFor="notes" hint="Optional — shown on the install page.">
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="What's in this build..."
                  />
                </FormField>

                {error && (
                  <p className="flex items-center gap-1.5 text-sm text-danger">
                    <CircleAlert size={14} />
                    {error}
                  </p>
                )}

                <Button type="submit" loading={submitting} size="md" className="w-full">
                  {submitting ? "Uploading…" : "Get install link"}
                </Button>
              </form>
            </Card>

            <p className="mt-4 text-center text-sm text-ink-tertiary lg:text-left">
              Have an account?{" "}
              <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
                Sign in
              </Link>{" "}
              to manage projects, boards, and every upload in one place.
            </p>
          </div>
        </div>
      </section>

      {/* Feature pillars — the product's real surfaces, not invented copy. */}
      <section className="border-y border-border bg-subtle/60 px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
            Everything a shipping team needs
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-ink-primary">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-tertiary">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Built for teams — the collaboration surface a corporate buyer of
          10-20 seats actually evaluates, grounded in shipped features. */}
      <section className="px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
            Built for teams, not solo devs
          </h2>
          <p className="mt-2 max-w-xl text-sm text-ink-tertiary">
            Whether it's 5 people or 20, everyone sees the same board, the same releases, and the same
            activity — with permissions that match how your team actually works.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {TEAM_FEATURES.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-subtle text-ink-secondary">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-ink-primary">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-tertiary">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <Logo />
          <div className="flex items-center gap-5 text-sm text-ink-tertiary">
            <Link href="/docs/api" className="transition-colors hover:text-ink-primary">
              API docs
            </Link>
            <Link href="/docs/permissions" className="transition-colors hover:text-ink-primary">
              Permissions
            </Link>
            <Link href="/login" className="transition-colors hover:text-ink-primary">
              Sign in
            </Link>
          </div>
          <p className="text-xs text-ink-disabled">© {new Date().getFullYear()} Vrsnify</p>
        </div>
      </footer>
    </div>
  );
}
