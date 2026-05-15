# Schema Update Approval Guide

This guide explains how schema approvals work for the used-gear workflow and exactly where approved changes would be made.

## Scope Rule
- The only Airtable table in direct scope is:
  - base `apprsAm2FOohEmL2u`
  - table `tbl0K0nFQL64jQMx8`
- No new fields should be added to that table until the user explicitly approves them.

## What Does Not Need Schema Approval
- App-only routing changes
- queue UI changes
- dashboard changes
- local scripts that only read or update already-approved fields

Example in the current repo:
- `scripts/used-gear-workflow-backfill.mjs` only writes fields that are already approved in the workflow model.

## Approval Flow For New Airtable Fields

### 1. Write The Proposed Field List First
Add the proposed field names and their purpose to:
- `docs/used-gear-workflow/data-model-and-approvals.md`

Each proposal should include:
- field name
- purpose
- suggested values or type
- the workflow rule that depends on it

### 2. Get Explicit User Approval
Approval should happen before any of these are changed:
- the live Airtable schema
- frontend field arrays
- queue or form logic that assumes the field exists
- tests that depend on the field

### 3. Make The Airtable Change In The Approved Table
Once approved, add the field in Airtable to:
- base `apprsAm2FOohEmL2u`
- table `tbl0K0nFQL64jQMx8`

This is the only place schema changes should be made for the current workflow.

### 4. Wire The App To The Approved Field
After the Airtable field exists, update only the affected repo seams.

#### Data And Mutation Seams
- `src/services/usedGearQueue.ts`
- `src/services/usedGearWorkflow.ts`
- `src/services/usedGearWorkflowLifecycle.ts`
- `src/services/usedGearWorkflowListingReadiness.ts`

#### UI Surfaces
- `src/components/tabs/airtable/UsedGearPendingReviewSection.tsx`
- `src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`
- `src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.tsx`
- `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- `src/components/approval/listingApprovalTabPanels.ts`

#### Dashboard And Notifications
- `src/components/dashboard/DashboardActionsSection.tsx`
- `src/components/dashboard/DashboardWorkflowAnalyticsSection.tsx`
- `src/app/useUsedGearWorkflowNotifications.ts`

#### Documentation
- `docs/used-gear-workflow/data-model-and-approvals.md`
- the relevant phase doc
- `docs/used-gear-workflow/workflow-api-contracts.md` if the field changes a read/write contract

## Recently Approved And Implemented Schema
- `Workflow Owner`
- `Workflow Owner Assigned At`
- `eBay Published At`
- `eBay Offer ID`
- `eBay Listing ID`
- `Stale Recovery Status`
- `Stale Recovery Notes`
- `Stale Recovery Updated At`
- `Relisted At`
- `Shipment Follow-Through Notes`
- `Shipment Follow-Through Updated At`

These fields were approved, created in base `apprsAm2FOohEmL2u` / table `tbl0K0nFQL64jQMx8`, and wired into the workflow queue and workflow detail surfaces.

See also:
- `docs/used-gear-workflow/stale-listing-recovery-design.md`

## Practical Approval Checklist
1. Confirm the field is needed on the Airtable row and cannot stay app-derived.
2. Confirm the field belongs on `tbl0K0nFQL64jQMx8` rather than a future reference table.
3. Add the proposal to `data-model-and-approvals.md`.
4. Get explicit user approval.
5. Add the field in Airtable.
6. Update the repo seams that read, write, and display it.
7. Run targeted tests and `npm run build`.