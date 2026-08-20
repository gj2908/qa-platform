import { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { CircleCheck, Flag, Paperclip, X } from "lucide-react";

// Downscales + re-encodes to JPEG client-side before upload — keeps
// screenshots small against Supabase free tier's 1GB total storage cap,
// since a raw phone-camera-resolution PNG could otherwise be several MB
// per report.
async function compressScreenshot(file) {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
}

// Shared between share.js and distribute.js. Only rendered when the
// release has a project_id — there's no board to route feedback to for
// anonymous public uploads. The endpoint is fully anonymous either way.
export default function ReportIssueCard({ releaseId }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [screenshot, setScreenshot] = useState(null); // File
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSubmitting(true);
    setError("");

    let screenshotPath = null;
    if (screenshot) {
      try {
        const compressed = await compressScreenshot(screenshot);
        const signRes = await fetch("/api/public/sign-feedback-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ releaseId }),
        });
        if (signRes.ok) {
          const signData = await signRes.json();
          const putRes = await fetch(signData.uploadUrl, { method: "PUT", body: compressed });
          if (putRes.ok) screenshotPath = signData.filePath;
        }
      } catch (e) {
        // Screenshot upload is best-effort — the text report still goes
        // through even if the browser can't compress/upload the image.
      }
    }

    const res = await fetch("/api/public/report-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId, feedback, reporterEmail, screenshotPath }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSent(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't send feedback. Try again.");
    }
  }

  if (sent) {
    return (
      <Card className="flex items-center gap-2.5 p-4 text-sm text-success">
        <CircleCheck size={16} strokeWidth={2.25} className="shrink-0" />
        Thanks — the team's been notified.
      </Card>
    );
  }

  if (!open) {
    return (
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-primary">Found a bug?</p>
          <p className="mt-0.5 truncate text-xs text-ink-tertiary">
            Report an issue with this build — it goes straight to the team's board.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="shrink-0">
          <Flag size={13} strokeWidth={2.25} />
          Report an issue
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm font-medium text-ink-primary">Report an issue</p>
        <FormField label="What went wrong?" htmlFor="issueFeedback" required>
          <Textarea
            id="issueFeedback"
            rows={3}
            required
            maxLength={5000}
            placeholder="Describe the bug — steps to reproduce, what you expected, what happened instead…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Your email (optional)" htmlFor="reporterEmail" hint="In case the team needs to follow up.">
          <Input
            id="reporterEmail"
            type="email"
            placeholder="you@example.com"
            value={reporterEmail}
            onChange={(e) => setReporterEmail(e.target.value)}
          />
        </FormField>

        {screenshot ? (
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-ink-secondary">
            <Paperclip size={13} strokeWidth={2.25} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{screenshot.name}</span>
            <button type="button" onClick={() => setScreenshot(null)} className="shrink-0 text-ink-tertiary hover:text-ink-primary">
              <X size={13} strokeWidth={2.25} />
            </button>
          </div>
        ) : (
          <label className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-accent hover:underline">
            <Paperclip size={13} strokeWidth={2.25} />
            Attach a screenshot
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
            />
          </label>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting} disabled={!feedback.trim()}>
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}
