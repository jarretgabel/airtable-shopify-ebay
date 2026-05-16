## Historical: Phase 1 Workflow Foundation

> Historical reference only. This document records a completed implementation phase and should not be used as the source of truth for new tasks. Use the docs in the parent folder for current guidance.

This phase defines the workflow model and backend seams that every later UI stage depends on.

### Goals
- Define the approved workflow data model for the in-scope Airtable table.
- Define statuses, transitions, acceptance gates, and grouped-record identity.
- Define the API and app seams needed for later queue and form work.
- Identify all app-owned forms/pages that must change to stay aligned with the approved data model.

### Current State
- Approval/modeling work is complete in `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/data-model-and-approvals.md`.
- The shared workflow/status helper module, configured Airtable/app-api/Lambda source wiring, inventory workflow routing, queue reads/writes, and core workflow UI surfaces are now implemented in code.
- The explicit API contract now lives in `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/workflow-api-contracts.md`.
- The app-owned surface audit now lives in `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/surface-audit-checklist.md`.
- The approved backfill approach is now paired with an operational runbook in `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/backfill-runbook.md`.
- The remaining foundation work is mostly execution of later-phase UI surfaces rather than missing Phase 1 seam definition.

### Scope
1. Define the Airtable fields/views needed in the existing table for: submission source, submission/pick-up group id, trash flag, accepted-by metadata, accepted-at date, workflow status, arrival-date sorting, customer-submitted condition/function/inclusions/photo reference fields, internal-assessment equivalents, per-item offer amount, per-item paid amount, optional confirmed grand total amount, allocation mode, reviewer/tester/photographer/listing signatures, stage-completed dates, and any acceptance-gate fields required to move an intake record into Lot 2.
2. Create a shared workflow/status domain model in the app for lot 1, lot 2, trash state, routing targets, sort/group behavior, allocation math, and single-source-of-truth rules.
3. Extend the Airtable/app-api/Lambda seams for queue reads, JotForm qualification actions, manual-entry routing, accept/unqualify/trash mutations, grand-total allocation writes, distinct offer/paid amount writes, and stage transition updates.
4. Define the record identity strategy for grouped submissions, including how a submission id, pick-up id, and per-item record id relate to each other through the workflow.
5. Define transition guards so records cannot skip required stages or enter invalid statuses without the required data.
6. Plan how existing records in `tbl0K0nFQL64jQMx8` will be backfilled or normalized into the new workflow states without breaking current operations.
7. Identify all app-owned forms and workflow pages that must add or revise fields so the UI remains aligned with the approved Airtable/workflow model.

### Dependencies
- User approval is required before adding any new Airtable fields to `tbl0K0nFQL64jQMx8`.
- Any additional tables remain out of scope unless separately approved as reference tables only.

### Deliverables
- Approved field/status proposal.
- Approved record identity and transition model.
- API contract list for queue and stage mutations.
- UI surface impact list for all app-owned forms/pages that must be updated.
- Backfill/normalization plan for existing rows.
- Separate improvements backlog for non-blocking follow-up work.

### Exit Criteria
- Workflow statuses and transitions are defined.
- API contracts are defined.
- Acceptance gating and required qualifying information are defined for Lot 2 routing.
- Offer amount, paid amount, and grand-total allocation behavior are defined explicitly.
- Record identity, transition guards, and backfill strategy are defined.
- The list of app-owned UI surfaces that need field additions or revisions is defined.
- No Airtable field additions occur without user approval.

### Relevant Files
- `/Users/user/Sites/airtable-shopify-ebay/src/services/app-api/airtable.ts`
- `/Users/user/Sites/airtable-shopify-ebay/aws/src/providers/airtable/sources.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/inventoryDirectory.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/usedGearWorkflow.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/auth/pages.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/appNavigation.ts`
- `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/workflow-api-contracts.md`
- `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/surface-audit-checklist.md`
- `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/backfill-runbook.md`
- `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/phase-1-improvements-checklist.md`

### Checklist
- [x] Design the final Airtable field schema and view layout for Lot 1, Lot 2, trash, and stage handoffs.
- [x] Get user approval before adding any new fields to `tbl0K0nFQL64jQMx8`.
- [x] Define the exact workflow status vocabulary and transition rules.
- [x] Define the required qualifying information needed before an item can move from Lot 1 to Lot 2.
- [x] Define the customer-submitted vs internal-assessment field mapping matrix.
- [x] Define offer amount vs paid amount behavior and grand-total allocation rules.
- [x] Define the exact API contracts for queue actions and JotForm qualification.
- [x] Add the workflow/status domain helpers in the app.
- [x] Extend the app-api and Lambda seams for workflow reads and writes.
- [x] Identify all app-owned forms/pages that need new or revised fields to stay aligned with the approved data model.
- [ ] Implement remaining field-alignment changes on later-phase surfaces as those pages are built or reused.

### Implementation Notes
- The approved workflow/status model is now encoded in a shared app-side helper module so later queue pages, mutations, and validation flows can reuse one source of truth.
- The used-gear workflow configured source is now wired through the client app-api and Lambda handlers, so workflow queue reads and stage/status writes use the same approved contract path as the other configured Airtable sources.
- Inventory now hosts the first workflow-native queue/detail surfaces and direct-link routing, which means a substantial portion of the phase-1 routing/UI seam work is complete even though later parking-lot/manual-intake surfaces still remain for Phase 2.
- The approved backfill/normalization strategy already lives in `data-model-and-approvals.md`; the runbook in `backfill-runbook.md` turns that strategy into an execution checklist for the eventual migration window.
- The new surface audit separates surfaces that are already aligned from surfaces that are intentionally deferred, so later phases can focus on implementation instead of rediscovering scope.

### Backlog
- Maintain the detailed Phase 1 deferred-work list in `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/phase-1-improvements-checklist.md`.
- Add future Phase 1 suggestions there whenever they improve workflow reliability or usability but are not required to preserve the current base functionality.

