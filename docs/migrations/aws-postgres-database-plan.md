# AWS Postgres Database Plan

Status: draft, planning only. No code or AWS changes yet.

## Goal

Add an AWS-hosted Postgres database alongside Airtable, without disconnecting Airtable. Airtable stays the source of truth until a per-table cutover says otherwise. The long-term aim is a foundation for analytics dashboards and a CRM.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Database | RDS Postgres, single-AZ `db.t4g.micro`, 7-day automated backups | CRM and analytics need joins, aggregation and flexible filtering. DynamoDB would force a data-model rewrite later. |
| Upgrade path | `t4g.small` first; Aurora only if usage grows well beyond the assumption below | Same Postgres code. Aurora and RDS Proxy are not needed unless usage changes. |
| Assumption | About 3 users total | Replicas, auto-scaling, multi-AZ and RDS Proxy are unnecessary. Revisit sizing if the team or load grows. |
| DynamoDB | Keep only for tokens, config, job state and idempotency keys | Already planned in `aws-lambda-migration-plan.md`. |
| Seam | `ListingStore` interface under the Lambda handlers | Frontend and `/api` contracts stay unchanged. |
| Rollout | Airtable default, then dual-write, shadow-read, per-table cutover | Airtable wiring stays intact during testing. |

## Current state (from code review)

- The browser never calls Airtable directly. Reads and writes go through `aws/src/providers/airtable/` (`client.ts`, `sources.ts`).
- Configured sources: `users`, `user-guide`, `inventory-directory`, `used-gear-workflow`, `approval-ebay`, `approval-shopify`, `approval-combined`, `shopify-vendors`.
- Server-side filtering is Airtable `filterByFormula` on `Workflow Status`, with subsets `ready-for-publishing`, `listings-page`, `post-publish`.
- There is a 120s in-memory cache and a 200-record cap on the listings page.
- Sorting and most extra filtering happen in the frontend.
- Records are `{id, fields, createdTime}` with human-labelled fields, string-typed values, and single-value arrays.

## Environment strategy

Airtable keeps working in `prod` and `staging` throughout. Only a dedicated test stack uses Postgres.

| Stage | `DATA_BACKEND` | Purpose |
|---|---|---|
| `prod` | `airtable` | Untouched. |
| `staging` | `airtable` | Stable test environment for normal code changes. |
| `pg-test` (new stage, copy of staging, or `dev`) | `dual`, then `postgres` | Only place the new database is exercised. Own RDS instance and stack. |

Rules:

- Stages are separate CloudFormation stacks (see `aws/samconfig.toml.example`). The flag and the RDS instance are per stack.
- An unset `DATA_BACKEND` means `airtable`, so stacks that don't opt in behave exactly as today.
- Merge the seam and Postgres store to `main` early, behind the flag. They are inert until enabled. Avoid a long-lived migration branch.
- Normal feature work continues on `main`. Backend-specific differences go behind the flag, not a fork.
- Shared contract tests run against both implementations, so Airtable changes that are not reflected in Postgres fail visibly.
- Postgres schema changes are versioned SQL migrations. The JSONB mirror absorbs new Airtable fields automatically.
- The `pg-test` stack uses the staging (test) Airtable base and its own secrets, never live production data.
- Rollback is setting the flag back to `airtable`.
- Backfill is one-way (Airtable to Postgres) until a later decision says otherwise.
- Use short-lived branches only for risky pieces (Postgres store, backfill), merged when tests pass.
- The frontend needs no change. An optional second CloudFront site can point at the `pg-test` API.

## Data model: two layers

### Layer 1: migration mirror (now)

One generic table per environment:

- `records(source text, record_id text, fields jsonb, created_time timestamptz, updated_at timestamptz, airtable_synced_at timestamptz, primary key (source, record_id))`
- Indexed or generated columns for hot fields only: `workflow_status`, `updated_at`.
- No redesign during migration, so diffs between Airtable and Postgres stay meaningful.

### Layer 2: normalized model (grow into it)

Populate from the mirror through a mapper, then move dashboards and CRM features onto it first.

| Today | Normalized |
|---|---|
| Seller fields repeated per workflow record | `contacts` (name, email, phone, zip, opt-in, source) |
| Item data spread across intake and approval tables | `items` (make, model, serial, condition, cost, acquired date) |
| Per-channel approval tables | `listings` (item_id, channel, status, price, external id, timestamps) |
| `Workflow Status` plus `... At` fields | `item_status_history` (item_id, status, changed_at, by) |
| String costs and dates | `numeric` and `timestamptz` |
| Single-item arrays | Scalars |
| New CRM | `interactions`, `inquiries`, `follow_ups` referencing `contacts` and `items` |

Highest-value change: `item_status_history`, which gives cycle-time and aging analytics directly.

## Risks and cautions

