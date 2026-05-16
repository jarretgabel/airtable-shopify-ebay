# Used Gear Workflow Operator Guide

This guide is the day-to-day reference for operators using the in-app used-gear workflow.

## Primary Navigation Order

- Workflow surfaces now follow `Intake > Processing > Listing` in the app shell.
- Use Intake for qualification, arrival routing, and manual-entry creation.
- Use Processing for the workflow hub plus dedicated Testing and Photography work discovery and form completion.
- Use Listings only after both concurrent signoffs are complete and the row has entered `Awaiting Pre-Listing Review`.
- Utility pages such as Workflow Guide, HiFi Shark, and Image Lab remain outside that operational sequence.

## Inventory Workflow Shell

### Inventory Workflow Bar
- Purpose:
  - show the active workflow filters, focused groups, post-publish history mode, and saved views in one place
  - keep the current workflow state shareable and resettable
- Use it for:
  - confirming what queue state is active before sharing a link
  - saving named workflow view presets
  - clearing one filter at a time without resetting the whole page
- Shortcuts:
  - `g` then `1`: Pending Review
  - `g` then `2`: Progress
  - `g` then `3`: Post-Publish
  - `g` then `0`: Inventory directory

## Queue Guides

### Pending Review Queue
- Surface:
  - `Intake > Parking Lot 1`
- Use this queue when:
  - a new workflow row still needs qualification review
  - the intake decision is not yet accepted into Lot 2 or sent to trash
- Main actions:
  - single-row accept into Lot 2
  - single-row unqualify to trash
  - batch accept for grouped submissions
  - batch trash for grouped submissions
  - copy a group-focused link for collaboration
- Required before accept:
  - qualification notes
  - at least one pricing path on the row or grouped intake
  - submission group id for multi-item grouped acceptance when required
- Use the queue summary cards to spot:
  - total pending rows
  - visible groups after search
  - rows aging past the review threshold

### Progress Queue
- Surface:
  - `Processing > Workflow Hub`
- Use this queue when:
  - a row is accepted and still in broad arrival, processing, or cross-stage triage flow
- Main actions:
  - open Manual Intake, Testing, Photos, or Listings review
  - complete processing
  - copy a focused group link for the exact submission/pickup cluster
- Use the queue summary cards to spot:
  - visible active rows and groups
  - rows sitting too long in the same stage
- If a row is blocked:
  - open the current operational record for readiness context and grouped sibling context

### Post-Publish Queue
- Surface:
  - `Inventory > Used Gear Workflow > Post-Publish Queue`
- Use this queue when:
  - a published row needs stale follow-up, sold-ready handling, shipped confirmation, or history lookup
- Main actions:
  - filter by bucket: Active, Stale, Sold Ready, Shipped
  - filter by history mode: All Lifecycle Work, Active Only, History Only
  - mark listing stale
  - mark sold ready
  - mark shipped
  - copy a shareable queue or filtered link
- Use the queue summary cards to spot:
  - active rows nearing stale threshold
  - stale rows that have not been worked recently
  - shipped history without crowding active lifecycle buckets

### Parking Lot 2
- Surface:
  - `Intake > Parking Lot 2`
- Use this queue when:
  - an intake is accepted but has not fully entered the processing/test/photo workflow
- Main actions:
  - search and sort arrival-stage rows
  - open a grouped handoff page for one pickup or submission set
  - open the row in Manual Intake or the current operational surface
  - use shared URL state when handing off arrival-stage work

### Parking Lot 2 Group Handoff
- Surface:
  - `/parking-lot-2/review/:groupId`
- Use this when:
  - one accepted pickup or submission set needs coordinated arrival-stage work across Manual Intake, Testing, Photos, or the operational record
- Main actions:
  - review the whole set in one place
  - open each row directly into the next form or operational page
  - keep shared pickup or submission context visible during the handoff

### Manual Intake
- Surface:
  - `/inventory/manual-intake`
- Use this when:
  - intake starts inside the app instead of coming from JotForm
  - staff needs to create a manual-entry workflow row with seller-reference notes and an explicit starting route
- Main actions:
  - route the new row into Parking Lot 1 review or directly into Parking Lot 2 when the deal is already accepted
  - capture submission group id, pickup id, and qualification notes when shared context matters
  - keep manual-entry intake aligned with the JotForm-style seller reference fields before downstream corrections are added

### Trash Queue
- Surface:
  - `Intake > Trash Review`
- Use this queue when:
  - a pending-review row was marked unqualified and needs audit, restore, re-qualify, or permanent deletion
- Main actions:
  - restore to pending review
  - re-qualify into the accepted workflow
  - permanently delete when operationally appropriate

### Testing Queue
- Surface:
  - `Processing > Testing Review`
- Use this queue when:
  - a row is in concurrent stage work and still needs testing signoff
- Main actions:
  - open the Testing form directly
  - open the current operational record when a row is blocked or grouped context matters
  - copy a focused group link for teammate handoff

### Photography Queue
- Surface:
  - `Processing > Photography Review`
- Use this queue when:
  - a row is in concurrent stage work and still needs photography signoff
- Main actions:
  - open the Photos form directly
  - open the current operational record when readiness or grouped context matters
  - copy a focused group link for teammate handoff

## Review And Detail Guides

### Group Review Page
- Surface:
  - `/parking-lot-1/review/:groupId`
- Use this when:
  - a multi-item submission needs per-row offer allocation and a shared submission review decision
- Main actions:
  - set submission group id
  - allocate totals
  - save grouped review state
  - accept the grouped submission into Lot 2

## Listing Handoff Guide

### Combined Listing Approval
- Surface:
  - `/listings/:recordId`
- Use this when:
  - a row is `Awaiting Pre-Listing Review` and needs final readiness review
  - a row is already `Approved for Publish` and needs final publish work
  - a listing-phase row needs grouped sibling context, audit history, or post-publish lifecycle work
- What the listing team should verify:
  - workflow summary matches the current workflow row and signoff state
  - resolved title and price look correct before final publish
  - successful publish updates the authoritative workflow row automatically
  - grouped submission context, audit fields, and post-publish notes stay aligned with the authoritative workflow row
  - the selected-record page now acts as the former pre-listing review home, so blocker messaging, reviewer confirmation, and approve-for-publish actions all stay on this same Listings surface

## Suggested Daily Flow
1. Start in Pending Review for new intake.
2. Move accepted rows through Parking Lot 2 and complete arrival-stage processing.
3. Work concurrent signoffs from Testing Queue and Photography Queue, or use the broader Progress Queue when cross-stage triage is needed.
4. Use Combined Listing Approval for `Awaiting Pre-Listing Review` and `Approved for Publish` rows; the selected-record view now carries grouped context, audit history, blocker messaging, and post-publish workflow notes.
5. Hand publish-ready rows through the Combined Listing Approval selected-record flow.
6. Work stale, sold-ready, and shipped transitions from Post-Publish.