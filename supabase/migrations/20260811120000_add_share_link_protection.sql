-- Optional expiry and PIN protection for a release's public share link.
-- share_pin_hash stores a sha256 hash only, never the raw PIN.
alter table releases add column if not exists share_expires_at timestamptz;
alter table releases add column if not exists share_pin_hash text;
