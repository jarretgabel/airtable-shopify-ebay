## Data Model And Approvals

This document is the approval-focused companion to the master workflow plan.

### Purpose
- Record the approved Airtable/workflow data model.
- Record which Airtable field additions were proposed, approved, rejected, or deferred.
- Record grouped-record identity rules, transition guards, and backfill decisions.

### Constraints
- The only Airtable table in direct scope is `tbl0K0nFQL64jQMx8`.
- Any new Airtable fields require explicit user approval before being added or relied on.
- App-owned forms/pages may add site-side fields and controls as needed to remain aligned with the approved data model.
- Any additional tables require separate approval and must be reference-only, not duplicated data stores.

### Sections To Maintain
1. Proposed Airtable fields.
2. Approved Airtable fields.
3. Rejected/deferred Airtable fields.
4. Workflow statuses and allowed transitions.
5. Acceptance-gate requirements for Lot 2 routing.
6. Record identity strategy for submission id, pick-up id, and per-item row id.
7. Offer amount vs paid amount behavior.
8. Grand-total allocation rules.
9. Backfill/normalization plan for existing rows.

### Initial Open Items
- [x] Finalize the proposed Airtable field list.
- [x] Get approval for any new Airtable fields before implementation.
- [x] Finalize workflow statuses and transition guards.
- [x] Finalize grouped-record identity rules.
- [x] Finalize offer/paid/allocation behavior.
- [x] Finalize backfill/normalization strategy.

### Draft Proposal Status
- [x] Draft initial field/status proposal for review.
- [x] Draft initial grouped-record identity proposal for review.
- [x] Draft initial offer/paid/allocation proposal for review.
- [x] Convert this draft into the approved implementation model.

### Approval Checklist

Use this checklist to approve, reject, or revise the proposed Airtable/workflow model one decision at a time.

#### Workflow And Routing Fields
- [x] Approve `Workflow Source`
- [x] Approve `Submission Group ID`
- [x] Approve `Pick Up ID`
- [x] Approve `Trash Status`

#### Workflow Ownership And Handoff Fields
- [x] Approve `Workflow Owner`
- [x] Approve `Workflow Owner Assigned At`
- [x] Approve `Accepted By`
- [x] Approve `Accepted At`
- [x] Approve `Processing Signed By`
- [x] Approve `Processing Signed At`
- [x] Approve `Testing Signed By`
- [x] Approve `Testing Signed At`
- [x] Approve `Photography Signed By`
- [x] Approve `Photography Signed At`
- [x] Approve `Pre-Listing Reviewed By`
- [x] Approve `Pre-Listing Reviewed At`

#### Acceptance Gate And Qualification Fields
- [x] Approve `Qualification Notes`
- [x] Approve `Qualification Complete`
- [x] Approve `Unqualified Reason`

#### Customer-Submitted Reference Fields
- [x] Approve `Customer Cosmetic Notes`
- [x] Approve `Customer Functional Notes`
- [x] Approve `Customer Inclusion Notes`
- [x] Approve `Customer Submitted Photos Notes`

#### Internal Assessment Fields
- [x] Approve `Internal Cosmetic Notes`
- [x] Approve `Internal Functional Notes`
- [x] Approve `Internal Inclusion Notes`

#### Offer, Paid, And Allocation Fields
- [x] Approve `Offer Amount`
- [x] Approve `Paid Amount`
- [x] Approve `Confirmed Grand Total`
- [x] Approve `Allocation Mode`
- [x] Approve `Allocation Notes`

#### Lifecycle Fields
- [x] Approve `Workflow Status`
- [x] Approve `Awaiting Pre-Listing Review At`
- [x] Approve `Approved For Publish At`
- [x] Approve `Listed At`
- [x] Approve `Stale Listing At`
- [x] Approve `Stale Recovery Status`
- [x] Approve `Stale Recovery Notes`
- [x] Approve `Stale Recovery Updated At`
- [x] Approve `Relisted At`
- [x] Approve `Sold Ready To Ship At`
- [x] Approve `Shipment Follow-Through Notes`
- [x] Approve `Shipment Follow-Through Updated At`
- [x] Approve `Shipped At`

