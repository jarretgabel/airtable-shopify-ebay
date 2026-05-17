# Historical: Phase 1 Improvements Checklist

> Historical reference only. This document records completed or retired backlog work and should not be used as the source of truth for new tasks. Use the docs in the parent folder for current guidance.

This backlog is for non-blocking improvements after the major Phase 1 workflow foundation is considered complete.

## Purpose
- Keep nice-to-haves separate from core Phase 1 completion criteria.
- Capture quality-of-life work that would improve workflow operations without changing the approved model.

## UX And Navigation
- [x] Add saved workflow views or named presets for common Inventory filter combinations.
- [x] Add one-click copy actions for individual grouped queues beyond the current page-level share tools.
- [x] Add optional sticky summary chips while scrolling long Inventory workflow sections.
- [x] Add stronger empty-state guidance that tells each team exactly which route or action is next.
- [x] Add lightweight keyboard shortcuts for jumping between pending review, progress, and post-publish sections.
- [x] Add dashboard deep links that open the relevant post-publish owner view when unassigned stale or sold-ready work needs immediate triage.

## Queue Operations
- [x] Add batch actions for grouped pending-review submissions where the same decision applies to all rows.
- [x] Add explicit assignment or ownership metadata for queue work if the team wants individual accountability beyond signoff fields.
- [x] Add a queue-level aging or SLA view for items sitting too long in review, processing, or stale states.
- [x] Add optional archived filters for completed/shipped workflow history instead of relying on the shared Inventory surface alone.

## Notifications And Awareness
- [x] Add nav or tab badges for workflow counts so users can see pending queue volume before opening Inventory.
- [x] Add optional notification throttling or digest behavior for high-volume workflow events.
- [x] Add deep links from notification to the most relevant queue subsection or grouped submission when appropriate.

## Workflow Detail And Auditability
- [x] Add a compact workflow timeline component that shows status transitions and signoff timestamps in one place.
- [x] Add clearer grouped-submission summaries on the workflow detail page when multiple rows share the same submission or pickup.
- [x] Add operator-facing explanations for why pre-listing readiness is blocked, with direct jump links to the field that needs attention.

## Listing And Marketplace Follow-Through
- [x] Persist eBay-specific publish metadata once approved Airtable field names exist for that data.
- [x] Add richer stale-listing recovery actions once the relist workflow is defined.
- [x] Add explicit sold/shipped reconciliation helpers if operational volume makes the post-publish queue too manual.

## Operations And Reliability
- [x] Automate the approved backfill runbook into a repeatable internal script or ops workflow when execution is scheduled.
- [x] Add a workflow-specific smoke-test checklist for release verification after Inventory routing or approval changes.
- [x] Add a workflow analytics snapshot for counts by status, age, and marketplace to simplify operational review.

## Documentation
- Historical note: ownership filters, quick-owner presets, and claim actions listed below describe earlier workflow experiments and should not be read as the current UI contract.
- [x] Revisit the surface audit when Phase 2 implementation starts so reused forms are updated before launch.
- [x] Add a short operator guide for each queue section after the workflow UI stabilizes.
- [x] Document the publish writeback behavior for Shopify and eBay once marketplace-specific edge cases are fully settled.
- [x] Add an explicit schema-approval guide for deferred workflow fields before any new Airtable schema changes are requested.

