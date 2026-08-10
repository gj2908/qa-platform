-- Adds fields for app details auto-extracted from uploaded .ipa/.apk files
-- (app display name, icon, minimum OS version, file size) so install pages
-- can show real app info instead of just the project name.
alter table releases add column if not exists app_name text;
alter table releases add column if not exists app_icon text;
alter table releases add column if not exists min_os_version text;
alter table releases add column if not exists file_size_bytes bigint;
