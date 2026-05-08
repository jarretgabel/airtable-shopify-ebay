# Backfill Runbook

This runbook operationalizes the approved backfill and normalization strategy for existing used-gear workflow rows.

## Purpose
- Convert the approved backfill approach into an execution checklist.
- Minimize risk while normalizing legacy rows into the approved workflow statuses.
- Keep current operations running while the data model is adopted.

## Inputs
- Airtable base: `apprsAm2FOohEmL2u`
- Direct table scope: `tbl0K0nFQL64jQMx8`
- Listings review source of truth:
  - `docs/used-gear-workflow/data-model-and-approvals.md`

## Guardrails
- Do not add new Airtable fields without explicit approval.
- Do not mutate live JotForm behavior as part of backfill.
- Do not infer audit signoffs unless there is reliable historical evidence.
- Prefer leaving a field blank over backfilling a value that is probably wrong.
- Run the process as a reversible, reviewable batch with before/after exports.

## Target Outcomes
- Every in-scope row has the correct `Workflow Status` where it can be reliably derived.
- Rows that are clearly not accepted remain `Pending Review` or `Unqualified` instead of being forced forward.
- Grouping keys are populated where reliable source data exists.
- Lifecycle timestamps are preserved when they already exist or can be confidently derived.
- Ambiguous rows are flagged for manual review instead of auto-normalized.

## Recommended Execution Order

### 1. Freeze The Mapping Rules
- Reconfirm the approved status vocabulary.
- Reconfirm the grouped-row rules:
  - one row per sellable item
  - `Submission Group ID` groups original submission rows
  - `Pick Up ID` groups physical arrival/pickup events
- Reconfirm the transition rules and later-stage guardrails.

### 2. Snapshot The Current Table
- Export a full pre-backfill snapshot of `tbl0K0nFQL64jQMx8`.
- Save the export with a timestamped filename.
- Record the Airtable view or query used for the export.
- Preserve the snapshot so individual rows can be restored if the batch mapping is wrong.

### 3. Build A Dry-Run Mapping Sheet
- Produce a review artifact before any writes.
- For each row, calculate proposed values for:
  - `Workflow Status`
  - `Workflow Source`
  - `Submission Group ID`
  - `Pick Up ID`
  - `Trash Status`
  - lifecycle timestamps only when derivable
- Add a `manual review required` marker for rows that do not map cleanly.

### 4. Apply Status Mapping Conservatively

Recommended status mapping order:
- If the row is already clearly unqualified or trashed:
  - map to `Unqualified`
  - set `Trash Status` appropriately
- If the row is a new intake awaiting qualification:
  - map to `Pending Review`
- If the row has been accepted but has not reached concurrent stage work:
  - map to the correct accepted arrival/processing status
- If the row clearly has both testing and photography complete but pre-listing not complete:
  - map to `Awaiting Pre-Listing Review`
- If the row clearly passed pre-listing review and is ready for publish:
  - map to `Approved for Publish`
- If the row is already live, stale, sold-ready, or shipped:
  - map to the corresponding post-publish lifecycle status

When evidence is incomplete:
- choose the earliest defensible status
- flag the row for manual review
- do not fabricate later-stage completions

## Field-Specific Guidance

### Workflow Source
- Set to `JotForm` when the row clearly originated from the external intake workflow.
- Set to `Manual Entry` when the row clearly originated from staff-created intake.
- Leave for manual review when provenance is unclear.

### Submission Group ID
- Populate when multiple rows can be confidently tied to the same original submission.
- Reuse an existing stable submission id when present and reliable.
- Do not invent grouping keys that merge unrelated submissions.

### Pick Up ID
- Populate only when rows can be confidently tied to the same real-world arrival or pickup event.
- Leave blank when arrival grouping is unknown.

### Qualification Fields
- `Qualification Complete` should reflect whether the intake had enough approved qualifying information to enter the accepted workflow family.
- `Unqualified Reason` should only be backfilled when a clear historical reason exists.
- Avoid creating generic filler reasons just to satisfy the field.

