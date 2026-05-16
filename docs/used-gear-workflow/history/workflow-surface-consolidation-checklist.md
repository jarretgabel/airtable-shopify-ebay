# Historical: Workflow Surface Consolidation Checklist

> Historical reference only. This document records the implementation checklist for the retired workflow-surface consolidation effort and should not be used as the source of truth for new tasks. Use the docs in the parent folder for current guidance.

This checklist tracks the filesystem work required to deliver the workflow surface consolidation plan.

## Tracking Rules
- Mark an item complete only when code, tests, and relevant docs for that item are finished.
- If a step is intentionally deferred, leave it unchecked and add a note in the related pull request or implementation log.
- Keep this checklist updated as files are added, removed, or repurposed.
- Keep implementation lean: avoid adding extra workflow surfaces, abstractions, or UI complexity beyond the required intake, processing, listing, and lifecycle steps.
- Reuse the intake page template and shared page-shell patterns for other workflow pages where practical instead of inventing new page layouts.
- Keep this checklist aligned with `docs/used-gear-workflow/original-requirements.md`; if a change alters workflow boundaries or assumptions from that file, stop and get explicit approval before proceeding.
- Do not add or rely on new Airtable fields as part of this consolidation work without explicit approval.
- Do not modify the live JotForm or introduce new external-system automations as part of these checklist items.

## 1. Testing Form Owns Testing Completion
- [x] Update `src/services/testingForm.ts` so workflow-owned form submits write `Testing Signed By` and `Testing Signed At`.
- [x] Add or update unit tests in `tests/unit/src/services/testingForm.test.ts` for workflow signoff writes.
- [x] Confirm `src/components/tabs/TestingFormTab.tsx` and any save flows do not rely on workflow-detail completion buttons.

## 2. Photos Form Remains The Only Photography Completion Surface
- [x] Confirm `src/services/photosForm.ts` remains the authoritative path for workflow photography signoff writes.
- [x] Keep or extend tests in `tests/unit/src/services/photosForm.test.ts` covering workflow signoff writes.

## 3. Remove Duplicate Completion Actions From Workflow Detail
- [x] Remove testing completion actions from `src/components/tabs/UsedGearWorkflowRecordPage.tsx`.
- [x] Remove photography completion actions from `src/components/tabs/UsedGearWorkflowRecordPage.tsx`.
- [x] Update `tests/unit/src/components/tabs/UsedGearWorkflowRecordPage.test.tsx` to reflect the new behavior.

## 4. Preserve And Strengthen Testing Overview Page
- [ ] Keep the testing overview route in `src/app/AppTabContent.tsx`.
- [ ] Keep the testing queue tab wiring in `src/components/tabs/UsedGearWorkflowQueueTab.tsx` or replace it with a stronger testing directory surface.
- [ ] Reuse the intake page template structure for the testing overview page where it fits the processing workflow.
- [ ] Ensure testing overview supports filtering, sorting, search, grouped context, and URL-backed state.
- [ ] Update any related queue logic in `src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`.
- [ ] Update tests covering testing overview behavior.

## 5. Preserve And Strengthen Photography Overview Page
- [ ] Keep the photography overview route in `src/app/AppTabContent.tsx`.
- [ ] Keep the photography queue tab wiring in `src/components/tabs/UsedGearWorkflowQueueTab.tsx` or replace it with a stronger photography directory surface.
- [ ] Reuse the intake page template structure for the photography overview page where it fits the processing workflow.
- [ ] Ensure photography overview supports filtering, sorting, search, grouped context, and URL-backed state.
- [ ] Update any related queue logic in `src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`.
- [ ] Update tests covering photography overview behavior.