#### Workflow Status Model
- [x] Approve `Pending Review`
- [x] Approve `Unqualified`
- [x] Approve `Accepted - Awaiting Arrival`
- [x] Approve `Accepted - Arrived, Awaiting SKU`
- [x] Approve `Accepted - Arrived, Awaiting Missing Item`
- [x] Approve `Testing and Photography In Progress`
- [x] Approve `Awaiting Pre-Listing Review`
- [x] Approve `Approved for Publish`
- [x] Approve `Listed, Shopify`
- [x] Approve `Listed, eBay`
- [x] Approve `Stale Listing, Shopify`
- [x] Approve `Stale Listing, eBay`
- [x] Approve `Sold - Ready to Ship`
- [x] Approve `Shipped`

#### Workflow Logic Decisions
- [x] Approve the acceptance-gate requirements for moving from Lot 1 to Lot 2.
- [x] Approve deriving intake decision from `Workflow Status` instead of storing it as a separate field.
- [x] Approve handling manual-entry routing as an app-side creation choice instead of storing `Manual Entry Route` as a separate Airtable field.
- [x] Approve deriving next-team routing from `Workflow Status` plus incomplete stage signoffs instead of storing `Next Team` as a separate Airtable field.
- [x] Approve keeping stage signoff fields as explicit audit metadata instead of trying to derive them from status alone.
- [x] Approve allowing testing and photography to proceed concurrently after processing is complete.
- [x] Approve one-row-per-sellable-item as the record identity model.
- [x] Approve `Submission Group ID` and `Pick Up ID` as the grouping model.
- [x] Approve `Offer Amount` and `Paid Amount` as distinct values.
- [x] Approve equal split as the default grand-total allocation mode.
- [x] Approve manual override after allocation.
- [x] Approve the proposed backfill/normalization approach for existing rows.

### Proposed Airtable Fields For Approval

These are proposed additions or formalized workflow fields for `tbl0K0nFQL64jQMx8`. Do not implement any new Airtable field until the user explicitly approves it.

#### Workflow And Routing
- `Workflow Source`
	- Purpose: identify the external or operator source that created the row.
	- Suggested values: `JotForm`, `Manual Entry`.
	- Sample values: `JotForm`, `Manual Entry`.
	- Rule: set once at row creation and do not reuse it to describe current state or routing.
	- When to use it: use this when you need to answer "where did this row originate?"
- `Submission Group ID`
	- Purpose: group multiple item rows created from the same customer submission.
	- Plain-language meaning: if one customer submission produces three sellable items, all three Airtable rows share the same `Submission Group ID` so the app knows they belong to the same intake event.
	- Example: one seller submits a camera body, lens, and battery grip in one JotForm. The app creates three rows, each with its own Airtable record id, but all three rows share one `Submission Group ID`.
	- Suggested format: stable generated group key such as `SG-20260507-001` or the source submission id when it is already unique and reliable.
	- Sample values: `SG-20260507-001`, `SG-20260507-014`, `JF-103842`, `SUB-2026-05-07-ACME-01`.
	- Rule: use only for items created from the same single intake submission. Do not repurpose it for later pickups, merges, or shipping batches.
	- When to use it: use this when you need to answer "which rows came from the same original submission?"
- `Pick Up ID`
	- Purpose: group manually processed or physically received items tied to the same pickup/arrival workflow.
	- Plain-language meaning: if multiple rows were brought in, dropped off, or received together as one real-world handoff, they share the same `Pick Up ID`.
	- Example: a seller submits gear online on Monday, drops off two items on Wednesday, and brings the rest on Friday. All rows may share one `Submission Group ID`, but Wednesday and Friday arrivals would use different `Pick Up ID` values.
	- Suggested format: stable pickup or arrival key such as `PU-20260507-001`.
	- Sample values: `PU-20260507-001`, `PU-20260507-JOHNSMITH`, `ARR-2026-05-07-02`, `PICKUP-NYC-20260507-AM`.
	- Rule: use only when items share a real-world pickup or arrival event. Leave blank for standalone intake rows that are not part of a pickup group.
	- When to use it: use this when you need to answer "which rows physically arrived together?"
