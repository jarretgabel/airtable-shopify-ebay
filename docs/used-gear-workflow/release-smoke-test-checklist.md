# Used Gear Workflow Release Smoke Test Checklist

Use this checklist after Inventory routing, pending-review, workflow detail, notification, or publish-handoff changes.

## Inventory Workflow Routing
- [ ] Open Inventory and confirm Pending Review, Progress, and Post-Publish sections all render.
- [ ] Verify the Inventory workflow badge count still appears when actionable rows exist.
- [ ] Confirm `Reset Workflow View` clears search, focused group, bucket, history, collapsed-state, and sort params.
- [ ] Save a named workflow view preset, reapply it, and delete it.

## Queue Sharing And Navigation
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

## Workflow Detail
- [ ] Open a workflow row with siblings and confirm grouped submission context renders sibling rows and counts.
- [ ] Confirm timeline entries still render completed and pending stages correctly.
- [ ] Confirm a missing publish price still shows a blocker and the jump action opens the full editor.

## Notifications
- [ ] Complete a stage signoff and confirm the in-app handoff notification still appears once with the correct deep link.
- [ ] Confirm queue-summary notifications still deep-link to the most relevant record, listing, or queue section.

## Publish And Post-Publish
- [ ] Approve a row for publish and confirm workflow status/writeback still advances correctly.
- [ ] Publish to eBay and confirm `eBay Published At`, `eBay Offer ID`, and `eBay Listing ID` write back to the workflow row.
- [ ] Publish to Shopify and eBay together and confirm the workflow row keeps the expected listed status while preserving both channel-specific writeback fields.
- [ ] Confirm post-publish bucket filters and history filter remain URL-backed and shareable.
- [ ] Confirm stale, sold-ready, and shipped actions still update the workflow row and refresh the queue state.

## Regression Safety
- [ ] Run focused workflow tests when the change is localized.
- [ ] Run `npm run build` before release.