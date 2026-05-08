## Phase 2: Intake And Parking Lots

This phase implements intake triage and queue visibility without yet changing the downstream listing lifecycle.

### Goals
- Turn intake into an app-first workflow.
- Make JotForm and manual entry converge into the same intake model, with both landing in Lot 1 by default unless manual entry is intentionally routed to Lot 2.
- Create dedicated queue pages for Lot 1, Lot 2, and trash.
- Support grouped review, allocation, and routing entirely inside the app.

### Scope
1. Rework the JotForm tab into Parking Lot 1 intake operations with Accept and Unqualified actions, including a clear acceptance gate that requires the qualifying information needed before routing a submission to Lot 2.
2. Build or update the manual entry form so it mimics the JotForm intake structure and captures the same intake-style information wherever practical, while remaining an app-owned internal form.
3. Upgrade manual entry so it can route to Lot 1 by default or directly to Lot 2 in special cases.
4. Build dedicated Parking Lot 1 and Parking Lot 2 queue views with grouping/sorting by submission or pick-up id, arrival date, then make.
5. Support the lot-2 statuses `Awaiting Arrival`, `Arrived, Awaiting SKU`, and `Arrived, Awaiting Item`.
6. Route unqualified submissions into the trash area instead of deleting them immediately.
7. Add item-level offer and paid amount editing at intake review time, including confirmed grand-total allocation with equal split by default and manual per-item override.
8. Add any missing intake-stage pages or forms that make the workflow usable in-app, including a dedicated trash view, a manual-entry intake page, and any parking-lot detail or review page needed to inspect and act on a grouped submission cleanly.
9. Make queue interactions explicit so intake items can be selected by queue row and later activated downstream by SKU or by queue selection.
10. Add restore, re-qualify, and permanent-delete controls for the trash workflow where appropriate.
11. Add queue filters, search, and saved/default sort behavior that make it practical to work the parking lots day to day.
12. Wire any new intake pages into app navigation, route definitions, auth access helpers, and direct-link routing.

### Dependencies
- Phase 1 workflow/status model approved.
- Any new Airtable fields approved before use.

### Deliverables
- Parking Lot 1 queue page.
- Parking Lot 2 queue page.
- Trash page.
- JotForm triage UI.
- JotForm-like internal manual entry page.
- Grouped submission detail/review page if needed.

### Exit Criteria
- Purchasing can triage JotForm submissions from the app.
- Manual entry mirrors the JotForm-style intake experience closely enough that both intake paths produce consistent records.
- Manual entry can be routed to either lot.
- Staff can see both parking lots as dedicated queue views.
- Accepted multi-item submissions support explicit offer/paid handling and editable grand-total allocation.
- Testing and photo stages have a clear activation path by SKU or by selecting a queued item.
- Trash handling supports review, restore or cleanup, and controlled deletion behavior.
- All new intake pages are reachable through the app shell and direct links.
- Staff have the additional intake-stage pages needed to review, route, and clean up submissions without falling back to Airtable directly.
- Pending-review intake work can be shared quickly through a direct queue link from the app UI.

