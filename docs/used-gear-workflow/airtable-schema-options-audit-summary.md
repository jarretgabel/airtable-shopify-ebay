# Airtable Schema Options Audit Summary

This report captures the approved select-option values for the used-gear workflow Airtable fields after the schema reconciliation run.

## Scope
- base `apprsAm2FOohEmL2u`
- table `tbl0K0nFQL64jQMx8`

## Option Audit Result
- all approved select-option sets were present in the live table during validation
- no missing options were reported for the approved workflow select fields
- no extra live options were reported for the approved workflow select fields

## Approved Select Fields

### Workflow Source
- `JotForm`
- `Manual Entry`

### Trash Status
- `Active Trash`
- `Restored`
- `Ready for Deletion`

### Allocation Mode
- `Equal Split`
- `Manual Override`

### Stale Recovery Status
- `Needs Review`
- `Price Refresh`
- `Content Refresh`
- `Ready To Relist`
- `Do Not Relist`

### Workflow Status
- `Pending Review`
- `Unqualified`
- `Accepted - Awaiting Arrival`
- `Accepted - Arrived, Awaiting SKU`
- `Accepted - Arrived, Awaiting Missing Item`
- `Testing and Photography In Progress`
- `Awaiting Pre-Listing Review`
- `Approved for Publish`
- `Listed, Shopify`
- `Listed, eBay`
- `Stale Listing, Shopify`
- `Stale Listing, eBay`
- `Sold - Ready to Ship`
- `Shipped`

## Supporting Artifacts
- field inventory:
  - `tmp/used-gear-workflow-schema/approved-workflow-field-ids.json`
- full rollback plan:
  - `tmp/used-gear-workflow-schema/rollback-delete-approved-workflow-fields.json`
- validation summary:
  - `tmp/used-gear-workflow-schema/summary.json`