- `Trash Status`
	- Purpose: distinguish active trash, restored items, and permanently deleted candidates.
	- Suggested values: `Active Trash`, `Restored`, `Ready for Deletion`.
	- Sample values: `Active Trash`, `Restored`, `Ready for Deletion`.
	- Rule: only use when `Workflow Status` is `Unqualified` or the row is being restored from that state.
	- When to use it: use this when you need to answer "what stage is this row in inside the trash workflow?"

#### Workflow Ownership And Handoffs
- `Workflow Owner`
	- Purpose: record the current accountable operator for queue follow-through when the team wants ownership beyond signoff timestamps.
	- Rule: optional for any active workflow row; overwrite when ownership changes and clear it when the row returns to an unowned shared queue.
- `Workflow Owner Assigned At`
	- Purpose: capture when the current workflow owner was assigned.
	- Rule: paired with `Workflow Owner`; update it when ownership changes and clear it when `Workflow Owner` is cleared.
- `Accepted By`
	- Rule: required when `Workflow Status` first enters the accepted workflow family.
- `Accepted At`
	- Rule: timestamp paired with `Accepted By`; do not use it for physical arrival time.
- `Processing Signed By`
	- Rule: set when processing is completed and the record is handed off out of processing. Do not overwrite for later stages.
- `Processing Signed At`
	- Rule: paired timestamp for `Processing Signed By`.
- `Testing Signed By`
	- Rule: set when testing is completed, whether or not photography is already complete. Do not overwrite for later stages.
- `Testing Signed At`
	- Rule: paired timestamp for `Testing Signed By`.
- `Photography Signed By`
	- Rule: set when photography is completed, whether or not testing is already complete.
- `Photography Signed At`
	- Rule: paired timestamp for `Photography Signed By`.
- `Pre-Listing Reviewed By`
	- Rule: set when pre-listing review is completed and the record enters `Approved for Publish`.
- `Pre-Listing Reviewed At`
	- Rule: paired timestamp for `Pre-Listing Reviewed By`.

#### Acceptance Gate And Intake Qualification
- `Qualification Notes`
	- Purpose: capture the required qualifying information recorded before acceptance to Lot 2.
	- Rule: use for narrative notes or missing-detail follow-up, not for the pass/fail decision itself.
- `Qualification Complete`
	- Purpose: boolean gate indicating the required qualifying information has been supplied.
	- Rule: this is the gate field the workflow checks before allowing accepted records into Lot 2.
- `Unqualified Reason`
	- Purpose: capture why the intake was routed to trash.
	- Rule: required when `Workflow Status` is `Unqualified`.

#### Customer-Submitted Reference Layer
- `Customer Cosmetic Notes`
- `Customer Functional Notes`
- `Customer Inclusion Notes`
- `Customer Submitted Photos Notes`
	- Purpose: preserve customer-origin information separately from staff assessment.

#### Internal Assessment Layer
- `Internal Cosmetic Notes`
- `Internal Functional Notes`
- `Internal Inclusion Notes`
	- Purpose: separate internal assessment values from customer-origin data.

#### Offer, Paid, And Allocation
- `Offer Amount`
	- Purpose: item-level offer amount proposed to the seller.
	- Rule: editable during intake review and may differ from final paid value.
- `Paid Amount`
	- Purpose: item-level final paid amount when distinct from the offer.
	- Rule: leave blank until finalized if the seller has not yet been paid or if the final amount is not confirmed.
- `Confirmed Grand Total`
	- Purpose: submission-level grand total used to allocate value across items.
	- Rule: use only when multiple items share one negotiated total.
- `Allocation Mode`
	- Suggested values: `Equal Split`, `Manual Override`.
	- Rule: describes how `Confirmed Grand Total` was distributed across grouped items.
- `Allocation Notes`
	- Purpose: explain overrides or exceptions.
	- Rule: optional unless `Allocation Mode` is `Manual Override`.

#### Status And Lifecycle
- `Workflow Status`
	- Purpose: explicit workflow state separate from marketplace-specific listing state if needed.
	- Rule: this is the authoritative current-state field for the operational workflow.
	- Sample values: `Pending Review`, `Accepted - Awaiting Arrival`, `Testing and Photography In Progress`, `Approved for Publish`, `Listed, Shopify`, `Sold - Ready to Ship`.
	- When to use it: use this when you need to answer "where is this item right now in the operational workflow?"
