-- Tracks the request/fulfillment loop for connecting a real custom
-- domain (or a claimed *.vercel.app subdomain) to an org's pages.
-- null = the existing display-only domain field, unchanged behavior.
-- 'pending' = an org admin requested it be connected; 'connected' = a
-- platform operator (admin/) has manually added it to the Vercel
-- project and confirmed it resolves. No automatic provisioning.
alter table organizations add column domain_status text
  check (domain_status in ('pending', 'connected'));
