## Original Requirements

This document captures the original user requirements and guardrails for the used-gear workflow project before implementation details were split across phase docs.

### Purpose
- Preserve the source requirements in one place so later implementation work can be checked against the original request, not just the current code.
- Separate original intent from phased rollout tasks, backlogs, and implementation refinements.
- Make it easier to review whether later changes still respect the approved workflow boundaries.

### Scope And Guardrails
- Use the existing Airtable-backed inventory workflow rather than introducing a separate intake system.
- Limit direct Airtable changes to table `tbl0K0nFQL64jQMx8` in base `apprsAm2FOohEmL2u`.
- Require explicit approval before adding or relying on any new Airtable fields.
- Do not modify the live JotForm itself or other external systems as part of this rollout.
- Do not preserve legacy workflow URLs, retired workflow detail pages, or compatibility-only routing/code paths unless a later requirement explicitly asks for them.
- If other Airtable tables are ever needed, treat them as reference-only tables linked back to the in-scope workflow rows instead of duplicating business data.

### Intake Workflow Requirements
- Rework the existing JotForm area into an app-first intake workflow.
- Create two parking lots:
  - Parking Lot 1 for pending review intake triage.
  - Parking Lot 2 for accepted intake rows awaiting arrival, SKU, or missing-item follow-up.
- Route unqualified intake rows into a trash workflow instead of deleting them immediately.
- Make manual entry mirror the JotForm intake experience as closely as practical.
- Allow manual entry to land in Parking Lot 1 by default or be routed directly into Parking Lot 2 in special cases.
- Support grouped intake review by `Submission Group ID` and `Pick Up ID`.

### Workflow Status And Routing Requirements
- `Workflow Status` is the authoritative workflow-state field.
- `Workflow Intake Decision` and `Workflow Next Team` are derived instead of separately stored.
- Approved intake statuses include:
  - `Pending Review`
  - `Unqualified`
  - `Accepted - Awaiting Arrival`
  - `Accepted - Arrived, Awaiting SKU`
  - `Accepted - Arrived, Awaiting Missing Item`
  - `Testing and Photography In Progress`
  - `Awaiting Pre-Listing Review`
  - `Approved for Publish`
- Testing and photography are allowed to proceed concurrently.
- The second of testing or photography completion should advance a row to `Awaiting Pre-Listing Review`.

### Acceptance Gate Requirements
- Intake may move from Parking Lot 1 into an accepted Lot 2 state only when the qualification gate passes.
- Qualification requires:
  - `Qualification Complete`
  - `Accepted By`
  - `Accepted At`
  - qualification notes
  - at least one pricing path:
    - `Offer Amount`, or
    - `Paid Amount`, or
    - grouped `Confirmed Grand Total`
- Multi-item accepted submissions must have `Submission Group ID` populated.

### Pricing And Allocation Requirements
- `Offer Amount` and `Paid Amount` are distinct item-level values.
- `Confirmed Grand Total` applies at the grouped-submission level.
- Default group allocation mode is `Equal Split`.
- Staff must be able to switch to `Manual Override` and edit per-item values after allocation.

### Data Separation Requirements
- Preserve customer-submitted condition, function, inclusion, and photo-reference information separately from internal staff assessment.
- Do not overwrite customer-origin notes with internal processing or listing notes.

### App Surface Requirements
- Add new app-owned queue pages, detail pages, and review pages where necessary to make the workflow usable without falling back to Airtable directly.
- Keep operational queues, listing review, and lifecycle context inside the existing app shell.
- Preserve direct-link routing for queue and review surfaces.
- Keep shareable queue links and URL-backed state where practical so teams can hand off work cleanly.

### Notification Requirements
- Phase 1 notifications are in-app only.
- Workflow event notifications should be configurable per user inside the app.

### Listing And Post-Intake Requirements
- Reuse the existing Incoming Gear, Testing, Photos, and combined listing approval surfaces where possible.
- Preserve workflow context as rows move into listing approval and publish flows.
- Keep post-publish lifecycle work operational inside the app even if external sold/shipped automation remains deferred.

### Deferred Or Explicitly Out-Of-Scope Work
- Changes to the live JotForm itself.
- New external-system automations as part of the initial intake rollout.
- Schema changes in other Airtable tables without explicit approval.
- Automatic sold/shipped integrations before the workflow foundation is stable.