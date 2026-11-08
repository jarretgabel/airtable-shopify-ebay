-- PageSpeed samples, AI-citation spot checks, assistant feedback and token detail for the usage view.
CREATE TABLE IF NOT EXISTS seo_pagespeed (
  url            text NOT NULL,
  strategy       text NOT NULL DEFAULT 'mobile',
  performance    integer,
  accessibility  integer,
  best_practices integer,
  seo            integer,
  lcp_ms         integer,
  fcp_ms         integer,
  tbt_ms         integer,
  cls            numeric(6,3),
  error          text,
  checked_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (url, strategy)
);

CREATE TABLE IF NOT EXISTS seo_citation_runs (
  id             bigserial PRIMARY KEY,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  status         text NOT NULL DEFAULT 'running',
  question_count integer NOT NULL DEFAULT 0,
  mentioned_count integer NOT NULL DEFAULT 0,
  cited_count    integer NOT NULL DEFAULT 0,
  error          text
);

CREATE TABLE IF NOT EXISTS seo_citation_checks (
  id         bigserial PRIMARY KEY,
  run_id     bigint NOT NULL REFERENCES seo_citation_runs(id) ON DELETE CASCADE,
  question   text NOT NULL,
  mentioned  boolean NOT NULL DEFAULT false,
  cited      boolean NOT NULL DEFAULT false,
  sources    jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer     text,
  error      text
);
CREATE INDEX IF NOT EXISTS seo_citation_checks_run_idx ON seo_citation_checks (run_id);

CREATE TABLE IF NOT EXISTS assistant_feedback (
  id        bigserial PRIMARY KEY,
  user_id   text NOT NULL,
  role      text,
  rating    text NOT NULL CHECK (rating IN ('up', 'down')),
  question  text,
  answer    text,
  comment   text,
  tools     jsonb NOT NULL DEFAULT '[]'::jsonb,
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_feedback_at_idx ON assistant_feedback (at DESC);

ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS input_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS output_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS role text;
