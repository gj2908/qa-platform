-- webhook_url: optional outgoing notification URL for a project. When
-- set, publishing a new release POSTs a Slack-incoming-webhook-
-- compatible { text: "..." } payload to it, best-effort. Null means no
-- notification is configured.
alter table projects add column if not exists webhook_url text;
