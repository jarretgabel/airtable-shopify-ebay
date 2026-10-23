-- Normalized layer derived from the Listings mirror (records). Rebuildable: the mapper upserts
-- by Airtable record id and never writes back to Airtable or to records.
CREATE TABLE contacts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text        NOT NULL,
  alternate_emails    text[]      NOT NULL DEFAULT '{}',
  name                text,
  phone               text,
  zip_code            text,
  location            text,
  mailing_list_opt_in boolean     NOT NULL DEFAULT false,
  how_did_you_hear    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
-- De-duplication: one contact per lower-cased, trimmed email; a new email whose 10-digit phone matches exactly one
-- existing contact is merged into it and kept in alternate_emails (see mergeContacts).
CREATE UNIQUE INDEX contacts_email_key ON contacts (email);

CREATE TABLE items (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_record_id      text        NOT NULL UNIQUE,
  sku                     text,
  make                    text,
  model                   text,
  serial_number           text,
  component_type          text[],
  condition               text,
  cost                    numeric,
  offer_amount            numeric,
  paid_amount             numeric,
  arrival_date            date,
  workflow_status         text,
  workflow_source         text,
  jotform_submission_id   text,
  seller_contact_id       uuid        REFERENCES contacts (id),
  vendor                  text,
  shopify_order_id        text,
  shopify_order_name      text,
  post_sale_outcome       text,
  post_sale_outcome_at    timestamptz,
  refund_amount           numeric,
  refund_reason           text,
  return_received_at      timestamptz,
  restock_disposition     text,
  airtable_created_at     timestamptz,
  deleted_at              timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_seller_contact_idx ON items (seller_contact_id);
CREATE INDEX items_workflow_status_idx ON items (workflow_status) WHERE deleted_at IS NULL;
CREATE INDEX items_sku_idx ON items (sku);

CREATE TABLE listings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id              uuid        NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  channel              text        NOT NULL CHECK (channel IN ('ebay', 'shopify')),
  status               text        NOT NULL CHECK (status IN ('draft', 'published', 'closed')),
  price                numeric,
  quantity             integer,
  external_product_id  text,
  external_offer_id    text,
  published_at         timestamptz,
  closed_at            timestamptz,
  close_result         text,
  UNIQUE (item_id, channel)
);

CREATE TABLE item_status_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid        NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  status      text        NOT NULL,
  changed_at  timestamptz NOT NULL,
  changed_by  text,
  UNIQUE (item_id, status)
);

CREATE TABLE item_images (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  position    integer NOT NULL,
  attachment  jsonb   NOT NULL,
  alt_text    text,
  role        text,
  UNIQUE (item_id, position)
);
