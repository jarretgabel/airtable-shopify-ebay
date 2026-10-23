-- Mirror of Airtable records. Keyed by the physical table, not the logical source,
-- because approval-combined, used-gear-workflow and inventory-directory share one table.
CREATE TABLE records (
  base_id              text        NOT NULL,
  table_id             text        NOT NULL,
  record_id            text        NOT NULL,
  fields               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  airtable_created_at  timestamptz,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  PRIMARY KEY (base_id, table_id, record_id)
);

-- Hot filter: every Listings subset (post-publish, ready-for-publishing, listings-page) filters on Workflow Status.
CREATE INDEX records_workflow_status_idx
  ON records (base_id, table_id, (fields ->> 'Workflow Status'))
  WHERE deleted_at IS NULL;

-- Users are looked up by email (auth and contact de-duplication).
CREATE INDEX records_email_idx
  ON records (base_id, table_id, lower(fields ->> 'Email'))
  WHERE deleted_at IS NULL AND fields ? 'Email';

CREATE INDEX records_synced_at_idx ON records (base_id, table_id, synced_at);
