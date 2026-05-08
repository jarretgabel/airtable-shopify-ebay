# Stale Listing Recovery Design

This document records the approved stale-listing recovery model and the current implementation seams.

## Purpose
- Define what "richer stale-listing recovery actions" should mean operationally.
- Separate the no-schema queue behavior from the approved Airtable-backed recovery fields.
- Make the live schema location and repo wiring explicit.

## Current Implemented State
- Operators can move live rows into:
  - `Stale Listing, Shopify`
  - `Stale Listing, eBay`
- The workflow captures:
  - `Listed At`
  - `Stale Listing At`
- Operators can already:
  - filter stale listings in Inventory
  - open the workflow row
  - open the listing record
  - share stale queue links
  - save stale recovery status and notes
  - mark stale rows relisted back into the live listed family
  - move sold items into `Sold - Ready to Ship`

## Approved Recovery Fields
- `Stale Recovery Status`
  - Purpose: track the current recovery state for a stale listing.
  - Approved values:
    - `Needs Review`
    - `Price Refresh`
    - `Content Refresh`
    - `Ready To Relist`
    - `Do Not Relist`
- `Stale Recovery Notes`
  - Purpose: capture why the stale row needs intervention and what changed.
- `Stale Recovery Updated At`
  - Purpose: record the last operator recovery update.
- `Relisted At`
  - Purpose: record when a stale row was successfully republished or refreshed back into an active listing state.

These four fields are now approved and were created in the live workflow table:
- base `apprsAm2FOohEmL2u`
- table `tbl0K0nFQL64jQMx8`

## Proposed Recovery Model

### Phase A: No-Schema Improvements
These improvements can be implemented without new Airtable fields:

1. Add stale-row action presets in the post-publish queue.
   - Example actions:
     - open listing record
     - open workflow detail
     - jump to combined listings approval when a content refresh is required
2. Add clearer stale-row copy in queue cards.
   - show stale age, listed age, and the likely next recovery route inline
3. Add stale-focused dashboard shortcuts.
   - separate Shopify stale and eBay stale shortcuts when counts justify it

Phase A does not require schema approval.

### Phase B: Airtable-Backed Recovery Tracking
The approved Airtable-backed recovery model persists operator decisions directly on the workflow row.

## Implemented Recovery Actions

### While In `Stale Listing, Shopify` Or `Stale Listing, eBay`
- Set `Stale Recovery Status` to the intended action.
- Save `Stale Recovery Notes` with the reason for intervention.
- Update `Stale Recovery Updated At` whenever the stale decision changes.

### When Recovery Succeeds
- Capture `Relisted At`.
- Move the workflow row back to the appropriate active listed status:
  - `Listed, Shopify`
  - `Listed, eBay`

### When Recovery Fails Or Stops
- Keep the row in the stale family and update `Stale Recovery Status` to `Do Not Relist`.
- Do not invent a new terminal stale state unless the team later approves a broader lifecycle expansion.

## Current Repo Wiring
- `src/services/usedGearWorkflowLifecycle.ts`
  - parses approved stale-recovery fields into the post-publish lifecycle snapshot
- `src/services/usedGearQueue.ts`
  - loads the approved fields and writes `saveWorkflowStaleRecovery(...)` and `markWorkflowRelisted(...)`
- `src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.tsx`
  - exposes stale recovery controls in the post-publish queue
- `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
  - shows the recovery state as a read-only workflow detail panel
- `scripts/used-gear-workflow-backfill.mjs`
  - includes the approved stale-recovery fields in the controlled field allowlist

## Where Schema Changes Would Be Made
- Airtable location:
  - base `apprsAm2FOohEmL2u`
  - table `tbl0K0nFQL64jQMx8`
- Approval record:
  - `docs/used-gear-workflow/data-model-and-approvals.md`
- App wiring after approval:
  - `src/services/usedGearQueue.ts`
  - `src/services/usedGearWorkflow.ts`
  - `src/services/usedGearWorkflowLifecycle.ts`
  - `src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.tsx`
  - `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
  - `src/components/dashboard/DashboardActionsSection.tsx`
  - `src/components/dashboard/DashboardWorkflowAnalyticsSection.tsx`

## Current Constraint
- The broader workflow field set is still not fully present in the live approved table.
- The stale-recovery fields above do exist live now, but any larger schema reconciliation should still be handled explicitly and separately.