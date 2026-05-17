# Used Gear Workflow Release Smoke Test Checklist

Use this checklist after Inventory routing, pending-review, Listings workflow context, notification, or publish-handoff changes.

Run this smoke pass only against the local `/api/*` workflow path. Before starting, bring up the no-Docker local API and point the app at that local backend rather than a deployed AWS environment.

Recommended setup:

```bash
npm run local:api
npm run local:api:check
```

## Inventory Workflow Routing
- [ ] Open Inventory and confirm Pending Review, Progress, and Post-Publish sections all render.
- [ ] Sign in as a processor, open a clean `/inventory` route with no existing query or hash state, and confirm it defaults to Pending Review.
- [ ] Verify the Inventory workflow badge count still appears when actionable rows exist.
- [ ] Open Parking Lot 1 and confirm it shows workflow-only intake triage.
- [ ] Open JotForm from the utility nav and confirm it shows the raw source feed without the workflow queue embedded.
- [ ] Confirm `Reset Workflow View` clears search, focused group, bucket, history, collapsed-state, and sort params.
- [ ] Save a named workflow view preset, reapply it, and delete it.

## Queue Focus And Audit
- [ ] In each workflow queue, confirm the row cards show a `Last touched` summary that reflects the newest available owner, stage, or stale-recovery update instead of a blank audit state.

## Dashboard Routing And Ownership
- [ ] Sign in as a processor and confirm the dashboard action rail emphasizes Parking Lot 1, workflow blockers, and Listings review work.
- [ ] Sign in as a tester and confirm the dashboard action rail emphasizes Testing Queue and bench-aging work.
- [ ] Sign in as a photographer and confirm the dashboard action rail emphasizes Photography Queue and photo handoff work.
- [ ] With owned work in Pending Review, Progress, and Post-Publish, confirm the dashboard `My Queue` card shows the combined owned total and opens the highest-priority owned Inventory queue with the `mine` owner filter applied.
- [ ] With Pending Review or Progress backlog present, confirm the dashboard overdue cards open the oldest focused group for each queue instead of a generic list view.
- [ ] With owned post-publish work assigned, confirm the dashboard opens the `mine` owner filter instead of the unassigned filter.
- [ ] With no owned post-publish work but unassigned stale or sold-ready rows present, confirm the dashboard opens the `unassigned` owner filter.

## Queue Sharing And Navigation
- [ ] Confirm the primary nav order reads `Intake > Processing > Listings`.
- [ ] Copy the full workflow view link and confirm it reopens the same Inventory queue state.
- [ ] Copy a pending-review group link and confirm Inventory opens focused on that group.
- [ ] Copy a progress group link and confirm Inventory opens focused on that group.
- [ ] Change the post-publish history filter to `History Only` and confirm only shipped-history content remains visible.
- [ ] Use keyboard shortcuts from Inventory:
  - [ ] `g` then `1` jumps to Pending Review.
  - [ ] `g` then `2` jumps to Progress.
  - [ ] `g` then `3` jumps to Post-Publish.
  - [ ] `g` then `0` jumps to the directory list.

## Pending Review
- [ ] Verify single-row accept still requires qualification notes and a pricing path.
- [ ] Verify single-row unqualify still requires a reason.
- [ ] Verify batch accept works for a grouped submission with a shared note.
- [ ] Verify batch trash works for a grouped submission with a shared reason.

## Listings Workflow Context
- [ ] Open a workflow row with siblings and confirm grouped submission context renders sibling rows and counts.
- [ ] Confirm a missing publish price still shows a blocker and the jump action opens the Listings editor.
- [ ] Confirm the Listings selected-record workflow summary still reflects the current row status, signoffs, and reviewer metadata.
- [ ] Confirm the workflow audit section still shows owner assignment and lifecycle timestamps.

## Notifications
- [ ] Complete a stage signoff and confirm the in-app handoff notification still appears once with the correct deep link.
- [ ] Confirm queue-summary notifications still deep-link to the most relevant record, listing, or queue section.
- [ ] In Account Settings, toggle `Assigned to me` and `Unassigned work` workflow notification preferences and confirm queue-summary alerts respect those ownership scopes on the next refresh cycle.

## Publish And Post-Publish
- [ ] Approve a row for publish and confirm workflow status/writeback still advances correctly.
- [ ] Publish to eBay and confirm `eBay Published At`, `eBay Offer ID`, and `eBay Listing ID` write back to the workflow row.
- [ ] Publish to Shopify and eBay together and confirm the workflow row keeps the expected listed status while preserving both channel-specific writeback fields.
- [ ] Confirm post-publish bucket filters and history filter remain URL-backed and shareable.
- [ ] Confirm stale, sold-ready, and shipped actions still update the workflow row and refresh the queue state.
- [ ] On a sold-ready row, save shipment follow-through notes and confirm the Listings workflow context plus post-publish queue both show the saved note.
- [ ] On a shipped row, update shipment follow-through notes and confirm `Last touched` reflects the shipment-note update instead of the older sold-ready timestamp.

## Regression Safety
- [ ] Run focused workflow tests against the local `/api/*` path when the change is localized.
- [ ] Run `npm run build` before release.