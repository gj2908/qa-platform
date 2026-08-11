-- Distinguishes tester-feedback-originated tasks from manually-created
-- ones, so the board and feedback-analytics panel can filter/count them
-- separately.
alter table tasks add column if not exists source text not null default 'manual'
  check (source in ('manual', 'tester_feedback'));
