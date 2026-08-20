-- organization_requests.org_id was "on delete cascade" against
-- organizations(id). Approving a 'close' request deletes the org row,
-- which would cascade-delete the *request row itself* (it references
-- the org it's about) before the approve API's own follow-up update
-- could mark it 'approved' — silently erasing the closure's audit
-- trail from the admin queue instead of showing it as resolved.
-- Switch to "on delete set null" so the request row (and its
-- resolved_by/resolved_at/status) survives the org's deletion; the
-- admin requests page already renders a null org_id as "already gone".
alter table organization_requests
  drop constraint organization_requests_org_id_fkey,
  add constraint organization_requests_org_id_fkey
    foreign key (org_id) references organizations(id) on delete set null;
