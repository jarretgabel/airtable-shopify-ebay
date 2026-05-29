# JotForm Airtable Ingestion Plan

## Purpose

- Make Airtable the authoritative intake store for both public JotForm submissions and in-app manual intake.
- Eliminate the split workflow where JotForm submissions live in a separate polled feed while manual intake creates workflow rows directly.
- Ensure all downstream workflow surfaces operate on the same `used-gear-workflow` rows from the moment intake begins.

## Current State In This Repo

- The app currently polls JotForm through read-only Lambda endpoints.
  - Frontend polling hook: `src/hooks/useJotForm.ts`
  - Frontend API seam: `src/services/app-api/jotform.ts`
  - AWS handlers: `aws/src/handlers/jotform/getForms.ts`, `aws/src/handlers/jotform/getFormSubmissions.ts`
  - AWS provider: `aws/src/providers/jotform/client.ts`
- Manual intake already writes directly to Airtable workflow rows.
  - Frontend service: `src/services/manualIntakeForm.ts`
  - Existing create path: `createConfiguredRecord('used-gear-workflow', ...)`
- Current workflow requirements already say Airtable should remain the authoritative workflow system.
  - See `docs/used-gear-workflow/original-requirements.md`
- The original rollout explicitly deferred external automation. This document is the follow-up implementation plan for adding that automation now.

## Target State

### Authoritative Intake Model

- Every intake item, whether created by JotForm or by staff in the app, exists as a row in the `used-gear-workflow` Airtable source.
- `Workflow Status` remains the authoritative lifecycle field.
- `Workflow Source` identifies whether the row originated from `JotForm` or `Manual Entry`.
- Parking Lot review, Parking Lot arrival-stage handling, Trash, Testing, Photography, and Listings all operate on the same Airtable-backed workflow rows.

### JotForm Surface Role

- The current JotForm tab becomes a source-monitoring and audit surface, not the operational queue of record.
- New JotForm submissions should appear in workflow queues because they have already been written into Airtable by the ingestion Lambda.

### Staff Editing Model

- Staff should not need to edit the live public JotForm submission itself.
- Staff corrections happen through the in-app intake editing surface using the same Airtable row that the webhook created.
- In practice, this means the manual intake form becomes the editable intake surface for JotForm-originated rows as well.

## Proposed Architecture

### Ingestion Flow

1. A customer submits the public JotForm.
2. JotForm sends a webhook call to this app's AWS API endpoint.
3. The Lambda validates the webhook request and fetches the full submission from JotForm server-to-server.
4. The Lambda maps the JotForm answers into the workflow Airtable field model.
5. The Lambda creates or updates one or more `used-gear-workflow` rows.
6. The created workflow rows land in `Pending Review` unless an approved exception path is explicitly added later.
7. Workflow queues and record pages read those Airtable rows just like manual intake rows.

### Why Webhook Over Frontend Polling

- Polling is acceptable for dashboards and read-only source monitoring.
- Polling is not sufficient as the authoritative operational ingest path because it is delayed and tied to frontend page activity.
- Webhook ingestion is near-real-time, server-controlled, and keeps the workflow consistent for all users whether the app UI is open or not.

## Endpoint Design

### Recommended Route

- Create a dedicated unauthenticated webhook route instead of reusing the current authenticated `/api/jotform/*` read routes.
- Recommended path:
  - `POST /api/hooks/jotform/submissions/:formId`

### Why A Separate Route Prefix

- `aws/src/shared/access.ts` currently treats `/api/jotform/*` as session-authenticated app traffic and requires the `jotform` page permission.
- A JotForm webhook cannot present the app session cookie or CSRF token.
- Using `/api/hooks/*` avoids mixing machine-to-machine traffic with the current app-authenticated JotForm read APIs.

### Authentication And Verification

- Require a secret token that is configured in both JotForm and the Lambda environment.
- Accept the token via a dedicated header or query param that JotForm can send reliably.
- After the initial token check, fetch the referenced submission directly from JotForm using the existing provider credentials.
- Do not trust the raw webhook payload alone as the source of truth for field values.

### Lambda Shape

- Add a handler such as:
  - `aws/src/handlers/jotform/ingestSubmissionWebhook.ts`

