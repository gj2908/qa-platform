-- Display-only organization domain (e.g. "acme.com") — purely
-- descriptive branding, shown as a badge next to the org name. Not a
-- verified/ownership-proven field and not used for domain-based
-- auto-join; that's an explicitly separate, bigger feature.
alter table organizations add column domain text;
