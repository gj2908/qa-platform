import { useEffect, useState } from "react";
import { createClient } from "./supabase/client";

export function useCurrentUserEmail() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
  }, []);

  return email;
}
