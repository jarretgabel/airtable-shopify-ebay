-- Step 4: workflow_images can no longer point at a record that does not exist. Records are only ever
-- soft-deleted, so RESTRICT never gets in the way of normal use; the archive job removes the images itself.
-- (The derived CRM tables key on airtable_record_id without a base id and are rebuildable, so they get no FK.)
CREATE UNIQUE INDEX records_base_record_uidx ON records (base_id, record_id);
ALTER TABLE workflow_images
  ADD CONSTRAINT workflow_images_record_fk
  FOREIGN KEY (base_id, record_id) REFERENCES records (base_id, record_id) ON DELETE RESTRICT;

-- Step 5: finished (Shipped) listings that have not been touched for a long time move here.
-- Same row shape as records; `sku` is a plain column so an archived SKU still blocks reuse.
CREATE TABLE records_archive (
  base_id             text        NOT NULL,
  table_id            text        NOT NULL,
  record_id           text        NOT NULL,
  fields              jsonb       NOT NULL,
  airtable_created_at timestamptz,
  synced_at           timestamptz NOT NULL,
  airtable_record_id  text,
  sku                 text,
  archived_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_id, table_id, record_id)
);
CREATE INDEX records_archive_sku_idx ON records_archive (base_id, table_id, sku) WHERE sku IS NOT NULL;
