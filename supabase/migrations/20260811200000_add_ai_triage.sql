-- Best-effort AI classification of tester-feedback tasks. Nullable —
-- absent when the AI call fails or ANTHROPIC_API_KEY isn't configured.
alter table tasks add column if not exists ai_category text
  check (ai_category is null or ai_category in ('bug', 'feature', 'question'));
alter table tasks add column if not exists ai_severity text
  check (ai_severity is null or ai_severity in ('low', 'medium', 'high'));
