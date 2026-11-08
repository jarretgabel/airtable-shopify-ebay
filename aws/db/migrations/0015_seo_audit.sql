-- SEO and AI-search (AIO) audit of the public storefront: one row per crawl run, one row per page (latest result).
CREATE TABLE IF NOT EXISTS seo_audit_runs (
  id            bigserial PRIMARY KEY,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL DEFAULT 'running',
  page_count    integer NOT NULL DEFAULT 0,
  avg_seo_score numeric(5,1),
  avg_aio_score numeric(5,1),
  site_checks   jsonb NOT NULL DEFAULT '[]'::jsonb,
  error         text
);

CREATE TABLE IF NOT EXISTS seo_pages (
  url              text PRIMARY KEY,
  page_type        text NOT NULL,
  status_code      integer,
  response_ms      integer,
  title            text,
  meta_description text,
  h1               text,
  canonical        text,
  word_count       integer,
  schema_types     text[] NOT NULL DEFAULT '{}',
  seo_score        integer,
  aio_score        integer,
  issues           jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_modified    date,
  checked_at       timestamptz NOT NULL DEFAULT now(),
  run_id           bigint REFERENCES seo_audit_runs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS seo_pages_type_idx ON seo_pages (page_type);
CREATE INDEX IF NOT EXISTS seo_pages_run_idx ON seo_pages (run_id);
