-- White-label branding, org-scoped. Flat typed columns, matching this
-- schema's existing convention (projects.webhook_url etc.) rather than a
-- JSON settings blob. v1 scope: accent color only (light mode), plain
-- logo URL (no upload flow/Storage bucket).
alter table organizations add column logo_url text;
alter table organizations add column accent_color text;
