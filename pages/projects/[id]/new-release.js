import { useState } from "react";
import { useRouter } from "next/router";
import { createServerSupabase } from "../../../lib/supabase/server";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import FormField from "../../../components/ui/FormField";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import Textarea from "../../../components/ui/Textarea";
import Button from "../../../components/ui/Button";
import {
  Apple,
  CircleAlert,
  CloudUpload,
  FileCheck,
  Globe,
  Smartphone,
  X,
} from "lucide-react";
import { formatBytes } from "../../../lib/format";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };
  return { props: { project } };
}

const PLATFORMS = [
  { key: "ios", label: "iOS", hint: ".ipa", icon: Apple },
  { key: "android", label: "Android", hint: ".apk / .aab", icon: Smartphone },
  { key: "web", label: "Web app", hint: "link", icon: Globe },
];

export default function NewRelease({ project }) {
  const router = useRouter();
  const [platform, setPlatform] = useState("ios");
  const [appName, setAppName] = useState("");
  const [version, setVersion] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | uploading | publishing
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(null);
  const [duplicateChecking, setDuplicateChecking] = useState(false);

  const submitting = phase !== "idle";

  function validate() {
    const next = {};
    if (!version.trim()) next.version = "Version is required.";
    if (platform === "ios" && !bundleId.trim()) next.bundleId = "Bundle ID is required for iOS install.";
    if (platform === "web" && !webUrl.trim()) next.webUrl = "App URL is required.";
    if (platform === "web" && !appName.trim())
      next.appName = "App name is required — there's no build file to detect it from.";
    if (platform !== "web" && !file) next.file = "Choose a build file to upload.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await publish(false);
  }

  async function publish(replace) {
    setError("");
    if (!validate()) return;

    try {
      // Before uploading anything, check whether the exact same app (same
      // specifications) was already published to this project.
      if (!replace) {
        setDuplicateChecking(true);
        const checkRes = await fetch("/api/releases/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            platform,
            version,
            buildNumber,
            bundleId,
            webUrl,
          }),
        });
        setDuplicateChecking(false);
        const checkData = await checkRes.json();
        if (checkRes.ok && checkData.duplicate) {
          setDuplicate(checkData.release);
          return;
        }
      }

      let filePath = null;

      if (platform !== "web") {
        setPhase("uploading");
        const signRes = await fetch("/api/releases/sign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, platform, filename: file.name }),
        });
        const signData = await signRes.json();
        if (!signRes.ok) throw new Error(signData.error || "Could not start upload");

        const putRes = await fetch(signData.uploadUrl, { method: "PUT", body: file });
        if (!putRes.ok) throw new Error("Upload to storage failed");

        filePath = signData.filePath;
      }

      setPhase("publishing");
      const formData = new FormData();
      formData.append("projectId", project.id);
      formData.append("platform", platform);
      formData.append("version", version);
      formData.append("buildNumber", buildNumber);
      formData.append("bundleId", bundleId);
      formData.append("appName", appName);
      formData.append("notes", notes);
      formData.append("replace", replace ? "true" : "false");
      if (platform === "web") formData.append("webUrl", webUrl);
      if (filePath) formData.append("filePath", filePath);

      const res = await fetch("/api/releases/create", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      router.push(`/distribute/${data.releaseId}`);
    } catch (err) {
      setError(err.message || "Something went wrong");
      setPhase("idle");
    }
  }

  return (
    <AppShell
      project={project}
      breadcrumbs={[
        { label: "Projects", href: "/" },
        { label: project.name },
        { label: "New release" },
      ]}
    >
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">New release</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            Publish a build for {project.name} and generate an install page.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-sm font-semibold text-ink-primary">Release details</h2>

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
              label="App name"
              htmlFor="appName"
              required={platform === "web"}
              error={errors.appName}
              hint={
                platform === "web"
                  ? "Shown as the install page title."
                  : "Optional — leave blank to detect it from the build file automatically."
              }
            >
              <Input
                id="appName"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder={platform === "web" ? "My App" : "Auto-detected from the build if left blank"}
                error={!!errors.appName}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Version" htmlFor="version" required error={errors.version}>
                <Input
                  id="version"
                  required
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.2.0"
                  error={!!errors.version}
                />
              </FormField>
              <FormField label="Build number" htmlFor="buildNumber" hint="Optional">
                <Input
                  id="buildNumber"
                  value={buildNumber}
                  onChange={(e) => setBuildNumber(e.target.value)}
                  placeholder="145"
                />
              </FormField>
            </div>

            {platform === "ios" && (
              <FormField
                label="Bundle ID"
                htmlFor="bundleId"
                required
                hint="Required to generate the iOS install manifest."
                error={errors.bundleId}
              >
                <Input
                  id="bundleId"
                  value={bundleId}
                  onChange={(e) => setBundleId(e.target.value)}
                  placeholder="com.yourcompany.app"
                  error={!!errors.bundleId}
                />
              </FormField>
            )}
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-sm font-semibold text-ink-primary">Build source</h2>

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
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors hover:bg-hover ${
                      errors.file ? "border-danger" : "border-border"
                    }`}
                  >
                    <CloudUpload size={18} className="text-ink-tertiary" strokeWidth={1.75} />
                    <span className="text-sm text-ink-secondary">
                      <span className="font-medium text-accent">Choose a file</span> or drag it here
                    </span>
                    <input
                      type="file"
                      accept={platform === "ios" ? ".ipa" : ".apk,.aab"}
                      onChange={(e) => setFile(e.target.files[0] || null)}
                      className="hidden"
                    />
                  </label>
                )}
              </FormField>
            )}

            <FormField label="Release notes" htmlFor="notes" hint="Optional — shown on the changelog and install page.">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="What changed in this release..."
              />
            </FormField>
          </Card>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert size={14} />
              {error}
            </p>
          )}

          {duplicate && (
            <Card className="flex flex-col gap-4 border-warning/40 p-5">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning-subtle text-warning-subtle-fg">
                  <CircleAlert size={16} strokeWidth={2} />
                </span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-semibold text-ink-primary">
                    This build already exists in this project
                  </h2>
                  <p className="text-sm text-ink-secondary">
                    {duplicate.appName ? `${duplicate.appName} · ` : ""}
                    {duplicate.version}
                    {duplicate.buildNumber ? ` (build ${duplicate.buildNumber})` : ""}{" "}
                    for {PLATFORMS.find((p) => p.key === platform)?.label} was uploaded on{" "}
                    {new Date(duplicate.createdAt).toLocaleDateString()}.
                  </p>
                  <p className="text-xs text-ink-tertiary">
                    Publishing it again will replace that release with this upload.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => publish(true)}>
                  Replace existing
                </Button>
                <Button type="button" variant="secondary" onClick={() => setDuplicate(null)}>
                  Keep both
                </Button>
              </div>
            </Card>
          )}

          {!duplicate && (
            <Button
              type="submit"
              loading={submitting || duplicateChecking}
              size="md"
              className="self-start px-6"
            >
              {duplicateChecking
                ? "Checking…"
                : phase === "uploading"
                  ? "Uploading build…"
                  : phase === "publishing"
                    ? "Publishing…"
                    : "Publish release"}
            </Button>
          )}
        </form>
      </div>
    </AppShell>
  );
}
