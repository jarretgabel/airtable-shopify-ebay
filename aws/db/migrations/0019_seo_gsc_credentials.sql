-- Service-account key for Search Console. Kept in the database because the Lambda environment is at its size limit.
CREATE TABLE IF NOT EXISTS seo_gsc_credentials (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  client_email text NOT NULL,
  private_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
