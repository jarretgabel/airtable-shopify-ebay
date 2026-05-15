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
  - supports URL-backed search, collapse, sort, focused-group state, and copy-link behavior
  - supports batch accept and batch trash actions for grouped submissions

### Parking Lot 2 Queue
- Status: `Done`
- Surface:
  - `src/components/tabs/airtable/UsedGearLotTwoSection.tsx`
- Alignment:
  - surfaces accepted arrival-stage rows before full workflow processing
  - supports shared URL-backed queue state for search and triage

### Trash Queue
- Status: `Done`
- Surface:
  - `src/components/tabs/airtable/UsedGearTrashSection.tsx`
- Alignment:
  - surfaces unqualified rows retained in active trash
  - supports restore, re-qualify, and permanent delete actions

### Group Review Page
- Status: `Done`
- Surface:
  - `src/components/tabs/UsedGearPendingReviewGroupPage.tsx`
- Alignment:
  - supports grouped submission review, shared totals, and Lot 2 acceptance for multi-row intake

### Progress Queue
- Status: `Done`
- Surface:
  - `src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`
- Alignment:
  - supports processing, testing, photography, and pre-listing progression
  - shows approved-for-publish rows in the same workflow flow
  - exposes readiness context needed before publish handoff
  - supports focused-group share links for grouped submission collaboration

### Workflow Detail Page
- Status: `Done`
- Surface:
  - `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- Alignment:
  - routable at `/inventory/workflow/:recordId`
  - loads a single workflow row from the configured source
  - exposes stage actions, workflow summary, and listing-readiness context
  - surfaces grouped sibling-row context when the row belongs to a shared submission or pickup

### Post-Publish Queue
- Status: `Done`
- Surface:
  - `src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.tsx`
- Alignment:
  - bucketed lifecycle view for listed, stale, sold-ready, and shipped rows
  - supports URL-backed search, collapse, sort, focused bucket, history filtering, and share-link behavior

### Workflow Shell Navigation
- Status: `Done`
- Surface:
  - `src/components/tabs/AirtableTab.tsx`
- Alignment:
  - sticky workflow summary chips remain visible while scrolling long queue sections
  - named workflow presets restore current queue state
  - keyboard shortcuts jump directly between workflow sections without leaving Inventory

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
  - dashboard actions now emphasize queue entry points by role for processor, tester, and photographer dashboards
  - post-publish dashboard actions deep-link into the correct owner-aware bucket, preferring `mine` when the current user already owns work and `unassigned` when work is ready to claim

## Existing Reuse Surfaces To Re-Check Later

### JotformTab
- Status: `Done`
- Surface:
  - `src/components/tabs/JotformTab.tsx`
- Alignment:
  - now acts as the raw JotForm source feed only
  - remains a utility/reference surface separate from workflow triage
- Constraint:
  - no live JotForm changes in Phase 1

### Parking Lot 1 Intake Page
- Status: `Done`
- Surface:
  - `src/components/tabs/ParkingLotOneTab.tsx`
- Alignment:
  - owns workflow-only pending review triage
  - supports URL-backed intake queue state and grouped-review handoff into the dedicated group page

### AirtableEmbeddedForm / Incoming Gear Form
- Status: `Done`
- Surface:
  - `src/components/tabs/AirtableEmbeddedForm.tsx`
  - `src/services/incomingGearForm.ts`
- Alignment:
  - remains the arrival/update surface for workflow rows
  - loads from the authoritative workflow row when available

### TestingFormTab
- Status: `Done`
- Surface:
  - `src/components/tabs/TestingFormTab.tsx`
  - `src/services/testingForm.ts`
- Alignment:
  - uses the authoritative workflow row for processing-stage context and signoff follow-through

### PhotosFormTab
- Status: `Done`
- Surface:
  - `src/components/tabs/PhotosFormTab.tsx`
  - `src/services/photosForm.ts`
- Alignment:
  - uses the authoritative workflow row for photo-stage context, image reference checks, and signoff follow-through

## Later-Phase Surfaces Not Yet Implemented

### Intake And Parking-Lot Pages
- Status: `Done`
- Surfaces to build or confirm:
  - implemented through `JotformTab`, `UsedGearLotTwoSection`, `UsedGearTrashSection`, and `UsedGearPendingReviewGroupPage`

### Additional Listing And Lifecycle Pages
- Status: `Later Phase`
- Surfaces to build or confirm:
  - dedicated pre-listing landing page if needed
  - dedicated approved-for-publish queue page if needed
  - dedicated stale listing page if needed
  - dedicated sold-ready page if needed
  - shipped-history page if needed

## Audit Outcome
- `Done`: the current Inventory, intake, workflow detail, approval, notification, dashboard, and post-publish surfaces are aligned with the implemented workflow through Phases 1-5.
- `Later Phase`: only optional dedicated landing pages and marketplace-expansion surfaces remain outside the current audit.
- `Watch`: marketplace-specific persistence and any future dedicated ownership surfaces still need re-audit if approved later.

## References
- `docs/used-gear-workflow/ui-surface-map.md`
- `docs/used-gear-workflow/data-model-and-approvals.md`
- `docs/used-gear-workflow/operator-guide.md`
- `docs/used-gear-workflow/publish-writeback-behavior.md`
- `src/components/tabs/AirtableTab.tsx`
- `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- `src/components/approval/listingApprovalTabPanels.ts`
- `src/components/SettingsTab.tsx`
- `src/components/users/UserDetailPanel.tsx`