## Recommended Implementation Shape

### Handler Flow

Use a thin webhook handler that follows the existing `aws/src/handlers/*` pattern:

1. accept `POST /api/hooks/jotform/submissions/:formId`
2. validate the webhook secret
3. read the `formId` from the path and the submission id from the webhook payload
4. re-fetch the authoritative submission from JotForm instead of trusting the raw webhook body
5. normalize the submission into one or more repo-owned intake items
6. upsert one Airtable workflow row per intake item
7. after each row exists, archive that item's images into Drive using the Airtable `recordId`
8. patch the row with intake-stage workflow image metadata
9. return a success payload that includes the created or updated Airtable record ids

### File Responsibilities

- `aws/src/handlers/jotform/ingestSubmissionWebhook.ts`
  - HTTP-only concerns
  - validate secret
  - parse `formId` and submission id
  - call the ingest provider
  - translate errors into API responses and logging
- `aws/src/providers/jotform/workflowIngest.ts`
  - orchestration layer
  - fetch canonical submission data from JotForm
  - call normalization and mapping helpers
  - perform idempotent Airtable create/update decisions
  - trigger post-row image archive work
- `aws/src/providers/jotform/workflowIngestMapper.ts`
  - pure data shaping only
  - convert JotForm answers into normalized intake items
  - map normalized intake items into Airtable field payloads
  - keep question-id drift isolated from the Airtable write contract
- `aws/src/providers/airtable/sources.ts`
  - remains the write boundary for `createConfiguredRecord` and `updateConfiguredRecord`
  - do not introduce a second Airtable write client for the webhook path

## Airtable Write Strategy

### Source Of Truth

- Write into the existing `used-gear-workflow` configured Airtable source.
- Reuse the existing Airtable provider/write path pattern instead of introducing a second persistence path.
- The new Lambda should call the same Airtable provider primitives used by `aws/src/handlers/airtable/upsertConfiguredRecord.ts`.

### Initial Row Values

- `Workflow Source = JotForm`
- `Workflow Status = Pending Review`
- Customer-submitted notes map into:
  - `Customer Cosmetic Notes`
  - `Customer Functional Notes`
  - `Customer Inclusion Notes`
  - `Customer Submitted Photos Notes`
- Intake identity/grouping fields map into:
  - `Submission Group ID`
  - `Pick Up ID` when present
- Fields like `Make`, `Model`, `Component Type`, and pricing candidates should be populated from the submission when available.

### Recommended Write Order

- Create or upsert the Airtable workflow row first when the webhook is processed.
- Use the resulting Airtable `recordId` as the stable item identifier for any downstream image archive work.
- After the row exists, fetch and archive that item's JotForm images into Google Drive.
- Write the archived Drive image metadata back onto the same Airtable row as `sourceStage: 'intake'`.
- If image archiving fails, keep the workflow row in place and retry image processing separately rather than blocking row creation.

### Idempotency Requirement

- Webhooks can retry.
- The ingestion route must be safe to call multiple times for the same submission.
- The Lambda must upsert, not blindly insert.

### Recommended Identity Fields

Approved field:

- `JotForm Submission ID`

Still optional and only needed if multi-item submissions require a second external discriminator:

- `JotForm Form ID`
- `JotForm Item Key` or equivalent per-item discriminator when one submission can yield multiple workflow rows

These fields make it possible to:

- detect webhook retries safely
- update existing workflow rows without duplicates
- trace workflow rows back to the exact external submission

### If Additional Identity Fields Are Not Approved Immediately

- Use `Submission Group ID` as a temporary submission-level correlation key.
- Derive a per-item stable key from the submission answer structure if multi-item submissions are present.
- Treat this as an interim implementation only; it is weaker than dedicated external identity fields beyond the approved `JotForm Submission ID`.

### Shared Mapping Goal

- Manual intake and JotForm ingestion should not have separate Airtable field mapping rules.
- Move the shared intake-to-workflow field mapping into pure helper modules that both paths can call.

### Recommended Extraction

- Extract shared mapping helpers from `src/services/manualIntakeForm.ts` into backend-safe pure helpers.
- Keep frontend-only concerns such as `File` upload behavior in the frontend service.
- Introduce a shared workflow intake mapper layer with inputs from:
  - manual app form values
  - normalized JotForm submission values

