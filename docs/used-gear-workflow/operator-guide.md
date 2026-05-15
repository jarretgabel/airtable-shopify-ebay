# Used Gear Workflow Operator Guide

This guide is the day-to-day reference for operators using the in-app used-gear workflow.

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
  - `Inventory > Used Gear Workflow > Processing And Stage Queue`
- Use this queue when:
  - a row is accepted and still in broad arrival, processing, or cross-stage triage flow
- Main actions:
  - open Incoming Gear, Testing, Photos, or Workflow Detail
  - complete processing
  - complete testing
  - complete photography
  - copy a focused group link for the exact submission/pickup cluster
- Use the queue summary cards to spot:
  - visible active rows and groups
  - rows sitting too long in the same stage
- If a row is blocked:
  - open Workflow Detail for readiness context and grouped sibling context

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
  - open the row in Incoming Gear or Workflow Detail
  - use shared URL state when handing off arrival-stage work

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
  - `Workflow > Testing Queue`
- Use this queue when:
  - a row is in concurrent stage work and still needs testing signoff
- Main actions:
  - open the Testing form directly
  - open Workflow Detail when a row is blocked or grouped context matters
  - copy a focused group link for teammate handoff

### Photography Queue
- Surface:
  - `Workflow > Photography Queue`
- Use this queue when:
  - a row is in concurrent stage work and still needs photography signoff
- Main actions:
  - open the Photos form directly
  - open Workflow Detail when readiness or grouped context matters
  - copy a focused group link for teammate handoff

### Pre-Listing Queue
- Surface:
  - `Workflow > Pre-Listing Queue`
- Use this queue when:
  - both concurrent stage signoffs are complete and the row needs final workflow review before listing handoff
- Main actions:
  - open Workflow Detail for final readiness review
  - jump to listing work once the row is approved for publish
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

### Workflow Detail Page
- Surface:
  - `/inventory/workflow/:recordId`
- Use this when:
  - a row needs stage-by-stage context before the next status transition
  - pre-listing readiness is blocked and needs a direct correction path
  - the current row belongs to a grouped submission and sibling context matters
- Main panels:
  - workflow summary and actions
  - pre-listing readiness with blocker actions
  - grouped submission context for sibling rows
  - workflow timeline and audit notes

## Listing Handoff Guide

### Combined Listing Approval
- Surface:
  - `/listings/:recordId`
- Use this when:
  - a row is already `Approved for Publish`
- What the listing team should verify:
  - workflow summary matches what was approved in the workflow detail page
  - resolved title and price look correct before final publish
  - successful publish updates the authoritative workflow row automatically

## Suggested Daily Flow
1. Start in Pending Review for new intake.
2. Move accepted rows through Parking Lot 2 and complete arrival-stage processing.
3. Work concurrent signoffs from Testing Queue and Photography Queue, or use the broader Progress Queue when cross-stage triage is needed.
4. Use Pre-Listing Queue and Workflow Detail whenever a row needs final readiness review, grouped sibling context, or blocker resolution.
5. Hand approved rows into Combined Listing Approval.
6. Work stale, sold-ready, and shipped transitions from Post-Publish.