## 6. Enforce Downstream Holding Before Listings
- [ ] Define the downstream post-intake parking lot behavior in code and docs so accepted rows clearly move into a shared testing-and-photography holding stage.
- [ ] Decide whether that downstream parking lot is represented by existing workflow states and queue pages or by a newly named queue surface.
- [ ] Confirm accepted parking-lot rows route into downstream testing-and-photography work rather than Listings.
- [ ] Update routing or target generation in `src/services/usedGearQueue.ts` as needed.
- [ ] Update queue summaries, notifications, and deep-link targets that currently imply pre-listing belongs outside Listings.
- [ ] Update tests in `tests/unit/src/services/usedGearQueue.test.ts` for the new target behavior.

## 7. Restrict Listings To Post-Testing And Post-Photography Rows
- [x] Update listing-surface visibility logic in `src/services/usedGearWorkflowListingVisibility.ts` so Listings begins at the listing phase.
- [x] Ensure `Testing and Photography In Progress` rows do not appear in listing directory views.
- [x] Treat `Awaiting Pre-Listing Review` as the first listing-phase state shown in Listings.
- [x] Update tests in `tests/unit/src/services/usedGearWorkflowListingVisibility.test.ts`.

## 8. Move Pre-Listing Review Modules Into Listing Pages
- [x] Add a listing queue bucket for `Awaiting Pre-Listing Review` rows in `src/components/approval/ListingApprovalQueuePanel.tsx` and related props builders.
- [ ] Reuse the intake page template structure for listing-phase directory and selected-record surfaces where it fits the listing workflow.
- [x] Move reviewer-and-pricing gate UI out of `src/components/tabs/UsedGearWorkflowRecordPage.tsx` and into the listing selected-record experience.
- [ ] Extend `src/components/approval/ListingApprovalSelectedRecordPanel.tsx` as the selected-record home for pre-listing review modules.
- [x] Keep explicit approve-for-publish actions and workflow summary behavior intact.
- [x] Update approval-related tests, including:
  - `tests/unit/src/components/approval/ListingApprovalQueuePanel.test.tsx`
  - `tests/unit/src/components/approval/listingApprovalTabPanels.test.ts`
  - any selected-record panel tests affected by the new modules

## 9. Remove Dedicated Pre-Listing Page Wiring
- [x] Remove the `pre-listing-queue` route rendering from `src/app/AppTabContent.tsx`.
- [x] Remove `pre-listing-queue` from `src/app/appNavigation.ts`.
- [x] Remove the `/workflow/pre-listing` mapping from `src/app/useAppRouteState.ts`.
- [x] Remove dedicated `pre-listing-queue` handling from `src/app/useAuthRouteGuard.ts`.
- [x] Remove `pre-listing-queue` from `src/auth/pages.ts`.
- [x] Update route and navigation tests, including:
  - `tests/unit/src/app/AppTabContent.test.tsx`
  - `tests/unit/src/app/appShellNav.test.ts`
  - `tests/unit/src/app/useAuthRouteGuard.test.tsx`

## 10. Update Notifications And Workflow Shortcuts
- [x] Repoint pre-listing workflow notifications in `src/app/useUsedGearWorkflowNotifications.ts` from `pre-listing-queue` to Listings.
- [x] Update any summary target generation in `src/services/usedGearQueue.ts` that still produces `pre-listing-queue` links.
- [ ] Preserve per-user in-app notification configurability while repointing workflow notifications.
- [x] Update notification tests and queue-target tests.

## 11. Update Dashboard Actions And Insights
- [x] Update dashboard action routing in `src/components/dashboard/DashboardActionsSection.tsx`.
- [x] Update dashboard insights and overview modules in `src/components/dashboard/DashboardOverviewInsightsSection.tsx`.
- [x] Ensure processor-facing overview still highlights the right next work without depending on a dedicated pre-listing page.
- [x] Update dashboard tests, including:
  - `tests/unit/src/components/dashboard/DashboardActionsSection.test.tsx`
  - `tests/unit/src/components/dashboard/DashboardOverviewInsightsSection.test.tsx`