### Backend Normalization Layer

- Create a normalized JotForm submission model first.
- Do not map raw `answers` directly into Airtable field writes inside the handler.
- The ingest provider should:
  1. parse raw JotForm answers
  2. normalize them into a repo-owned intake model
  3. convert that intake model into Airtable workflow fields

This keeps the Airtable write contract stable even if JotForm question IDs or labels drift.

### Row Upsert Decision

- Use `JotForm Submission ID` plus the per-item discriminator to decide whether the item row already exists.
- If the row does not exist, create it in `used-gear-workflow`.
- If the row exists and is still in intake review, update only customer-origin intake fields.
- If the row has already advanced beyond `Pending Review`, do not overwrite downstream workflow fields; only allow narrowly scoped customer-reference refresh behavior if explicitly approved.

## Multi-Item Submission Handling

- If a single JotForm submission can describe multiple intake items, the webhook must create one workflow row per item.
- All rows from the same submission should share the same `Submission Group ID`.
- Pricing/allocation behavior continues to operate at the grouped submission level using existing workflow rules.

## Image Handling

### Phase 1

- Create the workflow row first, then archive JotForm-uploaded images into Google Drive for that specific item row.
- Preserve the customer-origin distinction; do not treat them as internal testing or photography outputs.
- Recommended implementation: treat Drive as the durable workflow copy once the row exists, while optionally retaining the original JotForm source URL for audit/debug only.
- Reason: row-first ingestion gives the archive step a stable Airtable `recordId`, avoids temporary naming schemes, and keeps workflow media ownership inside the same system used elsewhere in the app.

### Phase 2

- If webhook latency or reliability becomes a problem, allow a temporary degraded mode where the row stores original JotForm URLs until Drive archiving catches up.
- The steady-state target should still be Drive-backed intake images stored in workflow image metadata as `sourceStage: 'intake'`.
- This allows intake images to appear in the snapshot/reference image panels without manual re-upload.

### Folder Naming Recommendation

- Do not use SKU as the Drive archive folder name for intake-origin images.
- SKU is not stable at the time intake begins and does not work cleanly for JotForm-origin or early manual-intake images.
- Use one folder per workflow item row, even when multiple rows came from the same grouped submission.
- Preferred folder key: the Airtable workflow `recordId` for the item row, or the stable per-item external key if archiving occurs before the Airtable row exists.
- Do not add a `Submission Group ID` parent folder by default.
- Group membership should remain a data attribute in Airtable, not part of the Drive folder structure.
- Human-readable labels can still include make/model/SKU in filenames, but the folder identity should use immutable workflow ids.
- This keeps every item's intake image bundle aligned with the unit that will actually be tested, photographed, reviewed, and listed on its own.

### Practical Recommendation

- Default recommendation: create the row first, then duplicate JotForm images into Drive under a per-item Airtable-record-based folder.
- Keep the original JotForm URLs only as source metadata or short-term fallback references, not as the primary workflow image location.
- Use direct JotForm references only as a temporary fallback when archive processing is delayed or fails.

### Source URL Recovery Rule

- Do not add a second Airtable field just to persist original JotForm image URLs by default.
- `JotForm Submission ID` is sufficient to re-fetch the canonical submission from JotForm and recover the current file-upload answers when a retry, audit, or source check is needed.
- Treat that as submission re-hydration, not URL derivation.
- The app should not assume that a stable file URL can be deterministically constructed from `JotForm Submission ID` alone without asking JotForm for the submission data again.

### Guardrail

- Customer-submitted images must remain separate from internal workflow images.
- Internal testing/photos should still own the final listing-eligible processed set unless the workflow explicitly chooses to include intake images later.

## Manual Intake Surface Changes

### Expected Behavior

- Keep the current Manual Intake form as the editable intake surface.
- Allow that form to open and edit rows whose `Workflow Source` is `JotForm`.
- This keeps one staff editing experience for all intake rows.
- JotForm-origin and manual-entry rows should both enter the same Parking Lot review flow when their initial `Workflow Status` is `Pending Review`.

### Follow-Up UI Work

