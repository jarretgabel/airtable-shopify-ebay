## Plan: Used Gear Workflow

This file is the master index for the Used Gear workflow rollout. Keep detailed implementation work in the linked phase and support docs, and use this file for constraints, phase order, and rollup progress.

Implement the workflow on top of the existing Airtable-backed inventory system by treating the user-provided Airtable table as the system of record, adding workflow-specific fields/views and new queue-oriented UI around the current JotForm, Incoming Gear, Testing, Photos, and listing-approval surfaces. Phase 1 should deliver the two intake parking lots, acceptance/unqualified routing, prepopulation into existing processing forms, staff-vs-customer data separation, in-app notifications, per-user workflow event notification preferences, and explicit handoffs between stages. External notifications and sale/shipping automations should be planned as follow-on phases behind stable status modeling and server endpoints.

**Airtable Scope And Change Control**
- The only Airtable table in scope for direct schema/view/process changes is `tbl0K0nFQL64jQMx8` in base `apprsAm2FOohEmL2u`.
- Working table URL: `https://airtable.com/apprsAm2FOohEmL2u/tbl0K0nFQL64jQMx8/viwZdrQSBohX1m35D?blocks=hide`
- Base table URL: `https://airtable.com/apprsAm2FOohEmL2u/tbl0K0nFQL64jQMx8`
- Workflow implementation changes should be confined to this app and the in-scope Airtable table only.
- Do not modify the live JotForm itself or any other external service as part of this workflow implementation.
- App-owned forms, review pages, queue pages, and listing-prep pages may add or update site-side fields and controls as needed to stay in sync with the approved workflow/data model.
- If implementation appears to require any additional fields in `tbl0K0nFQL64jQMx8`, stop and alert the user first for approval before adding or relying on those fields.
- If implementation work appears to require schema or workflow changes in JotForm storage, another Airtable table, or any supporting table outside `tbl0K0nFQL64jQMx8`, stop and notify the user first.
- Before touching any other table, create and use a development table under the same base as an isolated proving ground, then get explicit approval before expanding scope.
- If additional tables are ever approved, they must be reference tables that link back to rows in `tbl0K0nFQL64jQMx8` rather than duplicate the same business data across multiple tables.
- The plan below should be interpreted with this constraint: prefer extending `tbl0K0nFQL64jQMx8` over introducing new tables, and if new tables are approved they should hold references, workflow projections, or helper metadata only.

**Document Map**

**Master And Support Docs**
- [Original requirements](./used-gear-workflow/original-requirements.md)
- [Data model and approvals](./used-gear-workflow/data-model-and-approvals.md)
- [UI surface map](./used-gear-workflow/ui-surface-map.md)
- [Operator guide](./used-gear-workflow/operator-guide.md)
- [Backfill runbook](./used-gear-workflow/backfill-runbook.md)
- [Schema update approval guide](./used-gear-workflow/schema-update-approval-guide.md)
- [Stale listing recovery design](./used-gear-workflow/stale-listing-recovery-design.md)
- [Phase 1 improvements checklist](./used-gear-workflow/phase-1-improvements-checklist.md)

**Phase Docs**
- [Phase 1: Workflow Foundation](./used-gear-workflow/phase-1-foundation.md)
- [Phase 2: Intake And Parking Lots](./used-gear-workflow/phase-2-intake-and-parking-lots.md)
- [Phase 3: Processing Stages And Handoffs](./used-gear-workflow/phase-3-processing-and-handoffs.md)
- [Phase 4: Pre-Listing And Publish Readiness](./used-gear-workflow/phase-4-pre-listing-and-publish-readiness.md)
- [Phase 5: Post-Publish Lifecycle](./used-gear-workflow/phase-5-post-publish-lifecycle.md)
- [Phase 6: Marketplace Expansion](./used-gear-workflow/phase-6-marketplace-expansion.md)

**Execution Order**
1. Phase 1 — Foundation and approvals.
2. Phase 2 — Intake and parking lots.
3. Phase 3 — Processing stages and handoffs.
4. Phase 4 — Pre-listing and publish readiness.
5. Phase 5 — Post-publish lifecycle.
6. Phase 6 — Marketplace expansion.