- Airtable field names are the current contract. The normalized layer needs an explicit mapping layer.
- Do not normalize before Phase 0 shows which fields are stable.
- Contact de-duplication needs explicit rules (for example, merge by email).
- Dual-write must never fail a request because the mirror failed.
- RDS adds a VPC, security groups and Lambda connectivity (small connection pools; RDS Proxy not needed at ~3 users). Local no-Docker flow needs a local Postgres.
- Cost: roughly $12 to $15 per month, always on. Keep encryption, private subnets and backups on regardless of team size.
- Airtable-specific types (linked records, formulas, rollups, attachments) have no Postgres equivalent. Decide per field: raw JSON or resolved.

## Checklist

Work one phase at a time. Do not start a phase until the previous one is signed off.

### Phase 0: Discovery (no code changes)

- [ ] Confirm a separate Airtable test base exists for the `pg-test` stack so dual-write never touches live production data; record the answer in the Environment strategy section. If none exists, decide how to create one before Phase 5.
- [ ] Get approximate record counts per source (from the owner's knowledge or a read-only Airtable API call; no writes).
- [ ] List every source and its Airtable table, view and approximate record count.
- [ ] Capture every field per source, with type, whether used, and which code reads or writes it.
- [ ] Document read patterns: filters, sorts, search fields, subsets, max records.
- [ ] Document write patterns: create, update, delete, attachment upload.
- [ ] Identify linked-record, formula and attachment fields and decide handling.
- [ ] Choose the first table to migrate (low risk, not live listings).
- [ ] Decide attachment and image handling (keep Drive, Airtable and S3 as they are).
- [ ] Draft the normalized schema (ER diagram) and review it.
- [ ] Set a monthly budget and pick the dev/staging AWS account and region.

### Phase 1: AWS foundation (no app changes)

- [ ] Create the `pg-test` stage (samconfig entry and stack) pointing at the staging Airtable base; leave `prod` and `staging` on Airtable.
- [ ] Create the RDS Postgres instance in the `pg-test` stack (single-AZ `t4g.micro`, private subnets, encryption, 7-day automated backups).
- [ ] Store credentials in Secrets Manager.
- [ ] Define security groups and Lambda access (VPC config with small connection pools; no RDS Proxy).
- [ ] Add the resources to `aws/template.yaml` and update the deployer IAM policy.
- [ ] Verify connectivity from a throwaway Lambda and from a local script.
- [ ] Decide on the local dev database (Docker Postgres or the dev instance).

### Phase 2: Schema and migrations

- [ ] Choose a migration tool or plain SQL-files runner.
- [ ] Create the `records` mirror table and the hot-field indexes.
- [ ] Create a field-metadata table or equivalent to replace `getTableMetadata`.
- [ ] Apply migrations in dev and verify idempotency.

### Phase 3: Code seam (Airtable behavior unchanged)

- [ ] Extract the `ListingStore` interface from the current Airtable client operations.
- [ ] Wrap the existing Airtable implementation behind it.
- [ ] Add the `DATA_BACKEND` flag (`airtable` | `dual` | `postgres`), default `airtable`, settable per source.
- [ ] Add shared contract tests that any implementation must pass.
- [ ] Confirm existing tests and local `/api` validation still pass.

### Phase 4: Postgres implementation and backfill

- [ ] Implement the Postgres `ListingStore` (list, get, create, update, delete, subsets, search).
- [ ] Run the contract tests against Postgres.
- [ ] Write an idempotent Airtable-to-Postgres backfill script with row-count reporting.
- [ ] Backfill dev data and diff counts and fields.

### Phase 5: Shadow write

- [ ] Enable `dual` for the first table.
- [ ] Mirror writes to Postgres after Airtable succeeds; log and meter mirror failures without failing requests.
- [ ] Run the write-validation workflow in `aws-lambda-write-validation.md`.
- [ ] Review failure logs and fix gaps.

### Phase 6: Shadow read

- [ ] Read from both backends, serve Airtable, and log mismatches.
- [ ] Fix drift until diffs are zero for an agreed period.
- [ ] Measure latency of both paths.

### Phase 7: Per-table cutover

- [ ] Switch reads to Postgres for one table; keep Airtable writes in place.
- [ ] Confirm rollback is a single flag change and test it.
- [ ] Consider reverse sync until confident.
- [ ] Repeat per table.

### Phase 8: Normalized layer and CRM foundations

- [ ] Build the mapper from the mirror to normalized tables (`contacts`, `items`, `listings`, `item_status_history`).
- [ ] Define and test contact de-duplication rules.
- [ ] Move the first dashboard onto normalized tables.
- [ ] Add CRM tables (`interactions`, `inquiries`, `follow_ups`).

### Phase 9: Later decisions (not now)

- [ ] Attachments and images storage.
- [ ] Auth and user records.
- [ ] Retiring Airtable.
- [ ] Instance upgrade (`t4g.small`), and only if usage outgrows the 3-user assumption: Aurora, read replica, or Athena for heavy reporting.

## Out of scope

- Disconnecting Airtable.
- Changing frontend behavior or `/api` contracts.
- Moving Shopify or eBay integrations.
