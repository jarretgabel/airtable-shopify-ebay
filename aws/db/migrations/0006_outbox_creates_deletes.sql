-- Postgres-first creates and deletes: the outbox carries the operation, and a locally created record keeps its
-- local id while remembering the id Airtable assigned once the create has been sent.
ALTER TABLE write_outbox ADD COLUMN op text NOT NULL DEFAULT 'update'
  CHECK (op IN ('create', 'update', 'delete'));

-- NULL means the Airtable id is the record_id itself (every record that came from Airtable).
ALTER TABLE records ADD COLUMN airtable_record_id text;
CREATE INDEX records_airtable_record_id_idx ON records (base_id, table_id, airtable_record_id)
  WHERE airtable_record_id IS NOT NULL;
