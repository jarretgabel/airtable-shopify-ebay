# Historical: Airtable Schema Audit Summary

> Historical reference only. This document records prior schema validation work and should not be used as the source of truth for new implementation tasks. Use the docs in the parent folder for current guidance.

This report captures the post-change audit state for the approved used-gear workflow schema in Airtable.

## Scope
- base `apprsAm2FOohEmL2u`
- table `tbl0K0nFQL64jQMx8`

## Audit Result
- live schema matched the approved workflow field list
- live select options matched the approved workflow option sets
- approved workflow field count present live: `45`
- latest rerun creation count: `2`

The latest sync added the newly approved ownership fields:
- `Workflow Owner`
- `Workflow Owner Assigned At`

The current approved live schema also includes the previously added eBay publish metadata fields:
- `eBay Published At`
- `eBay Offer ID`
- `eBay Listing ID`

## Artifacts
- live field id inventory:
  - `tmp/used-gear-workflow-schema/approved-workflow-field-ids.json`
- full rollback plan:
  - `tmp/used-gear-workflow-schema/rollback-delete-approved-workflow-fields.json`
- latest-run rollback plan:
  - `tmp/used-gear-workflow-schema/rollback-delete-created-fields.json`
- before snapshot:
  - `tmp/used-gear-workflow-schema/prechange-table-metadata.json`
- after snapshot:
  - `tmp/used-gear-workflow-schema/postchange-table-metadata.json`
- summary:
  - `tmp/used-gear-workflow-schema/summary.json`
- approved select-option audit:
  - `docs/used-gear-workflow/airtable-schema-options-audit-summary.md`

## Approved Live Workflow Fields

| Field Name | Type |
| --- | --- |
| Stale Recovery Status | singleSelect |
| Stale Recovery Notes | multilineText |
| Stale Recovery Updated At | dateTime |
| Relisted At | dateTime |
| Workflow Source | singleSelect |
| Submission Group ID | singleLineText |
| Pick Up ID | singleLineText |
| Workflow Owner | singleLineText |
| Workflow Owner Assigned At | dateTime |
| Trash Status | singleSelect |
| Accepted By | singleLineText |
| Accepted At | dateTime |
| Processing Signed By | singleLineText |
| Processing Signed At | dateTime |
| Testing Signed By | singleLineText |
| Testing Signed At | dateTime |
| Photography Signed By | singleLineText |
| Photography Signed At | dateTime |
| Pre-Listing Reviewed By | singleLineText |
| Pre-Listing Reviewed At | dateTime |
| Qualification Notes | multilineText |
| Qualification Complete | checkbox |
| Unqualified Reason | multilineText |
| Customer Cosmetic Notes | multilineText |
| Customer Functional Notes | multilineText |
| Customer Inclusion Notes | multilineText |
| Customer Submitted Photos Notes | multilineText |
| Internal Cosmetic Notes | multilineText |
| Internal Functional Notes | multilineText |
| Internal Inclusion Notes | multilineText |
| Offer Amount | currency |
| Paid Amount | currency |
| Confirmed Grand Total | currency |
| Allocation Mode | singleSelect |
| Allocation Notes | multilineText |
| Workflow Status | singleSelect |
| Awaiting Pre-Listing Review At | dateTime |
| Approved For Publish At | dateTime |
| Listed At | dateTime |
| eBay Published At | dateTime |
| eBay Offer ID | singleLineText |
| eBay Listing ID | singleLineText |
| Stale Listing At | dateTime |
| Sold Ready To Ship At | dateTime |
| Shipped At | dateTime |

## Rollback Execution
- use `scripts/rollback-used-gear-workflow-schema.mjs` for a dry-run review of the rollback order
- use `--apply --confirm DELETE_APPROVED_WORKFLOW_FIELDS` only when you intend to delete the fields listed in the rollback artifact
- prefer `rollback-delete-created-fields.json` when only the latest sync needs to be undone
- prefer `rollback-delete-approved-workflow-fields.json` when the whole approved workflow field set must be removed