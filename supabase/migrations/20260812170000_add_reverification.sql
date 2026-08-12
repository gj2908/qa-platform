-- Existing users (signed up before email verification existed) get a
-- separate, one-time reverification flag, independent of Supabase's
-- native email_confirmed_at — that column is already set for them (they
-- were auto-confirmed under the old pre-verification config), so it
-- can't distinguish "genuinely verified" from "grandfathered in."
alter table profiles add column needs_reverification boolean not null default false;
alter table profiles add column reverified_at timestamptz;

-- Backfill: everyone who has a profile row as of this migration predates
-- the OTP reverification gate. New signups default to false since they
-- already go through full signup verification (link or OTP).
update profiles set needs_reverification = true;
