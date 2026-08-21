import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "./supabase/client";

const UserContext = createContext({ user: null, avatarUrl: null, avatarLoaded: false });

// Single source of truth for "who's signed in" + their avatar, shared by
// every component that used to call supabase.auth.getUser() on its own
// mount (UserMenu, CompleteProfileGate, VerifyEmailGate, RequireMfaGate,
// OrgAnnouncementBanner) — collapses 5+ independent auth round trips per
// page load into 1, plus the one profiles.avatar_url fetch this adds.
// Mounted inside AppShell/ProjectShell (not _app.js), since pre-auth/
// public pages never render those and shouldn't pay for a user fetch.
export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  // Distinguishes "haven't fetched avatar_url yet" from "fetched, and
  // there genuinely isn't one" — both look like avatarUrl === null.
  // Without this, a consumer that reads avatarUrl the instant `user`
  // first resolves (see ProfileCard) can capture it mid-fetch and never
  // re-sync once the real value lands a beat later.
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setAvatarUrl(null);
      setAvatarLoaded(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setAvatarUrl(data?.avatar_url || null);
          setAvatarLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return <UserContext.Provider value={{ user, avatarUrl, avatarLoaded }}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext).user;
}

export function useAvatarUrl() {
  return useContext(UserContext).avatarUrl;
}

// Returns { avatarUrl, avatarLoaded } for consumers that need to tell
// "still loading" apart from "confirmed no avatar" — e.g. before
// initializing local form state from the context value once, on the
// assumption that a null means "no avatar" rather than "not fetched yet".
export function useAvatarState() {
  const { avatarUrl, avatarLoaded } = useContext(UserContext);
  return { avatarUrl, avatarLoaded };
}
