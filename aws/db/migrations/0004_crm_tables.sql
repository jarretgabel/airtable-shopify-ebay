-- CRM foundations. These tables hold human-entered data that exists only in Postgres, so unlike the
-- mapper-built tables they are never rebuilt from the mirror: contacts are RESTRICTed (not cascaded)
-- and a removed item only clears the reference.
CREATE TABLE interactions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid        NOT NULL REFERENCES contacts (id) ON DELETE RESTRICT,
  item_id      uuid        REFERENCES items (id) ON DELETE SET NULL,
  kind         text        NOT NULL CHECK (kind IN ('email', 'call', 'text', 'visit', 'note', 'other')),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  summary      text,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interactions_contact_idx ON interactions (contact_id, occurred_at DESC);
CREATE INDEX interactions_item_idx ON interactions (item_id) WHERE item_id IS NOT NULL;

-- An inquiry can arrive before we know who sent it, so the contact is optional.
CREATE TABLE inquiries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid        REFERENCES contacts (id) ON DELETE RESTRICT,
  item_id      uuid        REFERENCES items (id) ON DELETE SET NULL,
  channel      text        NOT NULL CHECK (channel IN ('ebay', 'shopify', 'email', 'phone', 'web', 'other')),
  subject      text,
  message      text,
  status       text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  received_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (resolved_at IS NULL OR status <> 'open')
);
CREATE INDEX inquiries_open_idx ON inquiries (received_at) WHERE status = 'open';
CREATE INDEX inquiries_contact_idx ON inquiries (contact_id) WHERE contact_id IS NOT NULL;

CREATE TABLE follow_ups (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    uuid        NOT NULL REFERENCES contacts (id) ON DELETE RESTRICT,
  item_id       uuid        REFERENCES items (id) ON DELETE SET NULL,
  due_at        timestamptz NOT NULL,
  status        text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  note          text,
  completed_at  timestamptz,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR status <> 'open')
);
-- The "what is due" query.
CREATE INDEX follow_ups_due_idx ON follow_ups (due_at) WHERE status = 'open';
CREATE INDEX follow_ups_contact_idx ON follow_ups (contact_id);