- `Awaiting Pre-Listing Review At`
	- Rule: set when a record first enters `Awaiting Pre-Listing Review`.
- `Approved For Publish At`
	- Rule: set when a record first enters `Approved for Publish`.
- `Listed At`
	- Rule: set when the item is first listed on any marketplace.
- `eBay Published At`
	- Purpose: capture the first successful eBay publish timestamp on the workflow row.
	- Rule: set only by eBay publish writeback; do not use it for Shopify publish timing.
- `eBay Offer ID`
	- Purpose: persist the eBay offer identifier returned by the publish flow.
	- Rule: set only from successful eBay publish responses; treat as system-owned metadata.
- `eBay Listing ID`
	- Purpose: persist the eBay listing identifier returned when the offer becomes live.
	- Rule: set only from successful eBay publish responses; treat as system-owned metadata.
- `Stale Listing At`
	- Rule: set when an active listing crosses the stale threshold.
- `Sold Ready To Ship At`
	- Rule: set when the sold item enters the shipping-prep queue.
- `Shipped At`
	- Rule: set when shipment is complete.

### Proposed Workflow Statuses And Allowed Transitions

#### Intake And Parking Lots
- `Pending Review`
	- Shared Lot 1 intake status for new JotForm submissions and manual entries routed to Lot 1.
	- Example use: newly submitted JotForm camera kit waiting for purchasing review.
- `Unqualified`
	- Routed to trash.
	- Example use: intake rejected because condition or value does not meet requirements.
- `Accepted - Awaiting Arrival`
	- Accepted and routed to Lot 2 before item receipt.
	- Example use: seller accepted the offer, but the item has not physically arrived yet.
- `Accepted - Arrived, Awaiting SKU`
	- Arrived but not yet fully processed into SKU workflow.
	- Example use: item received at the shop and waiting for processing/SKU assignment.

- `Accepted - Arrived, Awaiting Missing Item`
	- Main unit present but waiting on missing included item such as a box or remote.
	- Example use: camera body arrived, but the promised battery grip is still missing.

#### Processing
- `Testing and Photography In Progress`
	- Processing is complete, and testing and photography may proceed in either order or at the same time.
	- Example use: SKU assigned, the testing team is validating functionality, and the photo team can begin shooting available assets without waiting for a linear handoff.
- `Awaiting Pre-Listing Review`
	- Testing and photography are both complete, and the item is queued for listing-team review.
	- Example use: all required photos are uploaded, testing is signed off, and listing review is next.

#### Listing Prep And Publish
- `Approved for Publish`
	- Example use: reviewer approved pricing and content; item can move into marketplace listing flow.
- `Listed, Shopify`
	- Example use: item is live on Shopify.
- `Listed, eBay`
	- Example use: item is live on eBay.
- `Stale Listing, Shopify`
	- Example use: Shopify listing has aged past the stale threshold and needs listing-team attention.
- `Stale Listing, eBay`
	- Example use: eBay listing has aged past the stale threshold and needs listing-team attention.

#### Fulfillment
- `Sold - Ready to Ship`
	- Example use: item sold and is now in the shipping-prep queue.
- `Shipped`
	- Example use: package has left the building and fulfillment is complete.

### Proposed Derived Intake Decision Rule

Do not store `Intake Decision` as a separate Airtable field. Derive it from `Workflow Status` when needed in the app or in Airtable formulas/views.

- `Pending Review` -> `Pending`
- `Unqualified` -> `Unqualified`
- `Accepted - Awaiting Arrival` -> `Accepted`
- `Accepted - Arrived, Awaiting SKU` -> `Accepted`
- `Accepted - Arrived, Awaiting Missing Item` -> `Accepted`
- `Testing and Photography In Progress` -> `Accepted`
- `Awaiting Pre-Listing Review` -> `Accepted`
- `Approved for Publish` -> `Accepted`
- `Listed, Shopify` -> `Accepted`
- `Listed, eBay` -> `Accepted`
- `Stale Listing, Shopify` -> `Accepted`
- `Stale Listing, eBay` -> `Accepted`
- `Sold - Ready to Ship` -> `Accepted`
- `Shipped` -> `Accepted`

