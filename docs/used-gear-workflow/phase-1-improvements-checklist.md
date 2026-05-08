# Phase 1 Improvements Checklist

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
- [x] Revisit the surface audit when Phase 2 implementation starts so reused forms are updated before launch.
- [x] Add a short operator guide for each queue section after the workflow UI stabilizes.
- [x] Document the publish writeback behavior for Shopify and eBay once marketplace-specific edge cases are fully settled.
- [x] Add an explicit schema-approval guide for deferred workflow fields before any new Airtable schema changes are requested.

## Additional App Improvements To Consider
- [ ] Add a dashboard "My Queue" rollup that summarizes owned work across pending review, progress, and post-publish buckets in one card.
- [ ] Add ownership-change entries to the workflow timeline so reassignment history is visible without opening Airtable history.
- [ ] Add owner-aware notification preferences so unassigned work alerts and personally assigned work alerts can be tuned separately.
- [ ] Add one-click owner presets in Inventory for "Assigned To Me + Sold Ready" and "Unassigned + Stale Listings" to reduce repetitive filter setup.

## Supporting Files
- Workflow release smoke test checklist: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/release-smoke-test-checklist.md`
- Workflow operator guide: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/operator-guide.md`
- Publish writeback reference: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/publish-writeback-behavior.md`
- Backfill automation script: `/Users/user/Sites/airtable-shopify-ebay/scripts/used-gear-workflow-backfill.mjs`
- Schema approval guide: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/schema-update-approval-guide.md`
- Stale recovery design: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/stale-listing-recovery-design.md`