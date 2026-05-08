## UI Surface Map

This document tracks the app-owned pages, forms, queues, and review surfaces involved in the workflow.

### Purpose
- Map every workflow surface to its phase.
- Prevent missed route/navigation work when new pages are added.
- Keep form, queue, and detail pages aligned with the approved workflow model.

### Existing Surfaces
- `JotformTab` — current inquiry list, Phase 2 reuse point
- `AirtableEmbeddedForm` — current Incoming Gear surface, Phase 2/3 reuse point
- `TestingFormTab` — current testing surface, Phase 3 reuse point
- `PhotosFormTab` — current photo surface, Phase 3 reuse point
- `CombinedListingsApprovalTab` — current listing approval/publish surface, Phase 4/6 reuse point

### Planned Surfaces

#### Phase 2
- [ ] Parking Lot 1 queue page
- [ ] Parking Lot 2 queue page
- [ ] Trash page
- [ ] Manual entry intake page
- [ ] Intake detail/review page for grouped submissions if needed

Proposed route keys, paths, and file targets:
- `parking-lot-1`
	- Path: `/inventory/parking-lot-1`
	- Likely component: `src/components/tabs/ParkingLotOneTab.tsx`
- `parking-lot-2`
	- Path: `/inventory/parking-lot-2`
	- Likely component: `src/components/tabs/ParkingLotTwoTab.tsx`
- `used-gear-trash`
	- Path: `/inventory/trash`
	- Likely component: `src/components/tabs/UsedGearTrashTab.tsx`
- `manual-intake`
	- Path: `/inventory/manual-intake`
	- Likely component: `src/components/tabs/ManualIntakeTab.tsx`
- `submission-review`
	- Path: `/inventory/submission-review/:groupId`
	- Likely component: `src/components/tabs/SubmissionReviewPage.tsx`

Likely shared helpers/services:
- `src/services/parkingLots.ts`
- `src/components/tabs/parking-lots/parkingLotTypes.ts`
- `src/components/tabs/parking-lots/parkingLotColumns.ts`

#### Phase 3
- [x] Testing queue/review support added inside the inventory used-gear workflow surface
- [x] Photography queue/review support added inside the inventory used-gear workflow surface

Proposed route keys, paths, and file targets:
- `testing-queue`
	- Path: `/testing/queue`
	- Likely component: `src/components/tabs/TestingQueueTab.tsx`
- `testing-review`
	- Path: `/testing/review/:recordId`
	- Likely component: `src/components/tabs/TestingReviewPage.tsx`
- `photo-queue`
	- Path: `/photos/queue`
	- Likely component: `src/components/tabs/PhotoQueueTab.tsx`
- `photo-review`
	- Path: `/photos/review/:recordId`
	- Likely component: `src/components/tabs/PhotoReviewPage.tsx`

Implemented Phase 3 surfaces in the current app:
- `inventory workflow detail`
	- Path: `/inventory/workflow/:recordId`
	- Component: `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- `used-gear progress queue`
	- Path: embedded in `/inventory`
	- Component: `src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`
- `pending review grouped queue`
	- Path: embedded in `/inventory`
	- Component: `src/components/tabs/airtable/UsedGearPendingReviewSection.tsx`

#### Phase 4
- [x] Pre-listing review action added inside the inventory workflow detail and progress queue surfaces
- [x] Approved-for-publish rows shown inside the inventory workflow progress queue
- [ ] Listing-prep landing or review detail page if needed

Implemented Phase 4 surfaces in the current app:
- `pre-listing completion action`
	- Path: embedded in `/inventory`
	- Components: `src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`, `src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- `workflow notification preference management`
	- Path: `/account/settings` and `/users/:userId`
	- Components: `src/components/SettingsTab.tsx`, `src/components/users/UserDetailPanel.tsx`
- `used-gear workflow notification routing`
	- Path: global in-app notification system
	- Hook: `src/app/useUsedGearWorkflowNotifications.ts`

Proposed route keys, paths, and file targets:
- `pre-listing`
	- Path: `/listings/pre-listing`
	- Likely component: `src/components/tabs/PreListingReviewTab.tsx`
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
- [ ] Add all new surfaces to `src/auth/pages.ts` as needed.
- [ ] Add all new surfaces to `src/app/appNavigation.ts` as needed.
- [ ] Add all new surfaces to `src/app/AppTabContent.tsx` as needed.
- [ ] Confirm auth access behavior for each new route.
- [ ] Confirm direct-link behavior for each new route.
- [ ] Update docs for each new surface added.

### Initial Route Wiring Proposal
- Add proposed Phase 2 route keys to `APP_PAGES` and `PAGE_DEFINITIONS` only when implementation begins.
- Treat the new parking-lot and trash pages as Inventory Processing pages, not top-level unrelated tabs.
- Keep detail/review pages directly routable so queue selection can open a specific grouped submission or record review page.
- Preserve direct activation of existing forms by record id, and extend the same pattern to queue/review pages where useful.
