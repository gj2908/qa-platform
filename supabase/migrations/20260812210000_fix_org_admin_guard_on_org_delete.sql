-- guard_last_org_admin() was blocking org deletion itself: deleting an
-- organizations row cascades (on delete cascade) to delete its org_members
-- rows, which fires this BEFORE DELETE trigger for the org_admin being
-- cascade-removed — and since every org always has >=1 org_admin by
-- design, that delete always looked like "removing the last admin" and
-- got rejected, making organizations undeletable (confirmed live: both a
-- direct service-role delete and admin/'s delete-organization route failed
-- with this exact error). Skip the guard when the organizations row itself
-- no longer exists — that means the whole org is being deleted, not a
-- standalone member removal, so there's nothing left to protect.
create or replace function guard_last_org_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'DELETE' and old.role = 'org_admin')
     or (TG_OP = 'UPDATE' and old.role = 'org_admin' and new.role <> 'org_admin') then
    if not exists (select 1 from organizations where id = old.org_id) then
      return coalesce(new, old);
    end if;
    if (select count(*) from org_members where org_id = old.org_id and role = 'org_admin') <= 1 then
      raise exception 'An organization must have at least one org_admin';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
