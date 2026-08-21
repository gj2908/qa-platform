// Re-exported from UserContext.js, which now backs this with a single
// shared fetch/subscription (see UserProvider) instead of each caller
// running its own supabase.auth.getUser() — kept as its own file so
// every existing `import { useCurrentUser } from "../lib/useCurrentUser"`
// call site needed zero changes.
export { useCurrentUser } from "./UserContext";
