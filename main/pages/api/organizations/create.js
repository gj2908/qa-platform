import { randomUUID } from "crypto";
import { createServerSupabase } from "../../../lib/supabase/server";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const authSupabase = createServerSupabase(req, res);
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const { name } = req.body || {};
  if (!name || !name.trim()) {
    res.status(400).json({ error: "An organization name is required" });
    return;
  }

  // Generate the id client-side and insert without .select() — chaining
  // .select() onto this insert fails RLS: the "members read orgs" SELECT
  // policy (org_role(id) is not null) is checked for the RETURNING clause
  // before trg_assign_org_admin's AFTER INSERT trigger has run within the
  // same statement, so it sees no org_members row yet. A bare insert (just
  // the WITH CHECK policy, which only requires auth.role() = 'authenticated')
  // isn't affected, and knowing the id upfront means no follow-up query
  // is needed either.
  const orgId = randomUUID();
  const { error } = await authSupabase.from("organizations").insert({
    id: orgId,
    name: name.trim(),
    created_by: user.id,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ org: { id: orgId, name: name.trim() } });
}
