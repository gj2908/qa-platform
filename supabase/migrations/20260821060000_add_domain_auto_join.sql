-- Extends handle_new_user() (unchanged trigger, same after-insert-on-
-- auth.users firing) to also auto-join a brand-new signup into any
-- organization whose domain matches their email AND has domain_status
-- = 'connected' — only a verified/manually-confirmed domain, never a
-- purely display-only one, since that's the whole reason domain_status
-- exists as a separate field from domain itself.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_domain text;
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  email_domain := split_part(new.email, '@', 2);
  insert into org_members (org_id, email, role)
  select id, new.email, 'member'
  from organizations
  where domain = email_domain and domain_status = 'connected'
  on conflict (org_id, email) do nothing;

  return new;
end;
$$;
