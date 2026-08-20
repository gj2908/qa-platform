import { Rocket, Trash2, UserPlus, UserMinus, ArrowLeftRight, Webhook, Clock, Plus, UserCheck, Check, CalendarClock, AtSign, FolderPlus, Settings, KeyRound, KeySquare, Download, Palette, Globe, Building2, X } from "lucide-react";

// Shared between the project Overview "Recent activity" card, the
// top-bar notification bell, and the org dashboard's activity feed —
// one source of truth for how each project_activity/org_activity
// action value renders (icon + human-readable label).
export const ACTIVITY_META = {
  release_published: { icon: Rocket, label: "published a release" },
  release_deleted: { icon: Trash2, label: "deleted a release" },
  collaborator_added: { icon: UserPlus, label: "added a collaborator" },
  collaborator_removed: { icon: UserMinus, label: "removed a collaborator" },
  ownership_transferred: { icon: ArrowLeftRight, label: "transferred ownership" },
  webhook_updated: { icon: Webhook, label: "updated release notifications" },
  task_created: { icon: Plus, label: "created a task" },
  task_assigned: { icon: UserCheck, label: "assigned a task" },
  task_completed: { icon: Check, label: "completed a task" },
  task_overdue: { icon: CalendarClock, label: "has an overdue task" },
  task_mentioned: { icon: AtSign, label: "mentioned someone in a task" },
  project_created: { icon: FolderPlus, label: "created the project" },
  project_settings_updated: { icon: Settings, label: "updated project settings" },
  api_token_created: { icon: KeyRound, label: "created an API token" },
  api_token_revoked: { icon: KeySquare, label: "revoked an API token" },
  activity_exported: { icon: Download, label: "exported the activity log" },
  org_member_added: { icon: UserPlus, label: "added a member" },
  org_member_removed: { icon: UserMinus, label: "removed a member" },
  org_branding_updated: { icon: Palette, label: "updated branding" },
  org_domain_requested: { icon: Globe, label: "requested a domain connection" },
  org_project_attached: { icon: FolderPlus, label: "added a project to the org" },
  org_creation_requested: { icon: Building2, label: "requested this organization" },
  org_creation_approved: { icon: Check, label: "approved the organization" },
  org_closure_requested: { icon: X, label: "requested to close the organization" },
};

export function activityMetaFor(action) {
  return ACTIVITY_META[action] || { icon: Clock, label: action };
}
