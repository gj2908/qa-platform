import { Rocket, Trash2, UserPlus, UserMinus, ArrowLeftRight, Webhook, Clock } from "lucide-react";

// Shared between the project Overview "Recent activity" card and the
// top-bar notification bell — one source of truth for how each
// project_activity.action value renders (icon + human-readable label).
export const ACTIVITY_META = {
  release_published: { icon: Rocket, label: "published a release" },
  release_deleted: { icon: Trash2, label: "deleted a release" },
  collaborator_added: { icon: UserPlus, label: "added a collaborator" },
  collaborator_removed: { icon: UserMinus, label: "removed a collaborator" },
  ownership_transferred: { icon: ArrowLeftRight, label: "transferred ownership" },
  webhook_updated: { icon: Webhook, label: "updated release notifications" },
};

export function activityMetaFor(action) {
  return ACTIVITY_META[action] || { icon: Clock, label: action };
}
