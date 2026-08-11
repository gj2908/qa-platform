-- Optional two-person release approval. When projects.require_approval
-- is on, a non-owner's publish lands as 'pending_review' instead of
-- 'published' until an owner approves it (see pages/api/releases/approve.js).
alter table projects add column if not exists require_approval boolean not null default false;
alter table releases add column if not exists approved_by uuid references auth.users(id);
alter table releases add column if not exists approved_at timestamptz;

alter table releases drop constraint if exists releases_status_check;
alter table releases add constraint releases_status_check
  check (status in ('draft', 'published', 'scheduled', 'pending_review'));
