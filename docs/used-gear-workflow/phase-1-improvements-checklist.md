# Phase 1 Improvements Checklist

This backlog is for non-blocking improvements after the major Phase 1 workflow foundation is considered complete.

## Purpose
- Keep nice-to-haves separate from core Phase 1 completion criteria.
- Capture quality-of-life work that would improve workflow operations without changing the approved model.

## UX And Navigation
- [ ] Add saved workflow views or named presets for common Inventory filter combinations.
- [ ] Add one-click copy actions for individual grouped queues beyond the current page-level share tools.
- [ ] Add optional sticky summary chips while scrolling long Inventory workflow sections.
- [ ] Add stronger empty-state guidance that tells each team exactly which route or action is next.
- [ ] Add lightweight keyboard shortcuts for jumping between pending review, progress, and post-publish sections.

## Queue Operations
- [ ] Add batch actions for grouped pending-review submissions where the same decision applies to all rows.
- [ ] Add explicit assignment or ownership metadata for queue work if the team wants individual accountability beyond signoff fields.
- [ ] Add a queue-level aging or SLA view for items sitting too long in review, processing, or stale states.
- [ ] Add optional archived filters for completed/shipped workflow history instead of relying on the shared Inventory surface alone.

## Notifications And Awareness
- [ ] Add nav or tab badges for workflow counts so users can see pending queue volume before opening Inventory.
- [ ] Add optional notification throttling or digest behavior for high-volume workflow events.
- [ ] Add deep links from notification to the most relevant queue subsection or grouped submission when appropriate.

## Workflow Detail And Auditability
- [ ] Add a compact workflow timeline component that shows status transitions and signoff timestamps in one place.
- [ ] Add clearer grouped-submission summaries on the workflow detail page when multiple rows share the same submission or pickup.
- [ ] Add operator-facing explanations for why pre-listing readiness is blocked, with direct jump links to the field that needs attention.

## Listing And Marketplace Follow-Through
- [ ] Persist eBay-specific publish metadata once approved Airtable field names exist for that data.
- [ ] Add richer stale-listing recovery actions once the relist workflow is defined.
- [ ] Add explicit sold/shipped reconciliation helpers if operational volume makes the post-publish queue too manual.

## Operations And Reliability
- [ ] Automate the approved backfill runbook into a repeatable internal script or ops workflow when execution is scheduled.
- [ ] Add a workflow-specific smoke-test checklist for release verification after Inventory routing or approval changes.
- [ ] Add a workflow analytics snapshot for counts by status, age, and marketplace to simplify operational review.

## Documentation
- [ ] Revisit the surface audit when Phase 2 implementation starts so reused forms are updated before launch.
- [ ] Add a short operator guide for each queue section after the workflow UI stabilizes.
- [ ] Document the publish writeback behavior for Shopify and eBay once marketplace-specific edge cases are fully settled.