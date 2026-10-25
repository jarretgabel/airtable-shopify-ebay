-- The SKU group rule looks a SKU up inside every create/update transaction; this keeps that lookup an index scan.
CREATE INDEX records_sku_idx ON records (base_id, table_id, (trim(coalesce(fields -> 'SKU' ->> 'text', fields ->> 'SKU', ''))))
  WHERE deleted_at IS NULL;