## 12. Update Page Access And Shared Access Models
- [x] Remove `pre-listing-queue` from frontend role access definitions in `src/auth/roleAccess.ts` when the route is fully retired.
- [x] Update page groupings in `src/components/users/userPageAccessGroups.ts`.
- [x] Update app-frame navigation groupings in `src/components/app/AppFrameHeaderNavigation.tsx`.
- [x] Update shared app pages in `aws/src/shared/appPages.ts`.
- [x] Update shared access requirements in `aws/src/shared/access.ts`.
- [x] Update related tests, including:
  - `tests/unit/aws/src/shared/appPages.test.ts`
  - `tests/unit/aws/src/shared/access.test.ts`
  - `tests/unit/aws/src/providers/auth/users.test.ts`
  - `tests/unit/aws/src/handlers/airtable/upsertConfiguredRecord.test.ts`
  - `tests/unit/src/stores/auth/authContextHelpers.test.ts`

## 13. Reorganize Navigation To Match Workflow Order
- [x] Reorder workflow navigation to reflect `Intake > Processing > Listing`.
- [x] Place intake-owned pages before processing-owned pages in app navigation.
- [x] Place Testing and Photography overview pages before Listings in app navigation.
- [x] Remove any legacy nav ordering that no longer matches the workflow sequence.
- [x] Update navigation-related tests, including `tests/unit/src/app/appShellNav.test.ts` and any header-navigation tests.

## 14. Reassess Workflow Detail Page
- [x] Decide whether `src/components/tabs/UsedGearWorkflowRecordPage.tsx` remains as an audit-only page or is fully retired.
- [x] If retained, remove any remaining ownership over testing completion, photography completion, or pre-listing review.
- [x] If workflow detail is removed, preserve equivalent in-app direct-link and audit/history access for the remaining operational surfaces.
- [x] If retired, remove route entry points and update all tests and navigation references.

## 15. Update Documentation
- [x] Update `docs/used-gear-workflow/operator-guide.md` to describe the new surface ownership.
- [ ] Update `docs/used-gear-workflow/phase-3-processing-and-handoffs.md` for directory-page ownership and form-only completion.
- [ ] Update `docs/used-gear-workflow/phase-4-pre-listing-and-publish-readiness.md` so listing review begins at `Awaiting Pre-Listing Review` inside Listings.
- [ ] Update workflow docs to explicitly describe the downstream post-intake parking lot between intake approval and listing-phase entry.
- [ ] Update workflow docs to explicitly describe the new navigation order `Intake > Processing > Listing`.
- [ ] Update workflow docs to explicitly describe reuse of the intake page template across processing and listing surfaces where applicable.
- [ ] Confirm workflow docs still preserve original requirements for manual-entry parity, grouped intake handling, pricing/allocation behavior, and customer-versus-internal note separation.
- [x] Update `docs/used-gear-workflow/ui-surface-map.md`.
- [x] Update `docs/used-gear-workflow/release-smoke-test-checklist.md`.
- [ ] Update `src/components/tabs/workflowGuideContent.ts` and any workflow guide tests.

## 16. Validation
- [x] Run targeted unit tests for changed services and components.
- [x] Run route and navigation tests affected by page removal.
- [x] Run dashboard and auth/access tests affected by the routing change.
- [x] Run `npm run build` after meaningful milestones.
- [x] Update this checklist as each implementation slice lands.

## Suggested Execution Order
- [ ] Slice 1: Testing form signoff writes plus removal of duplicate testing and photography completion actions.
- [ ] Slice 2: Strengthen Testing and Photography overview pages where needed.
- [ ] Slice 3: Add listing-phase queue buckets and migrate pre-listing review modules into listing pages.
- [x] Slice 4: Repoint notifications and dashboard shortcuts from `pre-listing-queue` to Listings.
- [ ] Slice 5: Reorganize navigation into `Intake > Processing > Listing` order.
- [x] Slice 6: Remove the dedicated pre-listing route, tab, and page-access references.
- [x] Slice 7: Clean up workflow detail, docs, and smoke-test coverage.

## Related Files
- Plan: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/workflow-surface-consolidation-plan.md`
