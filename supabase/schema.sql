-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ── Projects ────────────────────────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  webhook_url text, -- optional Slack-incoming-webhook-compatible URL, notified on publish
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ── Project collaborators ───────────────────────────────────
-- Keyed by email (not user id) so an owner can add someone before they've
-- ever signed up. Roles are Google-Drive-style: viewer (install + view
-- only), commenter (+ board access), editor (+ publish/delete releases),
-- owner (+ manage collaborators, transfer ownership, delete the project).
create table project_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'editor', 'commenter', 'viewer')),
  created_at timestamptz default now(),
  unique (project_id, email)
);

create unique index one_owner_per_project on project_collaborators (project_id) where role = 'owner';

-- ── Tasks (kanban board) ───────────────────────────────────
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'backlog'
    check (status in ('backlog', 'todo', 'in_progress', 'review', 'done')),
  position int default 0,
  assignee_email text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Releases (changelog + QA distribution) ─────────────────
create table releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade, -- null for public, no-login uploads
  platform text not null check (platform in ('ios', 'android', 'web')),
  version text not null,
  build_number text,
  bundle_id text,          -- required for iOS manifest generation
  notes text,               -- release notes, markdown
  file_path text,           -- storage path, for ios/android
  web_url text,             -- direct link, for web platform
  app_name text,             -- extracted from the ipa/apk (or site title), or user-entered fallback
  app_icon text,             -- base64 data URI, extracted from the ipa/apk or site favicon
  min_os_version text,       -- extracted from the ipa/apk
  file_size_bytes bigint,    -- extracted from the ipa/apk
  device_family text,        -- extracted from the ipa (e.g. "iPhone, iPad")
  uploader_email text,       -- set for releases from the public, no-login upload landing page
  status text not null default 'published'
    check (status in ('draft', 'published')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ── Profiles ─────────────────────────────────────────────────
-- A public-facing display name for a user, so collaborators on a shared
-- project can see who "jane@company.com" actually is instead of just
-- their email. full_name is null until the user sets one (at sign-up or
-- later in Settings) — every UI site must fall back to email when null.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up. Reads full_name
-- from the signup-time options.data payload; null if not provided.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Project activity log ────────────────────────────────────
-- Releases published/deleted, collaborator changes, webhook updates —
-- surfaced as a "Recent activity" timeline on the project Overview page.
create table project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_email text not null,
  action text not null,  -- e.g. 'release_published', 'collaborator_added'
  detail text,             -- human-readable one-liner, e.g. "v1.2 (34) for iOS"
  created_at timestamptz default now()
);

-- ── Role lookup helper ──────────────────────────────────────
-- security definer + owned by the migration role (which owns the tables it
-- queries) so this bypasses project_collaborators' own RLS instead of
-- recursing into it.
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

-- Auto-assign the creator as owner whenever a project is created.
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

create trigger trg_assign_project_owner
  after insert on projects
  for each row execute function assign_project_owner();

-- Transfers ownership atomically (the new owner must already be a
-- collaborator) so the "one owner per project" index is never violated and
-- a failure never leaves a project ownerless.
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

-- ── Row Level Security ──────────────────────────────────────
-- A project (and its tasks/releases) is only visible to its owner and
-- explicitly added collaborators — nobody else. Role determines write
-- access: viewer is read-only, commenter can use the board, editor can
-- also publish/delete releases, owner can also manage collaborators and
-- delete the project.

alter table projects enable row level security;
alter table tasks enable row level security;
alter table releases enable row level security;
alter table project_collaborators enable row level security;
alter table profiles enable row level security;
alter table project_activity enable row level security;

create policy "members read activity" on project_activity
  for select using (project_role(project_id) is not null);
-- No insert/update/delete policy for normal clients — rows are only ever
-- written by trusted server routes via the service-role client.

create policy "authenticated read profiles" on profiles
  for select using (auth.role() = 'authenticated');
create policy "self update profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "members read collaborators" on project_collaborators
  for select using (project_role(project_id) is not null);
create policy "owner manages collaborators" on project_collaborators
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

create policy "members read projects" on projects
  for select using (project_role(id) is not null);
create policy "authenticated create projects" on projects
  for insert with check (auth.role() = 'authenticated');
create policy "owner update projects" on projects
  for update using (project_role(id) = 'owner') with check (true);
create policy "owner delete projects" on projects
  for delete using (project_role(id) = 'owner');

create policy "members read tasks" on tasks
  for select using (project_role(project_id) is not null);
create policy "commenter+ write tasks" on tasks
  for all using (project_role(project_id) in ('owner', 'editor', 'commenter'))
  with check (project_role(project_id) in ('owner', 'editor', 'commenter'));

-- project_id is null for public, no-login uploads — those are governed by
-- uploader_email instead of project membership.
create policy "members read releases" on releases
  for select using (
    (project_id is not null and project_role(project_id) is not null)
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  );
create policy "editor+ write releases" on releases
  for all using (
    (project_id is not null and project_role(project_id) in ('owner', 'editor'))
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  )
  with check (
    (project_id is not null and project_role(project_id) in ('owner', 'editor'))
    or (project_id is null and uploader_email = (auth.jwt() ->> 'email'))
  );

-- ── Storage bucket for build files ──────────────────────────
-- Create manually in Supabase dashboard: Storage → New bucket → "builds" → Private.
-- Access is only ever via signed URLs generated server-side (service role key),
-- never exposed directly to the browser.
