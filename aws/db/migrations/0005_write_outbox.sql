-- Postgres-first writes: a record update commits to `records` and to this outbox in one transaction,
-- and a worker replays it to Airtable in order. Postgres stays authoritative; Airtable is a lagging mirror.
CREATE TABLE write_outbox (
  id               bigserial   PRIMARY KEY,
  source           text        NOT NULL,
  base_id          text        NOT NULL,
  table_id         text        NOT NULL,
  record_id        text        NOT NULL,
  fields           jsonb       NOT NULL,
  typecast         boolean     NOT NULL DEFAULT false,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dead')),
  attempts         integer     NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);

-- The worker only ever scans unsent rows, and checks per-record ordering by record.
CREATE INDEX write_outbox_open_idx ON write_outbox (next_attempt_at) WHERE status = 'pending';
CREATE INDEX write_outbox_record_idx ON write_outbox (base_id, table_id, record_id, id) WHERE status <> 'sent';
