# Surface Audit Checklist

This document is the app-owned surface audit for the approved used-gear workflow model.

## Purpose
- Record which surfaces are already aligned with the approved workflow fields and statuses.
- Separate completed Phase 1 alignment from later-phase surface work.
- Prevent future form/page reuse from silently skipping workflow fields.

## Status Key
- `Done`: implemented and currently aligned enough for the approved Phase 1 workflow.
- `Later Phase`: identified, but intentionally deferred until that phase starts.
- `Watch`: existing surface is still in use and must be re-checked before deeper workflow reuse.

## Inventory Surfaces

### Inventory Directory
- Status: `Done`
- Surface:
  - `src/components/tabs/AirtableTab.tsx`
  - `src/components/tabs/airtable/InventoryDirectoryListSection.tsx`
- Alignment:
  - workflow-enriched records now feed the Inventory directory
  - URL-backed search and status filters are shareable
  - workflow state can be surfaced alongside the main directory view

### Pending Review Queue
- Status: `Done`
- Surface:
  - `src/components/tabs/airtable/UsedGearPendingReviewSection.tsx`
- Alignment:
  - grouped by `Pick Up ID` then `Submission Group ID`
  - supports qualification review and unqualified routing
  - supports URL-backed search, collapse, sort, and copy-link behavior

### Progress Queue
- Status: `Done`
- Surface:
  - `src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`
- Alignment:
  - supports processing, testing, photography, and pre-listing progression
  - shows approved-for-publish rows in the same workflow flow
  - exposes readiness context needed before publish handoff

### Workflow Detail Page
- Status: `Done`
- Surface:
  - `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- Alignment:
  - routable at `/inventory/workflow/:recordId`
  - loads a single workflow row from the configured source
  - exposes stage actions, workflow summary, and listing-readiness context

### Post-Publish Queue
- Status: `Done`
- Surface:
  - `src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.tsx`
- Alignment:
  - bucketed lifecycle view for listed, stale, sold-ready, and shipped rows
  - supports URL-backed search, collapse, sort, focused bucket, and share-link behavior

## Listing And Publish Surfaces

### Combined Listing Approval
- Status: `Done`
- Surface:
  - `src/components/approval/listingApprovalTabPanels.ts`
  - `src/components/approval/ListingApprovalWorkflowSummary.tsx`
  - `src/components/approval/useListingApprovalTabState.ts`
  - `src/components/approval/useListingApprovalPublishActions.ts`
- Alignment:
  - workflow summary is shown in the selected record panel
  - publish confirmation includes workflow status and readiness details
  - publish writeback updates workflow lifecycle state after successful listing publish

### Approval Store Prefill
- Status: `Done`
- Surface:
  - `src/stores/approval/approvalStoreWorkflowPrefill.ts`
  - `src/stores/approval/approvalStoreRecordState.ts`
- Alignment:
  - workflow-derived values prefill listing editor state where supported

## Notification And Admin Surfaces

### Current User Notification Preferences
- Status: `Done`
- Surface:
  - `src/components/SettingsTab.tsx`
- Alignment:
  - users can opt into workflow event notifications by queue/event type

### Admin User Detail Preferences
- Status: `Done`
- Surface:
  - `src/components/users/UserDetailPanel.tsx`
- Alignment:
  - admins can configure workflow alert subscriptions per user

### Global In-App Workflow Notifications
- Status: `Done`
- Surface:
  - `src/app/useUsedGearWorkflowNotifications.ts`
  - `src/App.tsx`
- Alignment:
  - queue counts generate in-app notifications using user preference settings

## Dashboard Surfaces

### Dashboard Actions And Insights
- Status: `Done`
- Surface:
  - `src/components/dashboard/DashboardActionsSection.tsx`
  - `src/components/dashboard/DashboardOverviewInsightsSection.tsx`
  - `src/hooks/useUsedGearWorkflowPostPublishSummary.ts`
- Alignment:
  - stale and sold-ready workflow counts surface in dashboard actions and insights
  - dashboard actions deep-link into the correct post-publish bucket

## Existing Reuse Surfaces To Re-Check Later

### JotformTab
- Status: `Watch`
- Surface:
  - existing inquiry/submission list reuse point noted in the workflow plan
- Re-check when Phase 2 starts:
  - whether grouped submission review should stay embedded here or move to a dedicated submission-review surface
  - whether qualification notes and source/group metadata need to surface directly in this tab
- Constraint:
  - no live JotForm changes in Phase 1

### AirtableEmbeddedForm / Incoming Gear Form
- Status: `Watch`
- Surface:
  - existing incoming gear form reuse point noted in the workflow plan
- Re-check when Phase 2 starts:
  - whether this form remains the arrival/update surface
  - whether approved workflow fields should be shown directly or preserved in the workflow detail page only

### TestingFormTab
- Status: `Watch`
- Surface:
  - existing testing form reuse point noted in the workflow plan
- Re-check when deeper stage-specific UI is needed:
  - internal functional notes
  - testing signoff capture
  - workflow route/open-back behavior

### PhotosFormTab
- Status: `Watch`
- Surface:
  - existing photos form reuse point noted in the workflow plan
- Re-check when deeper stage-specific UI is needed:
  - photography signoff capture
  - photo-reference workflow context
  - workflow route/open-back behavior

## Later-Phase Surfaces Not Yet Implemented

### Intake And Parking-Lot Pages
- Status: `Later Phase`
- Surfaces to build or confirm:
  - Parking Lot 1 queue page
  - Parking Lot 2 queue page
  - Trash page
  - Manual entry intake page
  - grouped submission review page if needed

### Additional Listing And Lifecycle Pages
- Status: `Later Phase`
- Surfaces to build or confirm:
  - dedicated pre-listing landing page if needed
  - dedicated approved-for-publish queue page if needed
  - dedicated stale listing page if needed
  - dedicated sold-ready page if needed
  - shipped-history page if needed

## Phase 1 Audit Outcome
- `Done`: the current Inventory, workflow detail, approval, notification, and dashboard surfaces are aligned with the approved Phase 1 workflow model.
- `Later Phase`: the main remaining UI alignment work is for surfaces that are planned but not yet implemented.
- `Watch`: existing reusable forms should be explicitly re-audited before they become first-class workflow editing surfaces in later phases.

## References
- `docs/used-gear-workflow/ui-surface-map.md`
- `docs/used-gear-workflow/data-model-and-approvals.md`
- `src/components/tabs/AirtableTab.tsx`
- `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- `src/components/approval/listingApprovalTabPanels.ts`
- `src/components/SettingsTab.tsx`
- `src/components/users/UserDetailPanel.tsx`