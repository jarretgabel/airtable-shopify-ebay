-- Screenshots attached to issues; the files live in the media bucket under issues/<issue id>/.
CREATE TABLE IF NOT EXISTS issue_images (
  id bigserial PRIMARY KEY,
  issue_id bigint NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  uploaded_by_name text NOT NULL,
  uploaded_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issue_images_issue_idx ON issue_images (issue_id, id);
