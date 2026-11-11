-- Issue tracker: bugs, feature requests and questions, with who submitted, who resolved and a history of changes.
CREATE TABLE IF NOT EXISTS issues (
  id bigserial PRIMARY KEY,
  kind text NOT NULL DEFAULT 'bug' CHECK (kind IN ('bug', 'feature', 'question')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved', 'closed', 'wont_fix')),
  area text,
  page_url text,
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'assistant')),
  submitted_by_name text NOT NULL,
  submitted_by_email text NOT NULL,
  assigned_to_name text,
  assigned_to_email text,
  resolved_by_name text,
  resolved_by_email text,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issues_status_idx ON issues (status, id DESC);
CREATE INDEX IF NOT EXISTS issues_submitter_idx ON issues (submitted_by_email);
CREATE INDEX IF NOT EXISTS issues_assignee_idx ON issues (assigned_to_email);

CREATE TABLE IF NOT EXISTS issue_comments (
  id bigserial PRIMARY KEY,
  issue_id bigint NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issue_comments_issue_idx ON issue_comments (issue_id, id);

CREATE TABLE IF NOT EXISTS issue_events (
  id bigserial PRIMARY KEY,
  issue_id bigint NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  actor_name text NOT NULL,
  actor_email text NOT NULL,
  action text NOT NULL,
  from_value text,
  to_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issue_events_issue_idx ON issue_events (issue_id, id);
