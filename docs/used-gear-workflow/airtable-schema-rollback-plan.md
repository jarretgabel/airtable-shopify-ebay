# Airtable Schema Rollback Plan

This plan covers rollback for the approved used-gear workflow columns added to:
- base `apprsAm2FOohEmL2u`
- table `tbl0K0nFQL64jQMx8`

## Purpose
- preserve a before-state snapshot before schema changes
- record exactly which field ids were created by the workflow schema sync
- provide a narrow rollback path that deletes only the newly created workflow columns if the table is left in a bad state

## Artifacts
- pre-change snapshot:
  - `tmp/used-gear-workflow-schema/prechange-table-metadata.json`
- post-change snapshot:
  - `tmp/used-gear-workflow-schema/postchange-table-metadata.json`
- created field ids:
  - `tmp/used-gear-workflow-schema/created-fields.json`
- rollback deletion order:
  - `tmp/used-gear-workflow-schema/rollback-delete-created-fields.json`
- current approved workflow field ids:
  - `tmp/used-gear-workflow-schema/approved-workflow-field-ids.json`
- full workflow rollback deletion order:
  - `tmp/used-gear-workflow-schema/rollback-delete-approved-workflow-fields.json`
- human-readable audit summary:
  - `docs/used-gear-workflow/airtable-schema-audit-summary.md`
- select-option audit summary:
  - `docs/used-gear-workflow/airtable-schema-options-audit-summary.md`

## Rollback Trigger
Use this plan if any of the following happens after the workflow field creation run:
- the wrong column name or type was created
- the wrong select options were created
- the table layout or app behavior becomes inconsistent with the approved workflow model
- a partial schema run leaves the live table in an unclear state

## Lowest-Risk Rollback Path
1. Stop making further schema changes in Airtable.
2. Compare the live table against `prechange-table-metadata.json`.
3. Run `node scripts/rollback-used-gear-workflow-schema.mjs --plan tmp/used-gear-workflow-schema/rollback-delete-created-fields.json` to dry-run the latest-run rollback order.
4. If the entire workflow schema needs to be removed, dry-run `node scripts/rollback-used-gear-workflow-schema.mjs --plan tmp/used-gear-workflow-schema/rollback-delete-approved-workflow-fields.json` instead.
5. Execute the deletion only after review by adding `--apply --confirm DELETE_APPROVED_WORKFLOW_FIELDS`.
6. Re-fetch table metadata and confirm the live table matches the pre-change snapshot except for any intentionally preserved fields.
7. Re-run the schema sync only after correcting the field definition plan.

## Important Constraint
- Airtable field deletion is destructive for data stored in that field.
- If operators have already started entering data into newly created fields, export that data before deleting the fields.

## Suggested Manual Verification Before Deletion
- confirm the field id exists in `created-fields.json`
- confirm the field was created by the workflow schema sync and was not a pre-existing table column
- confirm whether any rows already contain values in the field

## Recovery After Rollback
- fix the schema definition issue first
- re-run the schema sync script
- validate the final schema against:
  - `docs/used-gear-workflow/data-model-and-approvals.md`
  - `docs/used-gear-workflow/stale-listing-recovery-design.md`

## References
- `scripts/sync-used-gear-workflow-schema.mjs`
- `scripts/rollback-used-gear-workflow-schema.mjs`
- `docs/used-gear-workflow/airtable-schema-audit-summary.md`
- `docs/used-gear-workflow/airtable-schema-options-audit-summary.md`
- `docs/used-gear-workflow/schema-update-approval-guide.md`
- `docs/used-gear-workflow/data-model-and-approvals.md`