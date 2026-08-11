-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ── Projects ────────────────────────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

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

-- ── Row Level Security ──────────────────────────────────────
-- This is an internal tool: any signed-in user can read/write everything.
-- Tighten these later (e.g. restrict by project membership) as needed.

alter table projects enable row level security;
alter table tasks enable row level security;
alter table releases enable row level security;

create policy "authenticated read projects" on projects
  for select using (auth.role() = 'authenticated');
create policy "authenticated write projects" on projects
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated read tasks" on tasks
  for select using (auth.role() = 'authenticated');
create policy "authenticated write tasks" on tasks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated read releases" on releases
  for select using (auth.role() = 'authenticated');
create policy "authenticated write releases" on releases
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── Storage bucket for build files ──────────────────────────
-- Create manually in Supabase dashboard: Storage → New bucket → "builds" → Private.
-- Access is only ever via signed URLs generated server-side (service role key),
-- never exposed directly to the browser.