- Add clear source badges or banners when editing JotForm-originated rows.
- Distinguish customer-origin fields from internal corrections where needed.
- Avoid any UI that suggests the app is writing back into JotForm itself.

## Security And Reliability

### Webhook Safety

- Secret-protect the webhook route.
- Fetch the submission from JotForm again on the server after receiving the webhook.
- Log request metadata and resolved submission ids for audit.

### Failure Handling

- Return non-2xx only for cases where JotForm should retry.
- Record ingest failures with enough metadata to retry manually.
- Consider a lightweight dead-letter or retry log if webhook volume becomes meaningful.

### Concurrency

- Upsert logic must tolerate duplicate webhook deliveries and replayed deliveries.
- Do not overwrite downstream workflow fields if the row has already advanced beyond `Pending Review` unless the update is explicitly limited to customer-origin intake data.

## Rollout Plan

### Phase 0: Approval

- Approved: add `JotForm Submission ID`.
- Still open: whether `JotForm Form ID` and `JotForm Item Key` should also be added.
- Approve the external automation change, since original rollout guardrails deferred it.
- Approve the target route path and secret-management approach.

### Phase 1: Backend Ingestion Foundation

- Add webhook handler under `aws/src/handlers/jotform/`.
- Add ingest provider under `aws/src/providers/jotform/`.
- Add normalized JotForm-to-workflow mapping helpers.
- Add server-side idempotent Airtable upsert behavior.
- Update local API routing in `scripts/start-local-api.mjs` per the existing Lambda app-api pattern.

### Phase 2: Workflow Integration

- Ensure created rows appear correctly in Parking Lot and grouped intake review.
- Add source-aware affordances in record pages and manual intake editing.
- Keep the raw JotForm tab as source monitoring rather than workflow ownership.

### Phase 3: Image Ingestion

- Decide whether customer-uploaded JotForm images stay as external references or are archived into Drive as intake-stage assets.
- If approved, add Drive-backed intake image archive ingestion.

### Phase 4: Retirement Of Operational Dependence On Live JotForm Feed

- Reduce or remove any operational reliance on frontend JotForm polling for workflow progression.
- Keep the read-only JotForm tab only if it still provides audit or troubleshooting value.

## Repo File Targets

### New Backend Files

- `aws/src/handlers/jotform/ingestSubmissionWebhook.ts`
- `aws/src/providers/jotform/workflowIngest.ts`
- `aws/src/providers/jotform/workflowIngestMapper.ts`

### Existing Files Likely To Change

- `aws/src/shared/access.ts`
- `aws/src/providers/jotform/client.ts`
- `scripts/start-local-api.mjs`
- `src/services/manualIntakeForm.ts`
- `src/components/tabs/UsedGearManualIntakePage.tsx` or surrounding routing/shell files if source-aware editing affordances are added
- workflow docs and smoke-test docs after the feature lands

## Validation Plan

- Unit tests for JotForm normalization and Airtable mapping.
- Unit tests for idempotent create-vs-update behavior.
- Local API validation for the webhook handler.
- End-to-end scratch test using a captured JotForm submission payload and a test Airtable row set.
- Queue-level validation confirming new webhook-created rows appear in Parking Lot without manual intervention.

## Recommended First Delivery Slice

The smallest production-meaningful slice is:

1. add explicit Airtable identity fields
2. add webhook Lambda ingestion for text fields only
3. create `Pending Review` workflow rows from JotForm submissions
4. make those rows editable through the existing Manual Intake form

This delivers the core consistency goal without blocking on image archival.

### Recommended Follow-Up Slice

Once row creation is stable, the next slice should be:

1. fetch JotForm-uploaded images after row creation
2. archive them into Drive under the Airtable `recordId`
3. write intake-stage workflow image metadata back onto the row
4. treat Drive-backed intake images as the primary workflow reference surface

## Open Decisions

- Are new Airtable identity fields approved for external submission tracking?
- Does one JotForm submission map to one workflow row, or can it map to multiple item rows?
- Should JotForm-uploaded photos be phase-1 references only or phase-2 Drive-archived intake images?
- Should the JotForm tab remain visible after webhook ingestion is live, or should it be reduced to an admin-only audit surface?