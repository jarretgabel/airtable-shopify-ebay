# Ownership History Audit Design

This note describes the smallest schema-safe path to move from the current latest-owner timestamp model to true multi-step ownership history.

## Current State
- The app currently stores the latest owner in `Workflow Owner`.
- The app currently stores the latest assignment timestamp in `Workflow Owner Assigned At`.
- Queue cards and the workflow timeline can show the latest owner-assigned event, but they cannot reconstruct older reassignments.

## Gap
- We can answer who owns the row now.
- We can answer when the current owner was assigned.
- We cannot answer who owned the row before that, how many reassignments occurred, or why ownership changed.

## Smallest Safe Addition
Add one append-only text field to the workflow row:

- `Workflow Ownership Audit Log`

Store newline-delimited JSON objects or a compact JSON array, with each entry containing:

- `timestamp`
- `actor`
- `fromOwner`
- `toOwner`
- `reason`
- `source`

Example event:

```json
{
  "timestamp": "2026-05-12T20:00:00.000Z",
  "actor": "Taylor Reviewer",
  "fromOwner": "Jordan Processor",
  "toOwner": "Chris Lister",
  "reason": "handoff",
  "source": "workflow-record"
}
```

## Why This Is The Smallest Safe Step
- No new linked tables are required.
- Existing queue reads keep working because the current owner fields remain the source of truth.
- The audit field can be ignored by old clients until timeline/history UI is ready.
- The backend can append events whenever `assignWorkflowOwner` or `clearWorkflowOwner` runs.

## Recommended Write Rules
- Keep `Workflow Owner` and `Workflow Owner Assigned At` as the current-state fields.
- Append an audit event whenever ownership changes.
- Do not overwrite older audit entries.
- When clearing owner, write `toOwner: null`.
- Record the UI source when available, such as `pending-review-queue`, `progress-queue`, `post-publish-queue`, or `workflow-record`.

## Recommended UI Follow-Up
- Timeline:
  - show every ownership event, not just the latest assignment
- Queue cards:
  - keep the current lightweight `Last touched` summary
  - optionally show `reassigned 3 times` when the audit log length is greater than 1
- Workflow detail:
  - add a compact Ownership History section under the current owner controls

## Migration Strategy
1. Add `Workflow Ownership Audit Log` to Airtable.
2. Update backend ownership write helpers to append audit entries.
3. Keep reading `Workflow Owner` and `Workflow Owner Assigned At` exactly as today.
4. Add read-side parsing in the timeline service once the field is populated.
5. Backfill the current owner into a single synthetic `initial-state` event only if historical consistency is needed.

## Non-Goals
- This does not require a dedicated audit table.
- This does not require schema changes to every queue component immediately.
- This does not attempt to recover historical ownership from Airtable revision history.