## Additional App Improvements To Consider
- [x] Priority 1: Finish the dashboard "My Queue" rollup so it spans pending review, progress, and post-publish buckets in one ownership card instead of only post-publish ownership work.
- [x] Priority 2: Add dashboard views that automatically emphasize the queues, alerts, and controls each user can access and is responsible for, instead of showing the same dashboard composition to everyone.
- [x] Priority 3: Add owner filters and quick-claim actions to Pending Review and Progress so ownership workflows stay consistent across all active queue sections, not just post-publish.
- [x] Priority 4: Add one-click owner presets in Inventory for "Assigned To Me + Sold Ready" and "Unassigned + Stale Listings" to reduce repetitive filter setup.
- [x] Priority 5: Add dashboard shortcuts for oldest-aging work in Pending Review and Progress, not only count-based entry points, so teams can jump straight to the most overdue item.
- [ ] Priority 6: Add user responsibility groups or permission templates so admins can grant access by team category and owned workflow area instead of managing page permissions one user at a time, starting with admins, photographers, testers, and listers.
- [x] Priority 7: Extend one-tap claim actions into the remaining workflow buckets so post-publish work matches the oldest-first claim behavior already shipped in Pending Review and Progress.
- [x] Priority 8: Add queue-row "last touched" context showing the latest owner, status change, or recovery update timestamp so operators can judge whether work is already in motion.
- [x] Priority 9: Add common note/reason templates for repetitive queue actions such as unqualify reasons, stale-recovery updates, and shipment follow-through notes.
- [x] Priority 10: Add ownership-change entries to the workflow timeline so reassignment history is visible without opening Airtable history.
- [x] Priority 11: Add role-based default Inventory workflow landing so processor users opening a clean Inventory route land on Pending Review without changing explicit saved queue state.
- [x] Priority 12: Add owner-aware notification preferences so unassigned work alerts and personally assigned work alerts can be tuned separately.

## Recommended Next Slices
- [x] Slice A: Finish the dashboard My Queue card with owned counts for intake, progress, and overdue work now that Pending Review, Progress, and Post-Publish all support owner filters.
- [x] Slice B: Add overdue-first dashboard shortcuts that open the oldest actionable Pending Review and Progress groups instead of only count-based queue links.
- [x] Slice C: Extend the quick owner shortcuts beyond post-publish so operators can jump directly into "My Pending Review" and "My Progress" views from the Inventory summary bar.
- [x] Slice D: Add queue-aware claim suggestions that prefer the oldest unassigned row inside each ownership-aware queue slice.

## Recommended Cleanup Items
- [x] Cleanup 1: Remove stale documentation that still describes JotForm as Parking Lot 1 or references removed intake badge semantics.
- [x] Cleanup 2: Expand the release smoke checklist to cover the Parking Lot 1 and JotForm split, role-aware dashboard actions, and owner-filter deep links.
- [x] Cleanup 3: Re-audit dashboard documentation whenever new ownership surfaces are added so partial ownership support is not described as cross-queue complete.

## Newly Shipped
- [x] Dashboard action rail now includes overdue-first shortcuts for the oldest pending review and oldest active progress groups when Inventory access is available.
- [x] Inventory workflow shortcut buttons now include `My Pending Review` and `My Progress` alongside the post-publish owner presets.
- [x] Pending Review and Progress claim actions now target the oldest visible unassigned row instead of whichever unassigned row happens to render first.
- [x] Phase 2 workflow docs now describe Parking Lot 1 as its own intake page and JotForm as a separate raw-source feed, including the current `/parking-lot-1` review routes.
- [x] Backlog audit completed: remaining open claim-action work is now documented as post-publish follow-through instead of re-describing the Pending Review and Progress behavior that is already live.
- [x] Post-publish now includes a `Claim Oldest Unassigned` action that targets the oldest visible unassigned active, stale, or sold-ready row while leaving shipped history out of the claim path.
- [x] Queue cards now show a lightweight `Last touched` summary using the newest owner, stage, or stale-recovery timestamp already available on each workflow row.
- [x] Workflow detail now includes an `Owner Assigned` milestone in the compact timeline when the row has a workflow owner timestamp.
- [x] Pending-review, trash re-qualify, and stale-recovery note entry now include reusable templates so operators can seed common qualification, unqualify, and recovery language without copy-paste.
- [x] Sold-ready and shipped workflow detail now includes shipment follow-through notes with reusable templates, a saved audit timestamp, and queue visibility for post-publish handoff context.

## Supporting Files
- Workflow release smoke test checklist: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/release-smoke-test-checklist.md`
- Workflow operator guide: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/operator-guide.md`
- Publish writeback reference: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/publish-writeback-behavior.md`
- Backfill automation script: `/Users/user/Sites/airtable-shopify-ebay/scripts/used-gear-workflow-backfill.mjs`
- Schema approval guide: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/schema-update-approval-guide.md`
- Stale recovery design: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/stale-listing-recovery-design.md`
- Ownership history audit design: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/ownership-history-audit-design.md`