**Backlog Maintenance Rule**
- Each phase doc should keep a backlog section for ideas that would improve the workflow but are not required for that phase's base functionality.
- When new non-blocking suggestions come up during implementation or review, add them to the backlog section of the most relevant phase doc instead of mixing them into the required checklist.
- A backlog item can move into the required checklist later if the user decides it is necessary for the base rollout.

**Rollup Checklists**

Phase-level status lives here. Detailed tasks live in the linked phase docs.

**Verification**
1. Create a representative Airtable test matrix covering: JotForm multi-item submission accepted into Lot 2, JotForm unqualified into trash, manual entry routed to Lot 1, manual entry routed directly to Lot 2, accepted gear awaiting arrival, arrived gear awaiting SKU, arrived gear awaiting item, and full stage progression through Ready to Test, Tested, Photo complete, Ready to Publish, Listed, Sold, and Shipped.
2. Run targeted frontend tests for new workflow helpers, queue components, and form-service mappings with `npm run test`.
3. Run Lambda/API parity validation for new workflow reads via `npm run compare:lambda`; use guarded write probes only for opt-in mutation validation once endpoints exist.
4. Run `npm run build` after each major phase, especially after route additions and form/service extractions.
5. Manually verify in the UI that: Lot 1 and Lot 2 sort/group correctly, accepted JotForm submissions prefill Incoming Gear, customer-submitted fields remain distinct from internal assessments, form completion advances status and signatures, and next-team in-app notifications appear.
6. Manually verify that the pre-listing review hands off correctly into the existing combined approval/listing surfaces for the specified Airtable table.
7. Manually verify that the combined listing approval screen and publish confirmation retain workflow status/title/price context after the handoff from workflow review.
8. Manually verify that successful publishes move workflow rows into listed lifecycle state, that the Inventory post-publish queue can move rows through stale, sold-ready, and shipped states, and that dashboard insights, dashboard actions, and action-guidance cues reflect those counts and open the correct filtered Inventory bucket.

**Decisions**
- Use the existing Airtable table provided by the user as the workflow system of record rather than introducing a separate intake table.
- Limit direct Airtable adjustments to `tbl0K0nFQL64jQMx8` only.
- Require explicit user approval before adding any new fields to `tbl0K0nFQL64jQMx8`.
- Keep workflow implementation changes inside this app; do not modify the live JotForm or any other external service.
- Allow app-owned forms and pages to add or revise fields as needed to remain in sync with the approved workflow/data model.
- If any changes are needed in JotForm-adjacent storage or another Airtable table, create a development table under the same base and notify the user before proceeding.
- Do not duplicate business data across Airtable tables; if additional tables are approved, use reference tables linked back to rows in `tbl0K0nFQL64jQMx8` so the data stays authoritative in one place.
- Keep notifications to in-app alerts, badges, and dashboard/action-guidance cues in phase 1.
- Allow workflow event notifications to be configured per user inside the app rather than relying on a fixed team-wide recipient list.
- Treat unqualified submissions as soft-deleted records in a trash area with later manual cleanup, not immediate deletion.
- Use equal split as the default grand-total allocation strategy, with per-item edits allowed immediately after allocation.
- Treat offer amount and paid amount as distinct item-level values when the workflow requires both.
- Preserve customer-submitted data as a distinct reference layer; do not overwrite it with staff-entered assessment fields.
- The manual entry form should mimic the JotForm intake experience and collect equivalent intake information through this app's own UI.
- Add new app pages and forms wherever they are missing and materially improve the usability of the workflow, especially for parking lots, queue review, trash cleanup, stage-specific queues, and pre-listing review.
- Reuse the current Inventory Processing forms and listing approval architecture rather than replacing them.
- Preserve workflow review context after handoff into the combined listing approval surface so the listing team can validate the approved title, price, and reviewer state before live publish.
- Keep post-publish lifecycle transitions operational inside the app even while external sold/shipped automation remains deferred.