### Explicit Signoff Fields
- Backfill `Signed By` and `Signed At` only when reliable operator and time evidence exists.
- If only completion is known but actor/time is not, prefer leaving signoff fields blank and keeping the row in a manually reviewable earlier status.

### Lifecycle Timestamps
- Preserve or backfill only when evidence exists for:
  - `Awaiting Pre-Listing Review At`
  - `Approved For Publish At`
  - `Listed At`
  - `Stale Listing At`
  - `Sold Ready To Ship At`
  - `Shipped At`
- If timestamps are missing but status is still confidently known, keep the status and leave the timestamp blank unless the app contract requires otherwise.

## Manual Review Bucket

Rows should be moved to manual review when any of these are true:
- source is unclear
- grouped identity is unclear
- multiple statuses appear plausible
- signoff fields cannot be reconstructed confidently
- listing lifecycle state exists but the marketplace channel is unclear
- historical notes conflict with each other

Recommended manual-review output per row:
- record id
- current legacy cues
- proposed normalized status
- reason the row needs review
- operator decision

## Execution Checklist
- [ ] Export and save a full pre-backfill snapshot.
- [ ] Build a dry-run mapping sheet for all in-scope rows.
- [ ] Review ambiguous rows before any write batch starts.
- [ ] Validate the proposed mapping on a small sample first.
- [ ] Execute the approved write batch in controlled chunks.
- [ ] Re-export the table after the batch completes.
- [ ] Compare before/after counts by workflow status.
- [ ] Spot-check grouped submissions and post-publish rows.
- [ ] Capture any rows left for manual review.

## Validation After Execution
- Verify pending-review counts still look plausible.
- Verify accepted rows did not skip directly into later stages without evidence.
- Verify unqualified rows have matching trash state.
- Verify post-publish rows land in the correct channel-specific status.
- Verify Inventory workflow queues render expected counts after the data refresh.
- Verify dashboard stale/sold-ready counts still match the normalized records.

## Rollback Strategy
- Use the pre-backfill export as the source of truth.
- If a batch is wrong:
  - stop further writes
  - isolate the affected record ids
  - restore from the saved snapshot using a controlled corrective batch
- Do not continue layering corrective heuristics on top of a bad first batch without first restoring confidence in the baseline.

## Open Operational Decision
- The repeatable script path now exists at:
  - `scripts/used-gear-workflow-backfill.mjs`
- The script is intentionally conservative:
  - `plan` exports the current table snapshot and creates a reviewed mapping template
  - `apply` only writes rows where an operator has explicitly set `apply: true`
  - writes are hard-locked to the approved workflow table and approved field set

## Script Workflow

### 1. Generate A Review Package
Run:

```bash
npm run workflow:backfill -- plan
```

Artifacts are written under `tmp/used-gear-workflow-backfill/...`:
- `snapshot.json`
- `mapping-template.json`
- `summary.json`

### 2. Review The Mapping Template
- Inspect `mapping-template.json`
- leave uncertain rows as `apply: false`
- only set `apply: true` for rows that have been reviewed and approved for write

### 3. Apply The Reviewed Batch
Run:

```bash
npm run workflow:backfill -- apply --mapping tmp/used-gear-workflow-backfill/<run>/mapping-template.json --confirm APPLY_USED_GEAR_BACKFILL
```

Artifacts are written under a new apply run directory:
- `snapshot-before.json`
- `snapshot-after.json`
- `apply-report.json`

### 4. Validate After Apply
- compare `beforeSummary` and `afterSummary` in `apply-report.json`
- refresh the app and confirm queue counts still look correct
- spot-check any rows that were manually classified before apply

## References
- `docs/used-gear-workflow/data-model-and-approvals.md`
- `docs/used-gear-workflow/schema-update-approval-guide.md`
- `docs/used-gear-workflow/stale-listing-recovery-design.md`
- `docs/used-gear-workflow/phase-1-foundation.md`
- `src/services/usedGearWorkflow.ts`
- `src/services/usedGearQueue.ts`