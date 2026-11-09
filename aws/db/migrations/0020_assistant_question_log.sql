-- Question log: the text of each assistant question, the tools it used, and whether the request failed.
ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS question text;
ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS tools jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS failed boolean NOT NULL DEFAULT false;
