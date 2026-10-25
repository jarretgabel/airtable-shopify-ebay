-- One row per entry of a listing's `Workflow Image Metadata JSON`. The JSON text field stays the API contract;
-- the store assembles it from this table so images can move from Google Drive to S3 without frontend changes.
CREATE TABLE workflow_images (
  base_id text NOT NULL,
  record_id text NOT NULL,
  url text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('intake', 'testing', 'photos')),
  kind text NOT NULL DEFAULT 'processed' CHECK (kind IN ('original', 'processed')),
  s3_key text,
  legacy_url text,
  attachment_id text,
  filename text NOT NULL DEFAULT '',
  alt text NOT NULL DEFAULT '',
  role text,
  custom_role text,
  sort_order integer NOT NULL DEFAULT 0,
  included boolean NOT NULL DEFAULT false,
  ebay_hosted_cache jsonb,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_id, record_id, url)
);
CREATE INDEX workflow_images_record_idx ON workflow_images (base_id, record_id, sort_order);
CREATE INDEX workflow_images_s3_key_idx ON workflow_images (s3_key) WHERE s3_key IS NOT NULL;
