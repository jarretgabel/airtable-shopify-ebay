-- The SEO dashboard now audits more than one website. Existing rows belong to resolutionav.
ALTER TABLE seo_audit_runs ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'resolutionav';
ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'resolutionav';
ALTER TABLE seo_citation_runs ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'resolutionav';
CREATE INDEX IF NOT EXISTS seo_pages_site_idx ON seo_pages (site);
CREATE INDEX IF NOT EXISTS seo_audit_runs_site_idx ON seo_audit_runs (site, id DESC);
