-- device_family: extracted from iOS UIDeviceFamily (e.g. "iPhone, iPad").
-- uploader_email: set for releases created through the public, no-login
-- upload landing page — lets that uploader see their history later once
-- they sign in with the same email.
alter table releases add column if not exists device_family text;
alter table releases add column if not exists uploader_email text;
