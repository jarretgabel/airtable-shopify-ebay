# Publish Writeback Behavior

This document records the implemented publish writeback behavior from the combined listing approval flow back into the authoritative used-gear workflow row.

## Purpose
- Make the current Shopify and eBay writeback behavior explicit.
- Separate implemented behavior from deferred marketplace-specific persistence.
- Clarify which timestamps and workflow states are app-owned today.

## Scope
- Source of truth row:
  - `used-gear-workflow`
- Current implementation surface:
  - combined listing approval publish actions
- Out of scope:
  - new eBay-specific Airtable fields that have not been approved
  - marketplace automation beyond the current publish result handling

## Workflow Preconditions
- The row must already be in `Approved for Publish` before final publish is attempted.
- Pre-listing review must already have written:
  - `Pre-Listing Reviewed By`
  - `Pre-Listing Reviewed At`
  - `Approved For Publish At`

## Common Writeback Behavior
- On the first successful publish result, the workflow row writes back into the listed lifecycle family.
- `Listed At` is captured on the first successful publish writeback.
- The workflow row remains authoritative for post-publish lifecycle actions after this point.

## Shopify Writeback

### Current Implemented Fields
- `Workflow Status = Listed, Shopify`
- `Listed At = now` when not already present
- `Shopify REST Published At = now`
- `Shopify REST Published Scope = web`

### Notes
- Shopify publish writeback uses already-approved Airtable fields.
- If the publish result returns a Shopify product id, the listing approval flow also keeps the listing-side product id fields in sync through its normal approval record handling.

## eBay Writeback

### Current Implemented Fields
- `Workflow Status = Listed, eBay`
- `Listed At = now` when not already present
- `eBay Published At = now`
- `eBay Offer ID = publish result offer id`
- `eBay Listing ID = publish result listing id`

### Notes
- eBay publish writeback now persists the stable identifiers returned by the approval publish result.
- The workflow row still does not store every marketplace response field; only the approved identifiers and publish timestamp are persisted.

## Multi-Target Publish Outcomes
- If Shopify succeeds and eBay does not, the workflow row is treated as `Listed, Shopify`.
- If eBay succeeds and Shopify does not, the workflow row is treated as `Listed, eBay`.
- If both targets succeed, the current workflow status resolves to one listed channel rather than storing a dual-channel state.
- When both succeed, the current implementation prefers:
  - the explicitly requested target when one channel was the intended final target
  - otherwise the existing eBay listed/stale family if already present
  - otherwise Shopify as the default listed family

## Post-Publish Follow-Through
- After writeback, the row moves into the in-app post-publish lifecycle queue.
- Operators can then transition the row manually through:
  - `Stale Listing, Shopify`
  - `Stale Listing, eBay`
  - `Sold - Ready to Ship`
  - `Shipped`

## Known Constraints
- The workflow model does not currently store a separate dual-marketplace listed state.
- Sold and shipped transitions are currently explicit operator actions, not backend-driven fulfillment events.

## Related Files
- `/Users/user/Sites/airtable-shopify-ebay/src/components/approval/useListingApprovalPublishActions.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/usedGearWorkflowLifecycle.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/usedGearQueue.ts`