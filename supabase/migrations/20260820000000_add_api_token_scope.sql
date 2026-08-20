-- Read-only vs publish scope on CI/CD API tokens. Defaults every
-- existing token to 'publish' so current integrations keep working
-- unchanged; only newly created read-only tokens are restricted.
alter table api_tokens add column scope text not null default 'publish' check (scope in ('read', 'publish'));
