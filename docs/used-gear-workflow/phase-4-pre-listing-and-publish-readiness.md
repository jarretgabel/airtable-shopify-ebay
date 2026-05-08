## Phase 4: Pre-Listing And Publish Readiness

This phase adds the operational review step that bridges processing into the existing listing editors.

### Goals
- Create an explicit pre-listing operational review step.
- Prefill the listing editors as much as possible.
- Make reviewer/pricing confirmation explicit before publish.

### Scope
1. Add a queue-aware pre-listing review surface.
2. Consolidate data from prior stages for final review and correction.
3. Prefill the existing Shopify/eBay listing approval/editing workflow with as much known information as possible from intake, processing, testing, and photography stages.
4. Route approved records into the existing Shopify/eBay listing approval/editing workflow.
5. Set `APPROVED FOR PUBLISH` state and reviewer metadata before final publishing.
6. Capture the final pricing/reviewer confirmation step so the designated reviewer can confirm pricing and publish readiness before release to market.
7. Add any missing listing-prep pages that improve operational clarity, such as an approved-for-publish queue, review detail page, or listing-prep landing page if the existing approval screens are not sufficient on their own.
8. Define how listing-prep corrections write back to the authoritative Airtable row so downstream listing data stays consistent.
9. Wire any new listing-prep pages into app navigation, route definitions, and direct-link handling.

### Dependencies
- Phase 3 completion with `Awaiting Pre-Listing Review` transition.

### Deliverables
- Pre-listing review page.
- Approved-for-publish queue or equivalent landing page if needed.
- Listing prefill rules.
- Reviewer/pricing confirmation flow.
- Workflow handoff summary inside the combined listing approval surface.
- In-app workflow notification preference routing for queue-stage alerts.

### Exit Criteria
- Pre-listing review exists as a distinct operational step.
- Records hand off correctly into the current approval/publish flow.
- Listing approval surfaces retain enough workflow context that the listing team can confirm what was approved before publish.
- Listing editors are prefilled as much as possible before manual completion.
- Final reviewer/pricing confirmation is an explicit step before publish.
- Listing-prep edits flow back to the authoritative row consistently.
- Listing teams have enough dedicated app pages to review, queue, and hand off items without relying on Airtable views directly.

### Relevant Files
- `/Users/user/Sites/airtable-shopify-ebay/src/components/approval/CombinedListingsApprovalTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/approval/ListingApprovalSelectedRecordPanel.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/approval/ListingApprovalSelectedRecordView.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/approval/ListingApprovalWorkflowSummary.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/approval/useListingApprovalPublishActions.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/AppTabContent.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/appNavigation.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/inventoryDirectory.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/airtable/UsedGearWorkflowProgressSection.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/UsedGearWorkflowRecordPage.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/SettingsTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/UserManagementTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/useUsedGearWorkflowNotifications.ts`

### Checklist
- [x] Build a queue-aware pre-listing review surface.
- [x] Add an approved-for-publish state inside the existing inventory workflow queue surface.
- [x] Consolidate prior-stage data for final review and correction.
- [x] Prefill Shopify/eBay listing editors with as much known data as possible.
- [x] Route approved-for-publish records into the existing Shopify/eBay listing approval flow.
- [x] Add `APPROVED FOR PUBLISH` status and reviewer metadata handling.
- [x] Add final reviewer/pricing confirmation before publish.
- [x] Show workflow review context inside the combined listing approval surface and final publish confirmation.
- [x] Add in-app workflow notification recipient preferences on user accounts.

### Implemented Prefill Rules
- When listing title fields are blank, hydrate them from the existing title if present, otherwise from `Make + Model` with `Component Type` as the fallback.
- When listing description fields are blank, hydrate them from `Inventory Notes`.
- When key-feature fields are blank, hydrate them from `Make`, `Model`, `Component Type`, cosmetic notes, and inclusion notes.
- When testing-note fields are blank, hydrate them from functional notes, inclusion notes, and cosmetic notes.
- Existing listing-editor values continue to win over workflow-derived prefills so manual listing edits are not overwritten on open.

### Implemented Review Gate
- Rows in `Awaiting Pre-Listing Review` now route into the workflow detail page for explicit review instead of allowing inline approval directly from the queue card.
- The workflow detail page now consolidates listing title, description, price, signoffs, and internal notes into a single pre-listing readiness panel.
- `Approve For Publish` is disabled until the reviewer explicitly confirms pricing and content review in-app.
- The service layer now blocks the status transition to `Approved for Publish` when no listing price has been captured on the row.

### Implemented Approval Handoff Context
- The combined listing approval selected-record view now shows a workflow summary block so the listing team can see the workflow status, resolved title, resolved description, resolved price, price source, and pre-listing reviewer without leaving the approval screen.
- Final publish confirmation now repeats the workflow status, resolved title, and resolved price alongside the existing marketplace confirmation copy so the last publish step uses the same readiness context that was approved in the workflow detail page.

### Implemented Publish Lifecycle Writeback
- Successful publish actions now write lifecycle state back to the authoritative workflow row so `Workflow Status` advances from `Approved for Publish` into the listed workflow family.
- The first successful publish writeback now captures `Listed At`, and Shopify publishes also populate `Shopify REST Published At` and `Shopify REST Published Scope` using the existing approved Airtable fields.
- eBay publishes now also persist `eBay Published At`, `eBay Offer ID`, and `eBay Listing ID` on the workflow row using the approved workflow schema.
- Workflow transition timestamps now capture `Awaiting Pre-Listing Review At` when the second concurrent signoff lands and `Approved For Publish At` when pre-listing review is completed.

### Backlog
- [ ] Add a more explicit approved-for-publish landing page if listing volume makes the shared progress queue too noisy.
- [x] Add operator-facing explanations for why publish readiness is blocked, with jump links to the listing or workflow field that needs review.
- [ ] Add richer workflow-to-listing diff summaries so the listing team can see what changed since pre-listing approval.
- [x] Add workflow-specific smoke tests for publish handoff and writeback so future approval-surface changes are easier to validate.
- [ ] Add more granular reviewer analytics for how long rows spend waiting for pre-listing review or publish completion.
