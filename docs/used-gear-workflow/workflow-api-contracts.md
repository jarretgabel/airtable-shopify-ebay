# Workflow API Contracts

This document records the app-owned read and write contracts for the used-gear workflow.

## Purpose
- Make the implemented workflow queue and mutation seams explicit.
- Separate approved app behavior from deferred later-phase pages.
- Record how JotForm-origin and manual-entry-origin rows enter the app workflow without changing external systems.

## Scope
- Airtable source: `used-gear-workflow`
- Direct table scope: `tbl0K0nFQL64jQMx8`
- Current app implementation scope:
  - inventory workflow queues and detail page
  - listing approval/publish handoff
  - post-publish lifecycle queue work
  - in-app workflow notifications
- Out of scope for this contract:
  - live JotForm changes
  - new Airtable fields without explicit approval
  - new later-phase tabs that are not yet implemented

## Source Contract

Configured Airtable source name:
- `used-gear-workflow`

Current source expectations:
- Reads and writes go through the configured Airtable app-api and Lambda seam, not direct UI-side Airtable calls.
- Workflow rows are enriched app-side with derived fields:
  - `Workflow Intake Decision`
  - `Workflow Next Team`
- The authoritative stored workflow state remains `Workflow Status`.

Primary source wiring:
- client app-api service accepts `used-gear-workflow` as a configured source
- Lambda provider/handler allowlists accept `used-gear-workflow`
- inventory directory and workflow queue services read from that same source

## Read Contracts

### Inventory Directory Read
- Service: `loadInventoryDirectory`
- Purpose: load the main Inventory directory with workflow-derived fields already enriched.
- Notes:
  - not a workflow-only queue
  - used to keep the Inventory directory aligned with workflow status chips and filters

### Pending Review Queue Read
- Service: `loadPendingReviewQueue`
- Returns:
  - rows whose derived workflow status is `Pending Review`
- Required field family:
  - `SKU`
  - `Make`
  - `Model`
  - `Workflow Source`
  - `Workflow Status`
  - `Submission Group ID`
  - `Pick Up ID`
  - `Qualification Complete`
  - `Qualification Notes`
  - `Unqualified Reason`
  - `Accepted By`
  - `Accepted At`
  - `Trash Status`
- Grouping contract:
  - group by `Pick Up ID` first
  - fall back to `Submission Group ID`
  - fall back to record id when no group keys exist

### Progress Queue Read
- Service: `loadWorkflowProgressQueue`
- Returns:
  - rows in any of these statuses:
    - `Accepted - Awaiting Arrival`
    - `Accepted - Arrived, Awaiting SKU`
    - `Accepted - Arrived, Awaiting Missing Item`
    - `Testing and Photography In Progress`
    - `Awaiting Pre-Listing Review`
    - `Approved for Publish`
- Additional field family includes:
  - processing/testing/photography/pre-listing signoff fields
  - internal/customer notes used by workflow detail and readiness checks
  - pricing fields used by pre-listing gating

### Post-Publish Queue Read
- Service: `loadWorkflowPostPublishQueue`
- Returns:
  - rows in any of these statuses:
    - `Listed, Shopify`
    - `Listed, eBay`
    - `Stale Listing, Shopify`
    - `Stale Listing, eBay`
    - `Sold - Ready to Ship`
    - `Shipped`
- Bucket derivation contract:
  - `active-listing`
  - `stale-listing`
  - `sold-ready`
  - `shipped`

### Single Workflow Record Read
- Service: `loadUsedGearWorkflowRecord`
- Purpose: load one workflow record for `/inventory/workflow/:recordId`
- Error contract:
  - throws when the selected record id is not found in the configured source

### Notification Count Read
- Service: `loadUsedGearWorkflowNotificationCounts`
- Purpose: aggregate counts for user-configurable in-app workflow alerts
- Event keys:
  - `pendingReview`
  - `processing`
  - `testing`
  - `photography`
  - `preListingReview`
  - `approvedForPublish`

## Mutation Contracts

All mutations write through `updateConfiguredRecord('used-gear-workflow', recordId, fields, { typecast: true })`.

### Accept Pending Review
- Service: `acceptPendingReviewRecord(recordId, userName)`
- Allowed from:
  - `Pending Review`
- Writes:
  - `Workflow Status = Accepted - Awaiting Arrival`
  - `Qualification Complete = true`
  - `Accepted By = current user`
  - `Accepted At = now`
  - `Trash Status = null`
  - `Unqualified Reason = null`
- Validation:
  - `userName` must be non-empty

### Mark Pending Review Unqualified
- Service: `markPendingReviewUnqualified(recordId, reason)`
- Allowed from:
  - `Pending Review`
- Writes:
  - `Workflow Status = Unqualified`
  - `Qualification Complete = false`
  - `Unqualified Reason = provided reason`
  - `Trash Status = Active Trash`
- Validation:
  - `reason` must be non-empty

### Save Generic Stage Signoff
- Service: `saveUsedGearWorkflowStageSignoff(recordId, stage, userName, signedAt?)`
- Purpose:
  - write explicit audit signoff fields without changing workflow status by itself
- Supported stages:
  - `processing`
  - `testing`
  - `photography`
  - `pre-listing`
- Writes:
  - the `Signed By` and `Signed At` fields for the selected stage
- Validation:
  - `userName` must be non-empty

### Complete Processing
- Service: `completeProcessingStage(recordId, userName)`
- Allowed from practical workflow use:
  - any accepted pre-concurrent-processing state
