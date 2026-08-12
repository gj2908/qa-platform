create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  seat_limit integer, -- null = unlimited; enforced by trg_guard_seat_limit below
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Mirrors project_collaborators' shape: email-keyed (so an admin can add
-- someone before they've signed up), closed role enum. Unlike projects'
-- strictly-singleton owner, orgs allow multiple org_admins.
create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('org_admin', 'member')),
  created_at timestamptz default now(),
  unique (org_id, email)
);

-- Nullable so ungrouped/personal projects are unaffected — purely additive.
-- set null (not cascade) on org delete: deleting an org must not delete its
-- member projects, only ungroup them.
alter table projects add column org_id uuid references organizations(id) on delete set null;
create index projects_org_id_idx on projects (org_id);

-- Mirrors project_role() exactly: security definer, bypasses org_members'
-- own RLS instead of recursing into it.
create or replace function org_role(p_org_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from org_members
  where org_id = p_org_id
    and email = (auth.jwt() ->> 'email')
  limit 1;
$$;

-- Rewritten (not appended) so every existing RLS policy that already calls
-- project_role() automatically grants an org_admin full owner-equivalent
-- access to every project under their org, even without a direct
-- project_collaborators row — no per-policy edits needed anywhere else.
create or replace function project_role(p_project_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role from project_collaborators
     where project_id = p_project_id and email = (auth.jwt() ->> 'email')
     limit 1),
    (select 'owner' from projects p
     join org_members om on om.org_id = p.org_id and om.role = 'org_admin'
     where p.id = p_project_id and om.email = (auth.jwt() ->> 'email')
     limit 1)
  );
$$;

-- Auto-assign the creator as org_admin, mirroring assign_project_owner().
create or replace function assign_org_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_email text;
begin
  select email into creator_email from auth.users where id = new.created_by;
  if creator_email is not null then
    insert into org_members (org_id, email, role)
    values (new.id, creator_email, 'org_admin')
    on conflict (org_id, email) do update set role = 'org_admin';
  end if;
  return new;
end;
$$;

create trigger trg_assign_org_admin
  after insert on organizations
  for each row execute function assign_org_admin();

-- Blocks removing/demoting the last org_admin, so an org can never become
-- unmanageable — mirrors transfer_project_ownership()'s invariant guard.
create or replace function guard_last_org_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'DELETE' and old.role = 'org_admin')
     or (TG_OP = 'UPDATE' and old.role = 'org_admin' and new.role <> 'org_admin') then
    if (select count(*) from org_members where org_id = old.org_id and role = 'org_admin') <= 1 then
      raise exception 'An organization must have at least one org_admin';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_guard_last_org_admin
  before update or delete on org_members
  for each row execute function guard_last_org_admin();

-- Seat management: a "seat" is one org_members row regardless of role.
-- seat_limit is a manually set integer (null = unlimited), enforced at the
-- DB layer to match the codebase's existing preference for DB-enforced
-- invariants over app-only validation. No billing/metering — seat_limit is
-- edited only by org_admins (org settings UI) or admin/ (platform override).
create or replace function guard_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  limit_val integer;
begin
  select seat_limit into limit_val from organizations where id = new.org_id;
  if limit_val is not null then
    select count(*) into current_count from org_members where org_id = new.org_id;
    if current_count >= limit_val then
      raise exception 'Organization seat limit (%) reached', limit_val;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_seat_limit
  before insert on org_members
  for each row execute function guard_seat_limit();

alter table organizations enable row level security;
alter table org_members enable row level security;

create policy "members read orgs" on organizations
  for select using (org_role(id) is not null);
create policy "org_admin update orgs" on organizations
  for update using (org_role(id) = 'org_admin') with check (org_role(id) = 'org_admin');
create policy "authenticated create orgs" on organizations
  for insert with check (auth.role() = 'authenticated');
-- No delete policy for regular users — org deletion isn't exposed in
-- main/'s UI; admin/'s service-role client can do it if ever needed.

create policy "members read org members" on org_members
  for select using (org_role(org_id) is not null);
create policy "org_admin manages org members" on org_members
  for all using (org_role(org_id) = 'org_admin')
  with check (org_role(org_id) = 'org_admin');
