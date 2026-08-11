-- Project collaboration: multiple people per project with Google-Drive-style
-- roles (owner / editor / commenter / viewer), ownership transfer, and real
-- database-level access control (previously any signed-in user could read
-- and write every project — see the old comment on the policies this file
-- replaces).

-- ── Collaborators ───────────────────────────────────────────
-- Keyed by email (not user id) so an owner can add someone before they've
-- ever signed up — matches the same email-linking pattern used for public,
-- no-login release uploads (uploader_email on releases).
create table project_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'editor', 'commenter', 'viewer')),
  created_at timestamptz default now(),
  unique (project_id, email)
);

-- At most one owner per project at any time.
create unique index one_owner_per_project on project_collaborators (project_id) where role = 'owner';

-- ── Role lookup helper ──────────────────────────────────────
-- security definer + owned by the migration role, which owns the table it
-- queries, so this bypasses project_collaborators' own RLS instead of
-- recursing into it. Standard Supabase pattern for this kind of check.
create or replace function project_role(p_project_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from project_collaborators
  where project_id = p_project_id
    and email = (auth.jwt() ->> 'email')
  limit 1;
$$;

-- ── Auto-assign the creator as owner ────────────────────────
create or replace function assign_project_owner()
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
    insert into project_collaborators (project_id, email, role)
    values (new.id, creator_email, 'owner')
    on conflict (project_id, email) do update set role = 'owner';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_project_owner on projects;
create trigger trg_assign_project_owner
  after insert on projects
  for each row execute function assign_project_owner();

-- ── Ownership transfer ──────────────────────────────────────
-- Runs both role updates in one transaction so the partial unique index
-- above is never briefly violated (or, on failure, never leaves a project
-- with zero owners) — the new owner must already be a collaborator.
create or replace function transfer_project_ownership(p_project_id uuid, p_new_owner_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := (auth.jwt() ->> 'email');
  is_owner boolean;
begin
  select exists(
    select 1 from project_collaborators
    where project_id = p_project_id and email = caller_email and role = 'owner'
  ) into is_owner;

  if not is_owner then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  if not exists (
    select 1 from project_collaborators where project_id = p_project_id and email = p_new_owner_email
  ) then
    raise exception 'That person must already be a collaborator on this project';
  end if;

  update project_collaborators set role = 'editor' where project_id = p_project_id and role = 'owner';
  update project_collaborators set role = 'owner' where project_id = p_project_id and email = p_new_owner_email;
end;
$$;

-- ── Backfill existing projects ──────────────────────────────
-- Without this, every project created before this migration would
-- disappear from view for its own creator once the new SELECT policy
-- below takes effect.
insert into project_collaborators (project_id, email, role)
select p.id, u.email, 'owner'
from projects p
join auth.users u on u.id = p.created_by
on conflict (project_id, email) do nothing;

-- ── project_collaborators RLS ───────────────────────────────
alter table project_collaborators enable row level security;

create policy "members read collaborators" on project_collaborators
  for select using (project_role(project_id) is not null);

create policy "owner manages collaborators" on project_collaborators
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

-- ── projects RLS (replaces the old "any authenticated user" policies) ──
drop policy if exists "authenticated read projects" on projects;
drop policy if exists "authenticated write projects" on projects;

create policy "members read projects" on projects
  for select using (project_role(id) is not null);

create policy "authenticated create projects" on projects
  for insert with check (auth.role() = 'authenticated');

create policy "owner update projects" on projects
  for update using (project_role(id) = 'owner') with check (true);

create policy "owner delete projects" on projects
  for delete using (project_role(id) = 'owner');

-- ── tasks RLS ────────────────────────────────────────────────
drop policy if exists "authenticated read tasks" on tasks;
drop policy if exists "authenticated write tasks" on tasks;

create policy "members read tasks" on tasks
  for select using (project_role(project_id) is not null);

-- Commenter and above can use the board (per the "Comment = Install + Board"
-- role definition); viewers are read-only.
create policy "commenter+ write tasks" on tasks
  for all using (project_role(project_id) in ('owner', 'editor', 'commenter'))
  with check (project_role(project_id) in ('owner', 'editor', 'commenter'));

-- ── releases RLS ─────────────────────────────────────────────
drop policy if exists "authenticated read releases" on releases;
drop policy if exists "authenticated write releases" on releases;

-- project_id is null for public, no-login uploads — those are governed by
-- uploader_email instead of project membership.
create policy "members read releases" on releases
  for select using (
    (project_id is not null and project_role(project_id) is not null)
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  );

-- Only editor/owner can publish or delete releases — commenters get board
-- access but not release management, matching the viewer/commenter/editor
-- split described for this feature.
create policy "editor+ write releases" on releases
  for all using (
    (project_id is not null and project_role(project_id) in ('owner', 'editor'))
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  )
  with check (
    (project_id is not null and project_role(project_id) in ('owner', 'editor'))
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  );
