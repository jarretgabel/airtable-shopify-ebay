-- Every item has its own SKU: unique per table among live records.
CREATE UNIQUE INDEX IF NOT EXISTS records_sku_unique_idx
  ON records (base_id, table_id, sku)
  WHERE deleted_at IS NULL AND sku IS NOT NULL;
