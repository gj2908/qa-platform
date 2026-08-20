-- Legal hold (blocks project deletion at the DB layer, not just the UI)
-- and org-enforced MFA policy (checked client-side by
-- components/layout/RequireMfaGate.js against auth.mfa.listFactors()).

alter table projects add column legal_hold boolean not null default false;
alter table organizations add column mfa_required boolean not null default false;

-- Belt-and-suspenders like guard_seat_limit()/guard_last_org_admin() —
-- the UI already hides the delete action for a held project, but a
-- direct RLS-permitted delete (owner role) must fail here too.
create or replace function guard_legal_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.legal_hold then
    raise exception 'This project is under legal hold and cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger trg_guard_legal_hold
  before delete on projects
  for each row execute function guard_legal_hold();
