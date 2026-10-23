-- Replaces getTableMetadata(): field id, name, type and select choices per table.
CREATE TABLE airtable_fields (
  base_id    text        NOT NULL,
  table_id   text        NOT NULL,
  field_id   text        NOT NULL,
  name       text        NOT NULL,
  type       text        NOT NULL,
  options    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_id, table_id, field_id)
);

CREATE INDEX airtable_fields_name_idx ON airtable_fields (base_id, table_id, name);