**Further Considerations**
1. The cleanest data model is to add a small shared workflow module that explicitly defines queue/state semantics even if Airtable still owns option metadata; otherwise queue behavior will remain too dependent on free-form Airtable labels.
2. If cross-table organization becomes necessary later, use linked-record reference tables keyed to the primary row in `tbl0K0nFQL64jQMx8` instead of copying the same item fields into secondary tables.
3. Pre-listing should likely be a dedicated review tab under Inventory Processing rather than a hidden mode inside the existing approval editors, because it is a stage handoff with operational signoff, not just listing-field editing.
4. Sold/shipped automation should be treated as a backend integration project with webhook or polling design, not bundled into the initial intake/processing rollout.
5. The workflow will likely need more than just form screens; queue pages, detail/review pages, and stage landing pages should be added where needed so staff do not have to jump between generic directory views and Airtable.

**Phase Checklists**

Progress tracking rule:
- As implementation work is completed and verified, update the corresponding checklist items in this document from `[ ]` to `[x]` so this plan remains the current source of truth for workflow progress.
- As new non-blocking recommendations come up, add them to the backlog section in the relevant phase doc so deferred work stays visible without expanding the required phase scope.

**Phase 0: Planning And Approval Gates**
[x] Reviewed current Inventory Processing architecture in the app.
[x] Audited existing Incoming Gear, Testing, Photos, and Inventory Directory surfaces.
[x] Audited current JotForm loading, display, and notification behavior.
[x] Audited current listing approval and lifecycle surfaces for Shopify/eBay.
[x] Locked the workflow to the existing Airtable table as the system of record.
[x] Limited direct Airtable changes to `tbl0K0nFQL64jQMx8`.
[x] Added the rule to alert the user first for approval before adding any new fields to `tbl0K0nFQL64jQMx8`.
[x] Added the rule to create a development table and notify the user before changing another table or JotForm-related storage.
[x] Added the rule to avoid duplicated Airtable data and to use reference tables linked to `tbl0K0nFQL64jQMx8` if additional tables are ever approved.
[x] Scoped notifications to in-app only for phase 1.
[x] Chose soft-delete/trash handling for unqualified submissions.
[x] Chose equal split as the default grand-total allocation rule.
[x] Drafted the end-to-end workflow implementation plan.
[x] Saved the implementation plan to `/memories/session/plan.md`.
[x] Saved the consolidated plan to `docs/used-gear-workflow-plan.md`.
[x] Linked the plan from `docs/forms/README.md`.

**Phase 1: Workflow Foundation**
- [ ] Complete Phase 1. See [Phase 1: Workflow Foundation](./used-gear-workflow/phase-1-foundation.md).

**Phase 2: Intake And Parking Lots**
- [x] Complete Phase 2. See [Phase 2: Intake And Parking Lots](./used-gear-workflow/phase-2-intake-and-parking-lots.md).

**Phase 3: Processing Stages And Handoffs**
- [x] Complete Phase 3. See [Phase 3: Processing Stages And Handoffs](./used-gear-workflow/phase-3-processing-and-handoffs.md).

**Phase 4: Pre-Listing And Publish Readiness**
- [x] Complete Phase 4. See [Phase 4: Pre-Listing And Publish Readiness](./used-gear-workflow/phase-4-pre-listing-and-publish-readiness.md).

**Phase 5: Post-Publish Lifecycle**
- [x] Complete Phase 5. See [Phase 5: Post-Publish Lifecycle](./used-gear-workflow/phase-5-post-publish-lifecycle.md).

**Phase 6: Marketplace Expansion**
- [x] Complete Phase 6. See [Phase 6: Marketplace Expansion](./used-gear-workflow/phase-6-marketplace-expansion.md).

**Cross-Phase Verification**
[ ] Create a representative Airtable test matrix for the full workflow.
[ ] Add tests for workflow helpers, routing, and form transitions.
[ ] Add tests for allocation math, transition guards, trash restore/delete flows, and queue activation by SKU or row selection.
[ ] Add tests for new route wiring, page access, and direct-link behavior.
[ ] Validate Lambda/API parity and guarded write paths.
[ ] Validate any data backfill or normalization steps for existing rows before rollout.
[ ] Run `npm run build` after each major phase.
[ ] Update workflow documentation for every new page, route, and form added during implementation.
[ ] Run full implementation verification in the UI.

**Artifacts**
- Plan: `/memories/session/plan.md`
- Inventory exploration: `/memories/session/inventory-processing-exploration.md`
- JotForm exploration: `/memories/session/jotform-exploration-findings.md`