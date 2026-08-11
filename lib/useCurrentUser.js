import { useEffect, useState } from "react";
import { createClient } from "./supabase/client";

// Returns the full signed-in user object (id, email, user_metadata.full_name)
// from the current session — no extra DB round-trip, since full_name lives
// in the session/JWT metadata once set via signup options.data or
// auth.updateUser({ data }).
export function useCurrentUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));

    // createClient() returns a singleton browser client, so this fires for
    // every mounted useCurrentUser() instance when auth.updateUser() runs
    // anywhere (e.g. CompleteProfileGate/ProfileCard saving a name) — no
    // page reload needed to keep the top-bar menu in sync.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return user;
}
