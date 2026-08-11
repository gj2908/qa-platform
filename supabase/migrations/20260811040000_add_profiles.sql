-- Profiles: a public-facing display name for a user, so collaborators on a
-- shared project can see who "jane@company.com" actually is instead of
-- just their email. full_name is null until the user sets one (at sign-up
-- or later in Settings) — every UI site must fall back to email when null.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz default now()
);

-- ── Auto-create a profile row whenever someone signs up ─────
-- security definer + search_path pinned, matching assign_project_owner()'s
-- style. Reads full_name from the signup-time options.data payload; null
-- if the caller didn't provide one.
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

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill accounts that already existed before this migration (full_name
-- stays null for them — every UI site must fall back to email).
insert into profiles (id, email, full_name)
select id, email, raw_user_meta_data->>'full_name' from auth.users
on conflict (id) do nothing;

alter table profiles enable row level security;

create policy "authenticated read profiles" on profiles
  for select using (auth.role() = 'authenticated');
create policy "self update profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
