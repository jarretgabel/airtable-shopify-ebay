-- Per-request usage for the in-app assistant, shared across Lambda instances for rate and daily token limits.
CREATE TABLE IF NOT EXISTS assistant_usage (
  id      bigserial PRIMARY KEY,
  user_id text NOT NULL,
  at      timestamptz NOT NULL DEFAULT now(),
  tokens  integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS assistant_usage_user_at_idx ON assistant_usage (user_id, at DESC);
