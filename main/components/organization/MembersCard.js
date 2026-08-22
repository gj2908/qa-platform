import Card from "../ui/Card";
import Button from "../ui/Button";
import Textarea from "../ui/Textarea";
import Select from "../ui/Select";
import FormField from "../ui/FormField";
import Badge from "../ui/Badge";
import Avatar from "../ui/Avatar";
import { UserPlus, UserMinus, Trash2, Users, CircleAlert } from "lucide-react";

const ROLE_META = {
  org_admin: { label: "Admin", tone: "accent" },
  member: { label: "Member", tone: "neutral" },
};

// The roster. Seat usage (count + bar) is visible to everyone — it's
// informational, not a management action — but the low-seat warning and
// every add/remove/offboard control is admin-only, and a member gets the
// plain read-only list with none of that DOM present at all.
export default function MembersCard({
  org,
  isAdmin,
  members,
  email,
  setEmail,
  role,
  setRole,
  adding,
  onAddMember,
  fileInputRef,
  onCsvFile,
  csvFileName,
  csvRows,
  csvError,
  csvInviting,
  onInviteFromCsv,
  onRequestOffboard,
  onRequestRemove,
}) {
  const seatsUsed = members.length;
  const seatLimit = org.seat_limit;
  const seatPct = seatLimit ? Math.min(100, (seatsUsed / seatLimit) * 100) : 0;
  const seatBarTone = !seatLimit
    ? "bg-accent"
    : seatsUsed >= seatLimit
      ? "bg-danger"
      : seatLimit - seatsUsed <= 1
        ? "bg-warning"
        : "bg-accent";

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Users size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Members</h2>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-ink-tertiary">
          <span>
            {seatsUsed} seat{seatsUsed === 1 ? "" : "s"} used{seatLimit ? ` / ${seatLimit}` : ""}
          </span>
        </div>
        {seatLimit && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
            <div className={`h-full rounded-full ${seatBarTone}`} style={{ width: `${seatPct}%` }} />
          </div>
        )}
      </div>

      {isAdmin && seatLimit && seatLimit - seatsUsed <= 1 && (
        <p className="mt-3 flex items-center gap-1.5 rounded-md bg-warning-subtle px-3.5 py-2.5 text-sm text-warning-subtle-fg">
          <CircleAlert size={14} />
          {seatLimit - seatsUsed <= 0
            ? "No seats left — remove a member or ask your platform operator to raise the seat limit before adding another."
            : "Only 1 seat left on this organization."}
        </p>
      )}

      {isAdmin && (
        <form onSubmit={onAddMember} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <FormField label="Email (paste several to bulk-invite)">
              <Textarea
                rows={1}
                placeholder="teammate@company.com, another@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
          </div>
          <div className="w-full sm:w-40">
            <FormField label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="org_admin">Admin</option>
              </Select>
            </FormField>
          </div>
          <Button type="submit" loading={adding} disabled={!email.trim()}>
            <UserPlus size={15} strokeWidth={2.25} />
            Add
          </Button>
        </form>
      )}

      {isAdmin && (
        <div className="mt-3 flex flex-col gap-2">
          <FormField
            label="or upload a CSV (email,role per line)"
            hint="role column is optional and defaults to member; a header row is detected automatically."
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onCsvFile}
              className="block w-full cursor-pointer text-sm text-ink-secondary file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-primary hover:file:bg-hover"
            />
          </FormField>

          {csvError && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <CircleAlert size={12} strokeWidth={2.5} />
              {csvError}
            </p>
          )}

          {csvRows.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium text-ink-secondary">
                {csvFileName ? `${csvFileName} — ` : ""}
                {csvRows.length} row{csvRows.length === 1 ? "" : "s"} parsed
                {csvRows.some((r) => !r.valid)
                  ? `, ${csvRows.filter((r) => !r.valid).length} invalid (will be skipped)`
                  : ""}
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {csvRows.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className={`truncate ${r.valid ? "text-ink-primary" : "text-danger"}`}>
                      {r.email || "(empty)"}
                    </span>
                    <Badge tone={r.valid ? "neutral" : "danger"}>{r.role}</Badge>
                  </div>
                ))}
              </div>
              {csvRows.length > 10 && (
                <p className="mt-1.5 text-xs text-ink-tertiary">
                  + {csvRows.length - 10} more row{csvRows.length - 10 === 1 ? "" : "s"}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="mt-3"
                loading={csvInviting}
                disabled={csvRows.filter((r) => r.valid).length === 0}
                onClick={onInviteFromCsv}
              >
                <UserPlus size={14} strokeWidth={2.25} />
                Invite {csvRows.filter((r) => r.valid).length} member
                {csvRows.filter((r) => r.valid).length === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 divide-y divide-border border-t border-border">
        {members.map((m) => {
          const meta = ROLE_META[m.role];
          const displayName = m.full_name || m.email;
          return (
            <div key={m.email} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar avatarUrl={m.avatar_url} seed={m.email} displayName={displayName} size="team" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-primary">{displayName}</p>
                  {m.full_name && <p className="truncate text-xs text-ink-tertiary">{m.email}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                {isAdmin && (
                  <button
                    onClick={() => onRequestOffboard(m)}
                    title="Offboard — revoke access everywhere"
                    className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
                  >
                    <UserMinus size={14} strokeWidth={2.25} />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => onRequestRemove(m)}
                    title="Remove member"
                    className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
                  >
                    <Trash2 size={14} strokeWidth={2.25} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
