import { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { CircleCheck, Flag } from "lucide-react";

// Shared between share.js and distribute.js. Only rendered when the
// release has a project_id — there's no board to route feedback to for
// anonymous public uploads. The endpoint is fully anonymous either way.
export default function ReportIssueCard({ releaseId }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/public/report-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId, feedback, reporterEmail }),
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
