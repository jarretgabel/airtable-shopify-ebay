## Phase 3: Processing Stages And Handoffs

This phase carries the authoritative item record through processing with customer and internal data clearly separated.

### Goals
- Drive Incoming Gear, Testing, and Photos from the same authoritative row.
- Preserve customer-submitted reference data separately from staff-assessment data.
- Add explicit handoff, validation, and notification behavior between teams.
- Allow Testing and Photos to proceed concurrently after processing instead of forcing a linear stage order.

### Scope
1. Prepopulate Incoming Gear, Testing, and Photos from the primary Airtable row.
2. Display customer-submitted information as reference data while preserving separate staff-assessment fields.
3. Add explicit stage completion metadata, signatures, and dates for processing, testing, and photography.
4. Generate in-app next-team notifications when a stage is completed, with explicit routing for Purchasing, Processing & Testing, Photography, Listing, and Shipping teams as the workflow advances.
5. Enforce photo-stage completion requirements, including uploads and any required confirmations.
6. Make the photo stage explicitly display Make, Model, Component Type, Inventory Notes, inclusion list, and auxiliary/testing photos as photographer context.
7. Make Box, Remote, Manual, and Additional Items visually loud in the photo stage and require explicit confirmation that those items were checked and photographed when applicable.
8. Allow testing and photography to happen concurrently and transition the record into `Awaiting Pre-Listing Review` only after both stages are complete.
9. Add any missing processing-stage forms or review pages needed to make the handoff flow coherent, such as a testing queue page, a photography queue page, or item detail/review pages that sit between the queue and the form when that improves usability.
10. Add stage-specific validation and incomplete-state messaging so teams know exactly why a record cannot advance.
11. Preserve unsaved changes protection and safe navigation behavior across the new queue-to-form flows.
12. Wire any new processing pages into app navigation, route definitions, and direct-link activation by record id or SKU.

### Dependencies
- Phase 2 queue navigation and record selection model in place.

### Deliverables
- Updated Incoming Gear form behavior.
- Updated Testing form behavior.
- Updated Photos form behavior.
- Used-gear workflow progress queue, dedicated testing/photography queue pages, and workflow detail page.
- Team-specific notification routing between stages.

### Exit Criteria
- Each form stage reads from the same authoritative row.
- Customer vs internal data is visibly separated.
- Stage completion updates status and next-team notifications without forcing testing and photography into a linear order.
- Team-specific in-app notification routing is explicit for each handoff.
- The photo stage enforces the required media and inclusion confirmations, and the workflow transitions records to `Awaiting Pre-Listing Review` only after both testing and photography are complete.
- Processing-stage validation and navigation behavior are robust enough for daily operational use.
- Processing teams have the forms and supporting pages needed to move an item through the workflow entirely inside the app.
- Processing-stage queue work can be shared quickly through a direct queue link from the app UI.

### Implemented Queue Operations
- The used-gear processing and stage queue now includes a copy-link action that copies a direct link to the workflow progress queue anchor inside Inventory for quick teammate handoff.
- Testing, photography, and pre-listing now also have dedicated queue pages with their own URL-backed search, sort, collapse, and focused-group state.
- Progress-queue search state now syncs into the Inventory URL so shared links preserve the active queue search.
- Progress-queue grouped submissions can now be collapsed, and that collapsed-group state also syncs into the Inventory URL so copied links preserve the current working layout.
- Progress-queue operators can now collapse or expand every visible group in one action when sharing or restoring a working layout.
- Progress-queue sort mode now persists in the Inventory URL, and the active workflow-summary chips can clear progress search, sort, or collapsed-group state individually.
- Incoming Gear, Testing, and Photos now all load from the authoritative workflow row when available, with inventory-directory fallback kept only for non-workflow records.
- Testing and Photos now render customer-submitted cosmetic, functional, inclusion, and submitted-photo notes as a separate intake-reference panel so staff assessments stay distinct from customer-provided context.
- Testing and Photos now save edits and attachment uploads back through the same configured source they were loaded from, so workflow-opened forms stay on the workflow write path end to end.
- The Photos form now shows explicit photography context for Make, Model, Component Type, Inventory Notes, Testing Notes, inclusion items, and existing workflow images so photographers can work from one operational surface.
- Included items such as Original Box, Manual, Remote, Power Cable, and Additional Items are now visually emphasized in the photo stage when applicable, and the form requires explicit confirmation that each applicable item was checked and photographed before submit.
- Photo-stage completion validation now accepts either newly uploaded images or existing workflow images, and blocks submit until required included-item confirmations are complete.
- Processing, Testing, and Photography completion actions now emit explicit in-app handoff notifications based on the resulting workflow row so operators see whether the item is moving to concurrent stage work, the remaining concurrent team, or pre-listing review.

### Relevant Files
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/AirtableEmbeddedForm.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/incoming-gear/incomingGearFormSchema.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/incomingGearForm.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/TestingFormTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/testingForm.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/PhotosFormTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/photosForm.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/UsedGearWorkflowQueueTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/usedGearQueue.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/useActionGuidanceNotifications.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/AppTabContent.tsx`

### Checklist
- [x] Prepopulate Incoming Gear from the authoritative Airtable row.
- [x] Prepopulate Testing from the authoritative Airtable row.
- [x] Prepopulate Photos from the authoritative Airtable row.
- [x] Add any needed testing queue or testing review pages.
- [x] Add any needed photography queue or photography review pages.
- [x] Separate customer-submitted reference data from staff-assessment data in all processing stages.
- [x] Add processing-stage signature and date capture.
- [x] Add testing-stage signature and date capture.
- [x] Add photography-stage signature and date capture.
- [x] Allow testing and photography to be worked concurrently from the same authoritative row.
- [x] Route in-app notifications explicitly to the correct next team at each stage handoff.
- [x] Make the photo stage display Make, Model, Component Type, Inventory Notes, inclusion list, and auxiliary/testing photos as context.
- [x] Make Box, Remote, Manual, and Additional Items visually prominent in the photo stage when applicable.
- [x] Require explicit confirmation that applicable included items were checked and photographed.
- [x] Add in-app next-team notifications for stage completion.
- [x] Enforce photo-stage completion requirements before submit.
- [x] Transition records to `Awaiting Pre-Listing Review` only after both testing and photography are complete.

### Backlog
- [ ] Add a compact stage timeline so operators can see processing, testing, and photography handoffs in one audit view.
- [x] Add stronger queue-level SLA or aging indicators for rows stuck in processing, testing, or photography.
- [x] Add direct deep links from workflow notifications to the most relevant queue group or record.
- [x] Add clearer blocked-state messaging that links straight to the missing field or confirmation inside the active form.
- [ ] Add optional team landing views if the shared Inventory workflow surface becomes too dense for daily processing work.
