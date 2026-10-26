-- Generated columns over the hot JSON fields; the JSON stays the source of truth and these follow it automatically.
-- Text columns match how the app reads values (Airtable text fields can arrive as {"text": ...}).
ALTER TABLE records
  ADD COLUMN workflow_status text GENERATED ALWAYS AS (fields ->> 'Workflow Status') STORED,
  ADD COLUMN sku text GENERATED ALWAYS AS (nullif(trim(coalesce(fields -> 'SKU' ->> 'text', fields ->> 'SKU', '')), '')) STORED,
  ADD COLUMN pick_up_id text GENERATED ALWAYS AS (nullif(trim(coalesce(fields -> 'Pick Up ID' ->> 'text', fields ->> 'Pick Up ID', '')), '')) STORED,
  ADD COLUMN email text GENERATED ALWAYS AS (nullif(lower(trim(coalesce(fields ->> 'Email', ''))), '')) STORED,
  -- Only real JSON numbers are cast, so a stray text value can never fail a write.
  ADD COLUMN price numeric GENERATED ALWAYS AS (
    CASE WHEN jsonb_typeof(fields -> 'Ebay Price') = 'number' THEN (fields ->> 'Ebay Price')::numeric END
  ) STORED;

CREATE INDEX records_workflow_status_col_idx ON records (base_id, table_id, workflow_status) WHERE deleted_at IS NULL;
CREATE INDEX records_col_pick_up_id_idx ON records (base_id, table_id, pick_up_id) WHERE deleted_at IS NULL AND pick_up_id IS NOT NULL;
CREATE INDEX records_col_email_idx ON records (base_id, table_id, email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX records_col_price_idx ON records (base_id, table_id, price) WHERE deleted_at IS NULL AND price IS NOT NULL;
