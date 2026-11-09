-- Google Search Console data per site: daily totals plus the latest top queries and pages.
CREATE TABLE IF NOT EXISTS seo_gsc_daily (
  site        text NOT NULL,
  day         date NOT NULL,
  clicks      integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  position    numeric(7,2),
  PRIMARY KEY (site, day)
);

CREATE TABLE IF NOT EXISTS seo_gsc_queries (
  site        text NOT NULL,
  query       text NOT NULL,
  clicks      integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr         numeric(7,4),
  position    numeric(7,2),
  PRIMARY KEY (site, query)
);

CREATE TABLE IF NOT EXISTS seo_gsc_pages (
  site        text NOT NULL,
  url         text NOT NULL,
  clicks      integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr         numeric(7,4),
  position    numeric(7,2),
  PRIMARY KEY (site, url)
);

CREATE TABLE IF NOT EXISTS seo_gsc_syncs (
  site        text PRIMARY KEY,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  range_start date,
  range_end   date,
  error       text
);