### Implemented Queue Operations
- The former JotForm tab now acts as the Parking Lot 1 intake triage surface, embedding the used-gear pending review queue directly into the intake page while keeping the raw JotForm feed available as source-reference context.
- The intake page now also includes a dedicated Parking Lot 2 queue section for accepted arrival-stage rows so staff can work awaiting-arrival, awaiting-SKU, and awaiting-missing-item records without scanning the broader progress queue.
- The used-gear pending review section now includes a copy-link action that copies a direct link to the pending-review queue anchor inside Inventory for quick teammate handoff.
- Pending-review search state now syncs into the Inventory URL so shared links preserve the active queue search.
- Pending-review grouped submissions can now be collapsed, and that collapsed-group state also syncs into the Inventory URL so copied links preserve the current review layout.
- Pending-review operators can now collapse or expand every visible group in one action when sharing or resetting a review layout.
- Pending-review sort mode now persists in the Inventory URL, and the active workflow-summary chips can clear pending-review search, sort, or collapsed-group state individually.
- Pending-review acceptance now requires qualification notes before a row can leave Parking Lot 1, and staff must choose the correct Lot 2 destination (`Awaiting Arrival`, `Arrived, Awaiting SKU`, or `Arrived, Awaiting Missing Item`) at acceptance time instead of relying on one hardcoded route.
- Parking Lot 1 queue cards now surface offer amount, paid amount, confirmed grand total, and the acceptance gate status so staff can see why a row is or is not ready for Lot 2.
- The Parking Lot 1 page now also includes a dedicated trash-review section for active trash rows so rejected intake work can be reviewed without leaving the intake surface.
- The manual-entry Incoming Gear form now creates new rows through the used-gear workflow source, identifies them as `Manual Entry`, and lets staff route them either into Parking Lot 1 review or directly into Lot 2 accepted-arrival states.
- Manual entry now captures customer-reference intake notes for cosmetic, functional, inclusion, and submitted-photo context so app-owned intake rows can mirror the core JotForm information model more closely before downstream staff corrections happen.
- Parking Lot 2 and trash search filters now persist in the `/jotform` URL, so copied queue links preserve the current intake search context on those sections the same way the Inventory workflow views already do.
- Parking Lot 1 now includes a dedicated grouped review page at `/jotform/review/:groupId` where staff can save item-level offer and paid amounts, apply equal-split grand-total allocation, switch to manual allocation override, and batch-accept the entire group into Lot 2.
- Pending-review sorting now explicitly supports arrival-date and make/model ordering on top of the existing pickup/submission grouping behavior.
- Parking Lot 1 search, collapse state, and sort mode now persist in the `/jotform` URL so copied intake links reopen the page in the same triage configuration and grouped-review links preserve the current route-state context.
- Parking Lot 2 now supports downstream activation by either selecting a queued row or entering an exact SKU, with direct jumps into Incoming Gear, Testing, Photos, or Workflow Detail from the intake page.
- Trash review now supports restoring a row to Parking Lot 1, re-qualifying it back into Lot 2 with an explicit accepted route and qualification notes, or permanently deleting it when cleanup is final.

### Relevant Files
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/JotformTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/hooks/useJotForm.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/app-api/jotform.ts`
- `/Users/user/Sites/airtable-shopify-ebay/aws/src/handlers/jotform/`
- `/Users/user/Sites/airtable-shopify-ebay/aws/src/providers/jotform/client.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/AirtableEmbeddedForm.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/UsedGearPendingReviewGroupPage.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/airtable/UsedGearLotTwoSection.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/airtable/UsedGearTrashSection.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/incoming-gear/incomingGearFormSchema.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/incomingGearForm.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/usedGearQueue.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/airtable/InventoryDirectoryListSection.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/AppTabContent.tsx`

### Checklist
- [x] Rework the JotForm tab into Parking Lot 1 intake operations.
- [x] Add Accept and Unqualified actions with required routing behavior.
- [x] Enforce required qualifying information before routing an accepted item to Lot 2.
- [x] Make the manual entry form mimic the JotForm intake structure and collect equivalent intake information through this app.
- [x] Upgrade manual entry so it can route to Lot 1 or Lot 2.
- [x] Add item-level offer amount editing in intake review.
- [x] Add item-level paid amount editing in intake review.
- [x] Add confirmed grand-total allocation with equal split by default and manual override.
- [x] Build the Parking Lot 1 queue view.
- [x] Build the Parking Lot 2 queue view.
- [x] Build a dedicated trash view for unqualified submissions.
- [x] Add any needed parking-lot detail or review pages for grouped submissions.
- [x] Implement grouping and sorting by submission or pick-up id, arrival date, then make.
- [x] Add lot-2 queue statuses for `Awaiting Arrival`, `Arrived, Awaiting SKU`, and `Arrived, Awaiting Item`.
- [x] Make downstream workflow entry possible by SKU and by queue selection.

### Backlog
- [ ] Add saved queue-view presets for common intake triage filters once the parking-lot pages are stable.
- [ ] Add batch actions for grouped pending-review submissions where one decision should apply to every row in the submission.
- [ ] Add queue aging indicators so intake staff can spot submissions sitting too long in review or arrival states.
- [ ] Add richer grouped-submission summaries that highlight offer allocation, missing qualifying info, and pickup context before opening detail review.
- [ ] Add optional assignment or ownership markers for purchasing work if the team later wants explicit queue ownership beyond audit fields.
- [ ] Add clearer correlation between raw JotForm submissions and their created workflow groups once a reliable source-to-row matching strategy is available in the app.
- [x] Add URL-backed search/share state for Parking Lot 2 and trash sections to match the more advanced Inventory queue behavior.
- [x] Add URL-backed Parking Lot 1 search, sort, and grouped-review deep-link state on `/jotform` so the intake page matches the richer Inventory queue-sharing behavior end to end.
- [x] Add restore, re-qualify, and permanent-delete controls for the trash workflow where appropriate.