- Writes:
  - processing signoff fields
  - `Workflow Status = Testing and Photography In Progress`
- Validation:
  - `userName` must be non-empty

### Complete Testing
- Service: `completeTestingStage(recordId, userName)`
- Allowed only when:
  - current status is `Testing and Photography In Progress`
- Writes:
  - testing signoff fields
  - if photography is already signed off:
    - `Workflow Status = Awaiting Pre-Listing Review`
    - `Awaiting Pre-Listing Review At = now`
  - otherwise status remains `Testing and Photography In Progress`

### Complete Photography
- Service: `completePhotographyStage(recordId, userName)`
- Allowed only when:
  - current status is `Testing and Photography In Progress`
- Writes:
  - photography signoff fields
  - if testing is already signed off:
    - `Workflow Status = Awaiting Pre-Listing Review`
    - `Awaiting Pre-Listing Review At = now`
  - otherwise status remains `Testing and Photography In Progress`

### Complete Pre-Listing Review
- Service: `completePreListingReviewStage(recordId, userName)`
- Allowed only when:
  - current status is `Awaiting Pre-Listing Review`
- Validation:
  - `userName` must be non-empty
  - `assertUsedGearWorkflowReadyForPublish(record)` must pass
- Writes:
  - pre-listing signoff fields
  - `Workflow Status = Approved for Publish`
  - `Approved For Publish At = now`

### Mark Listing Stale
- Service: `markWorkflowListingStale(recordId)`
- Allowed only when the current post-publish snapshot is:
  - `Listed, Shopify`
  - `Listed, eBay`
  - `Stale Listing, Shopify`
  - `Stale Listing, eBay`
- Writes:
  - `Workflow Status = Stale Listing, Shopify` or `Stale Listing, eBay`
  - `Stale Listing At = existing value or now`

### Mark Sold Ready To Ship
- Service: `markWorkflowSoldReadyToShip(recordId)`
- Allowed only when the current post-publish bucket is:
  - `active-listing`
  - `stale-listing`
- Writes:
  - `Workflow Status = Sold - Ready to Ship`
  - `Sold Ready To Ship At = existing value or now`

### Mark Shipped
- Service: `markWorkflowShipped(recordId)`
- Allowed only when:
  - current status is `Sold - Ready to Ship`
- Writes:
  - `Workflow Status = Shipped`
  - `Shipped At = existing value or now`

## Publish Handoff Contract

The workflow queue service does not directly publish listings. The current publish handoff contract is:
- pre-listing completion moves a row to `Approved for Publish`
- approved rows open the combined approval surface at `/listings/:recordId`
- listing approval uses workflow readiness and summary context in the selected record panel and publish confirmation copy
- successful publish writes workflow lifecycle state back into the workflow row, including `Listed At` and the channel-specific listed status

Current supported publish lifecycle outcomes:
- `Listed, Shopify`
- `Listed, eBay`
- later post-publish queue transitions continue from those statuses

Deferred publish writeback:
- eBay metadata persistence beyond workflow status is intentionally deferred until approved Airtable field names exist for that data

## JotForm And Manual-Entry Intake Contract

### JotForm-Origin Rows
- `Workflow Source` should be set to `JotForm` when the row originates from the external submission flow.
- The app does not mutate the live JotForm workflow.
- Phase 1 qualification happens after the row exists in the workflow table:
  - review from `Pending Review`
  - accept into the accepted workflow family
  - or route to `Unqualified` and trash

### Manual-Entry-Origin Rows
- `Workflow Source` should be set to `Manual Entry` when the row is created by staff instead of external intake.
- Manual entry remains an app-side creation choice, not a separate stored routing field.
- Manual-entry UI implementation is still a later-phase surface, but the status and grouping contract are already defined here.

## Transition Guard Contract

The current workflow contract depends on these app-enforced rules:
- `Workflow Status` is authoritative.
- `Workflow Intake Decision` is derived from `Workflow Status`, not stored separately.
- `Workflow Next Team` is derived from `Workflow Status` plus concurrent signoffs, not stored separately.
- Testing and photography may proceed concurrently.
- `Awaiting Pre-Listing Review` is only reachable once both concurrent signoffs exist.
- `Approved for Publish` is only reachable after readiness checks pass.
- `Shipped` is only reachable from `Sold - Ready to Ship`.

## Route Contract

Current workflow routes and deep links:
- inventory workflow detail:
  - `/inventory/workflow/:recordId`
- listing approval handoff:
  - `/listings/:recordId`
- post-publish bucket deep link:
  - `/inventory?workflowPostPublishBucket=<bucket>#used-gear-post-publish`

Current Inventory URL-backed queue state keys:
- `workflowPendingReviewSearch`
- `workflowProgressSearch`
- `workflowPostPublishSearch`
- `workflowPendingReviewCollapsedGroups`
- `workflowProgressCollapsedGroups`
- `workflowPostPublishCollapsedSections`
- `workflowPendingReviewSort`
- `workflowProgressSort`
- `workflowPostPublishSort`
- `workflowPostPublishBucket`
- `inventoryDirectorySearch`
- `inventoryDirectoryStatus`

## References
- `src/services/usedGearWorkflow.ts`
- `src/services/usedGearQueue.ts`
- `src/services/usedGearWorkflowLifecycle.ts`
- `src/services/usedGearWorkflowListingReadiness.ts`
- `src/services/inventoryDirectory.ts`
- `src/components/tabs/AirtableTab.tsx`
- `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- `src/components/approval/useListingApprovalPublishActions.ts`