## UI Surface Map

This document tracks the app-owned pages, forms, queues, and review surfaces involved in the workflow.

### Purpose
- Map every workflow surface to its phase.
- Prevent missed route/navigation work when new pages are added.
- Keep form, queue, and detail pages aligned with the approved workflow model.

### Existing Surfaces
- `JotformTab` — raw submission feed and source-reference page
- `AirtableEmbeddedForm` — current Manual Intake surface, Phase 2/3 reuse point
- `TestingFormTab` — current testing surface, Phase 3 reuse point
- `PhotosFormTab` — current photo surface, Phase 3 reuse point
- `CombinedListingsApprovalTab` — current listing approval/publish surface, Phase 4/6 reuse point

### Planned Surfaces

#### Phase 2
- [x] Parking Lot 1 queue page
- [x] Parking Lot 2 queue page
- [x] Trash page
- [x] Manual entry intake page
- [ ] Intake detail/review page for grouped submissions if needed

Implemented route keys, paths, and file targets:
- `parking-lot-1`
	- Path: `/parking-lot-1`
	- Component: `src/components/tabs/ParkingLotOneTab.tsx`
- `jotform`
	- Path: `/jotform`
	- Component: `src/components/tabs/JotformTab.tsx`
- `parking-lot-2`
	- Path: `/parking-lot-2`
	- Component: `src/components/tabs/UsedGearLotTwoTab.tsx`
- `parking-lot-2-group-review`
	- Path: `/parking-lot-2/review/:groupId`
	- Component: `src/components/tabs/UsedGearLotTwoGroupPage.tsx`
- `trash-review`
	- Path: `/trash-review`
	- Component: `src/components/tabs/UsedGearTrashTab.tsx`
- `manual-intake`
	- Path: `/inventory/manual-intake`
	- Component: `src/components/tabs/UsedGearManualIntakePage.tsx`
- `submission-review`
	- Path: `/parking-lot-1/review/:groupId`
	- Component: `src/components/tabs/UsedGearPendingReviewGroupPage.tsx`

Likely shared helpers/services:
- `src/services/parkingLots.ts`
- `src/components/tabs/parking-lots/parkingLotTypes.ts`
- `src/components/tabs/parking-lots/parkingLotColumns.ts`

#### Phase 3
- [x] Testing queue page
- [x] Photography queue page

Implemented route keys, paths, and file targets:
- `testing-queue`
	- Path: `/workflow/testing`
	- Component: `src/components/tabs/UsedGearWorkflowQueueTab.tsx`
- `testing-review`
	- Path: `/testing/:recordId`
	- Component: `src/components/tabs/TestingFormTab.tsx`
- `photo-queue`
	- Path: `/workflow/photography`
	- Component: `src/components/tabs/UsedGearWorkflowQueueTab.tsx`
- `photo-review`
	- Path: `/photos/:recordId`
	- Component: `src/components/tabs/PhotosFormTab.tsx`

Implemented Phase 3 surfaces in the current app:
- `used-gear progress queue`
	- Path: embedded in `/inventory`
	- Component: `src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`
- `used-gear testing queue`
	- Path: `/workflow/testing`
	- Component: `src/components/tabs/UsedGearWorkflowQueueTab.tsx`
- `used-gear photography queue`
	- Path: `/workflow/photography`
	- Component: `src/components/tabs/UsedGearWorkflowQueueTab.tsx`
- `pending review grouped queue`
	- Path: `/parking-lot-1/review/:groupId`
	- Component: `src/components/tabs/UsedGearPendingReviewGroupPage.tsx`
- `parking lot 2 grouped handoff`
	- Path: `/parking-lot-2/review/:groupId`
	- Component: `src/components/tabs/UsedGearLotTwoGroupPage.tsx`

#### Phase 4
- [x] Listing review begins in Combined Listings at `Awaiting Pre-Listing Review`
- [x] Approved-for-publish rows shown inside the inventory workflow progress queue
- [ ] Listing-prep landing or review detail page if needed

Implemented Phase 4 surfaces in the current app:
- `listings review bucket`
	- Path: `/listings/:recordId`
	- Component: `src/components/approval/CombinedListingsApprovalTab.tsx`
- `approve-for-publish action`
	- Path: `/listings/:recordId`
	- Components: `src/components/approval/ListingApprovalRecordActions.tsx`, `src/components/approval/ListingApprovalSelectedRecordPanel.tsx`
- `workflow audit and lifecycle context in Listings`
	- Path: `/listings/:recordId`
	- Component: `src/components/approval/ListingApprovalWorkflowOpsPanel.tsx`
- `workflow notification preference management`
	- Path: `/account/settings` and `/users/:userId`
	- Components: `src/components/SettingsTab.tsx`, `src/components/users/UserDetailPanel.tsx`
- `used-gear workflow notification routing`
	- Path: global in-app notification system
	- Hook: `src/app/useUsedGearWorkflowNotifications.ts`

Implemented route keys, paths, and file targets:
- `approved-for-publish`
	- Path: `/listings/approved-for-publish`
	- Likely component: `src/components/tabs/ApprovedForPublishQueueTab.tsx`
- `listing-prep-review`
	- Path: `/listings/prep/:recordId`
	- Likely component: `src/components/tabs/ListingPrepReviewPage.tsx`

#### Phase 5
- [ ] Stale listing queue or review page if needed
- [ ] Sold-ready-to-ship queue if needed
- [ ] Shipped-history lookup page if needed

Proposed route keys, paths, and file targets:
- `stale-listings`
	- Path: `/listings/stale`
	- Likely component: `src/components/tabs/StaleListingsTab.tsx`
- `sold-ready-to-ship`
	- Path: `/inventory/sold-ready-to-ship`
	- Likely component: `src/components/tabs/SoldReadyToShipTab.tsx`
- `shipped-history`
	- Path: `/inventory/shipped-history`
	- Likely component: `src/components/tabs/ShippedHistoryTab.tsx`

### Route And Navigation Checklist
- [x] Add all new surfaces to `src/auth/pages.ts` as needed.
- [x] Add all new surfaces to `src/app/appNavigation.ts` as needed.
- [x] Add all new surfaces to `src/app/AppTabContent.tsx` as needed.
- [x] Confirm auth access behavior for each new route.
- [x] Confirm direct-link behavior for each new route.
- [x] Update docs for each new surface added.

### Initial Route Wiring Proposal
- Add proposed Phase 2 route keys to `APP_PAGES` and `PAGE_DEFINITIONS` only when implementation begins.
- Treat the new parking-lot and trash pages as Inventory Processing pages, not top-level unrelated tabs.
- Keep detail/review pages directly routable so queue selection can open a specific grouped submission or record review page.
- Preserve direct activation of existing forms by record id, and extend the same pattern to queue/review pages where useful.