Rule summary:
- `Pending Review` means the intake decision is still `Pending`.
- `Unqualified` means the intake decision is `Unqualified`.
- Every later valid workflow status implies the intake decision was `Accepted`.

### Proposed Manual Entry Routing Rule

Do not store `Manual Entry Route` as a separate Airtable field. Treat it as an app-side choice made on the manual-entry page that determines the row's initial workflow state.

- Manual entry sent to Lot 1 creates a row with `Workflow Source = Manual Entry` and initial `Workflow Status = Pending Review`.
- Manual entry sent directly to Lot 2 creates a row with `Workflow Source = Manual Entry` and an initial accepted workflow status such as `Accepted - Awaiting Arrival`.
- After creation, the workflow should rely on `Workflow Status`, not a separate stored route field, to determine where the item currently belongs.

### Proposed Derived Next-Team Routing Rule

Do not store `Next Team` as a separate Airtable field. Derive it from `Workflow Status` in the app when routing in-app notifications, queue actions, and handoff prompts.

- `Pending Review` -> `Purchasing`
- `Accepted - Awaiting Arrival` -> `Processing`
- `Accepted - Arrived, Awaiting SKU` -> `Processing`
- `Accepted - Arrived, Awaiting Missing Item` -> `Processing`
- `Testing and Photography In Progress` -> `Testing`, `Photography`, or both depending on which stage signoffs are still incomplete.
- `Awaiting Pre-Listing Review` -> `Listing`
- `Approved for Publish` -> `Listing`
- `Listed, Shopify` -> none
- `Listed, eBay` -> none
- `Stale Listing, Shopify` -> `Listing`
- `Stale Listing, eBay` -> `Listing`
- `Sold - Ready to Ship` -> `Shipping`
- `Shipped` -> none
- `Unqualified` -> none

Rule summary:
- The app should compute the next operational team from the current workflow state and, during concurrent testing/photo work, from whichever stage signoffs are still incomplete.
- If a future exception path needs custom routing, handle it in app logic rather than introducing a generic `Next Team` field by default.

### Proposed Transition Guards
- `Pending Review` -> `Accepted - Awaiting Arrival`
	- Requires: qualifying information complete, accepted-by metadata captured.
- `Pending Review` -> `Unqualified`
	- Requires: unqualified reason captured.
- `Accepted - Awaiting Arrival` -> `Accepted - Arrived, Awaiting SKU`
	- Requires: item arrival confirmed.
- `Accepted - Arrived, Awaiting SKU` -> `Testing and Photography In Progress`
	- Requires: processing-stage completion, SKU assigned, processing signoff captured.
- `Testing and Photography In Progress` -> `Awaiting Pre-Listing Review`
	- Requires: testing completion, testing signoff captured, photo-stage completion, required uploads present, inclusion confirmations complete, photography signoff captured.
- `Awaiting Pre-Listing Review` -> `Approved for Publish`
	- Requires: pre-listing review completion, reviewer/pricing confirmation captured.

### Proposed Acceptance-Gate Requirements For Lot 2 Routing
An item may move from Lot 1 intake review into the accepted workflow and Lot 2 only when all of the following are true:

- `Workflow Status` is transitioning from `Pending Review` to an accepted status, normally `Accepted - Awaiting Arrival`.
- `Qualification Complete` is true.
- `Accepted By` is populated.
- `Accepted At` is populated.
- At least one pricing path is present:
	- `Offer Amount` is populated, or
	- `Paid Amount` is populated, or
	- the submission is explicitly using grouped-total allocation with `Confirmed Grand Total`.
- If the intake creates multiple sellable rows from one submission, `Submission Group ID` is populated for all rows in that group.
- If the accepted items are tied to a real-world pickup or arrival batch, `Pick Up ID` is populated before or at arrival handling.

The workflow must block Lot 2 routing when any of the following are true:

- `Qualification Complete` is false or blank.
- `Accepted By` is missing.
- `Accepted At` is missing.
- No offer, paid value, or confirmed grouped total has been recorded.
- A multi-item accepted submission does not yet have a `Submission Group ID`.

The workflow must route to trash instead of Lot 2 when all of the following are true:

- `Workflow Status` is set to `Unqualified`.
- `Unqualified Reason` is populated.
- `Trash Status` is set to `Active Trash` unless the row is immediately being restored or permanently deleted through a controlled cleanup action.

Operational notes:

- Passing the acceptance gate does not mean testing or photography has started; it only means the record is approved to enter the accepted workflow.
- If testing and photography later run concurrently, that does not change the Lot 1 acceptance requirements.
- App-side routing may still decide which downstream team sees the item first, but only after the gate above passes.

### Proposed Record Identity Strategy
- One Airtable row per sellable item.
- `Submission Group ID` ties together all item rows created from the same JotForm submission.
- `Pick Up ID` ties together physically related or manually grouped intake records.
- The Airtable row id remains the authoritative per-item id used by app routes and deep links.
- Queue/detail pages may be grouped by `Submission Group ID` or `Pick Up ID`, but actions ultimately resolve to one or more authoritative row ids.

### Proposed Offer Amount Vs Paid Amount Behavior
- `Offer Amount` is the proposed value communicated during intake review.
- `Paid Amount` is the final settled value when different from the offer.
- If no distinct paid value exists yet, `Paid Amount` may remain blank until finalized.
- Intake review UI should support editing both values per item.

### Proposed Grand-Total Allocation Rules
- `Confirmed Grand Total` applies at the grouped-submission level.
- Default allocation mode is `Equal Split` across all active item rows in the group.
- Staff may switch to `Manual Override` and edit item-level values directly.
- Allocation must remain editable after the initial split.

### Proposed Backfill And Normalization Approach
Backfill and normalization must follow these rules:

- Do not mutate existing rows blindly or apply a bulk rewrite to the table without classification first.
- Classify each existing row into one of three buckets before writing workflow fields:
	- `Active Workflow Candidate`
		- A row that is already part of current intake, processing, listing, or fulfillment work and needs workflow fields to remain operable.
	- `Likely Legacy Inventory Record`
		- A row that represents older inventory or historical data that should remain readable but does not need to be forced into the new workflow.
	- `Needs Manual Review`
		- A row with incomplete, conflicting, or ambiguous data that cannot be safely normalized automatically.

Rows classified as `Active Workflow Candidate` may receive only the minimum backfill needed to support the approved workflow model:

- `Workflow Source` only when the origin can be determined with high confidence.
- `Workflow Status` only when the current operational stage can be inferred safely from existing data.
- `Submission Group ID` only when grouped submission membership is already known or can be reconstructed with high confidence.
- `Pick Up ID` only when the physical pickup/arrival grouping is already known or can be reconstructed with high confidence.
- Required lifecycle or signoff timestamps only when there is an authoritative existing timestamp or event source.

Rows classified as `Likely Legacy Inventory Record` must not be forced through the new workflow. For those rows:

- Preserve existing values as-is.
- Leave new workflow fields blank unless a field is required for harmless read-only filtering or reporting.
- Do not fabricate grouped ids, pickup ids, signoff metadata, or review timestamps.

Rows classified as `Needs Manual Review` must not be auto-normalized into an accepted or downstream workflow state. For those rows:

- Leave uncertain workflow fields blank.
- Avoid assigning `Workflow Status` beyond a safe placeholder only if the app requires one for visibility.
- Surface them to a manual-review queue, report, or controlled cleanup pass before any workflow automation depends on them.

The workflow must block backfill writes when any of the following are true:

- The source or current operational stage cannot be inferred with high confidence.
- Multiple candidate submission groups or pickup groups are possible.
- Existing dates or review metadata conflict with each other.
- The row appears to be closed historical inventory rather than an active workflow record.

Operational notes:

- Prefer additive backfill over destructive normalization.
- Preserve original data whenever a workflow field cannot be inferred safely.
- It is acceptable for some legacy rows to remain partially unnormalized if that is safer than inventing workflow history.
- The purpose of backfill is to make active work operable, not to rewrite the historical truth of the table.

