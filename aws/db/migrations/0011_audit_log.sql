-- Permanent history of every change made through the store (independent of the Airtable outbox).
CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  source     text NOT NULL,
  base_id    text NOT NULL,
  table_id   text NOT NULL,
  record_id  text NOT NULL,
  op         text NOT NULL CHECK (op IN ('create', 'update', 'delete')),
  fields     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_log_record_idx ON audit_log (base_id, table_id, record_id, at DESC);
