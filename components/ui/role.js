import { Crown, Pencil, MessageSquare, Eye } from "lucide-react";

// Google-Drive-style roles: viewer (install + view only), commenter
// (+ board access), editor (+ publish/delete releases), owner (+ manage
// collaborators, transfer ownership, delete the project).
export const ROLE_META = {
  owner: { label: "Owner", icon: Crown, tone: "accent" },
  editor: { label: "Editor", icon: Pencil, tone: "success" },
  commenter: { label: "Commenter", icon: MessageSquare, tone: "warning" },
  viewer: { label: "Viewer", icon: Eye, tone: "neutral" },
};

export const ASSIGNABLE_ROLES = ["editor", "commenter", "viewer"];

export function canManageBoard(role) {
  return role === "owner" || role === "editor" || role === "commenter";
}

export function canManageReleases(role) {
  return role === "owner" || role === "editor";
}

export function isOwner(role) {
  return role === "owner";
}
