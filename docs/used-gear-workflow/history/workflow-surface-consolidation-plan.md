# Historical: Workflow Surface Consolidation Plan

> Historical reference only. This document records prior planning for the workflow-surface consolidation effort and may describe retired workflow-detail behavior. Do not use it as the source of truth for new implementation tasks. Use the docs in the parent folder for current guidance.

This document consolidates the approved direction for simplifying the used-gear workflow surfaces while preserving the current workflow state machine and audit requirements.

## Purpose
- Remove unnecessary review pages and duplicated workflow actions.
- Keep the overall operational workflow intact.
- Make each page responsible for one kind of work: overview, form completion, or listing review.
- Keep the app lean by avoiding new surfaces, states, or abstractions beyond the required workflow steps and the minimum supporting behavior needed to operate them cleanly.
- Keep the filesystem and implementation work traceable through a dedicated checklist.
- Keep the consolidation aligned with `docs/used-gear-workflow/original-requirements.md` so later implementation changes do not drift past the originally approved workflow boundaries.

## Original Requirement Guardrails
- Keep this work inside the existing Airtable-backed inventory workflow rather than introducing a separate intake system.
- Do not add or rely on new Airtable fields for this consolidation without explicit approval.
- Do not modify the live JotForm or add new external-system automations as part of this consolidation.
- If related Airtable tables are ever referenced, treat them as reference-only support data rather than duplicated workflow data stores.
- Preserve manual-entry parity with the intake experience wherever workflow surfaces are reused or reorganized.
- Preserve grouped intake handling by `Submission Group ID` and `Pick Up ID`.
- Preserve pricing and allocation behavior, including grouped `Confirmed Grand Total`, default `Equal Split`, and staff-driven `Manual Override`.
- Preserve the separation between customer-submitted notes and internal staff notes.
- Preserve direct-link routing, shareable queue links, URL-backed working state, and per-user in-app notification configurability as surfaces are consolidated.

## Core Decisions
- Keep the authoritative workflow states and audit fields.
- Prefer the simplest implementation that satisfies the workflow; do not add extra workflow layers, optional systems, or UI concepts unless they are required to support intake, processing, listing, or later lifecycle work.
- Reuse the intake page template and page-level layout conventions for other workflow directory and record surfaces wherever it fits, so new or refactored pages stay visually and structurally consistent without introducing one-off page shells.
- Keep Parking Lot intake surfaces for intake qualification and routing.
- Add or repurpose a downstream post-intake parking lot that holds accepted rows while Testing and Photography complete their work.
- Keep dedicated Testing and Photography overview pages with sorting, filtering, search, and URL-backed working state.
- Make the Testing form the only place that completes testing.
- Make the Photos form the only place that completes photography.
- Remove dedicated pre-listing review pages as standalone workflow destinations.
- Move pre-listing review, listing readiness, and publish-facing review modules onto listing pages.
- Restrict the Listings directory to rows that have already completed both testing and photography.

## Target Workflow Lifecycle

### 1. Intake Phase
- Parking Lot 1 handles pending-review intake triage, grouped intake review, qualification notes, and accept versus unqualify decisions.
- Parking Lot 2 handles accepted downstream intake work that still belongs to intake and arrival handling.
- Trash Review handles restore, re-qualify, or deletion decisions for rejected intake rows.

### 2. Post-Intake Holding Phase
- Once a row is approved to continue beyond the parking lots, it should move into a downstream operational holding state rather than appearing in Listings.
- This downstream holding state is effectively another parking lot after intake, dedicated to the shared Testing and Photography phase.
- This holding state is the operational pool for Testing and Photography.
- These rows belong in Testing and Photography overview pages, not in the Listings directory.
- The implementation may reuse existing workflow states and queue pages, but the product behavior should clearly reflect this separate post-intake parking lot.

### 3. Testing And Photography Phase
- Testing and Photography can still proceed concurrently.
- Testing operators work from a testing directory page that shows all rows requiring testing attention.
- Photography operators work from a photography directory page that shows all rows requiring photography attention.
- These directory pages should support filtering, sorting, searching, grouped submission awareness, ownership cues, and URL-backed queue state.
- Individual edits and completion actions happen from the forms, not from review pages.

### 4. Listing Review Phase
- A row enters the listing phase only after both Testing and Photography are complete.
- `Awaiting Pre-Listing Review` becomes the first listing-phase state.
- Listings becomes the operational home for:
  - final listing review
  - listing-specific corrections
  - publish readiness checks
  - approve-for-publish actions
  - approved-for-publish work
  - listed and post-listing lifecycle work that already belongs on listing surfaces

### 5. Post-Publish Lifecycle Phase
- Existing listed, stale, sold-ready, and shipped lifecycle states remain intact.
- Post-publish lifecycle actions can stay on their current listing or workflow-owned surfaces until separately redesigned.

## Visibility Rules By Surface

### Parking Lot Surfaces
- Show intake-owned rows only.
- Do not show rows that have already moved into downstream testing and photography work unless a specific restore or audit path requires it.

### Testing Directory Page
- Show rows in the downstream holding parking lot or shared testing-and-photography work pool.
- Show rows still missing testing completion.
- Do not require the user to open the form first to understand what needs attention.

### Photography Directory Page
- Show rows in the downstream holding parking lot or shared testing-and-photography work pool.
- Show rows still missing photography completion.
- Do not require the user to open the form first to understand what needs attention.

### Listings Directory Page
- Show only rows that have completed both testing and photography.
- Treat `Awaiting Pre-Listing Review` as the first listing-phase state shown in the Listings directory.
- Do not show `Testing and Photography In Progress` rows in Listings.
- Keep later states such as `Approved for Publish`, `Listed, Shopify`, `Listed, eBay`, stale listing states, and later lifecycle states in Listings as appropriate.

## Surface Ownership Model

### Intake Pages
- Own intake routing decisions.
- Own qualification and unqualification actions.
- Own grouped intake context and arrival-routing decisions.

### Testing Directory And Form
- Directory page owns overview, prioritization, filtering, and navigation into work.
- Testing form owns field edits, attachments, and testing completion.
- Testing completion audit fields must be written by the form submit path for workflow-owned rows.

### Photography Directory And Form
- Directory page owns overview, prioritization, filtering, and navigation into work.
- Photos form owns field edits, attachments, and photography completion.
- Photography completion audit fields already belong on the form submit path and should stay there.

### Listings Directory And Listing Record Page
- Listings directory owns the listing-team queue and overview.
- Selected listing record pages own:
  - readiness review
  - missing-data blocker presentation
  - reviewer confirmation
  - approve-for-publish action
  - publish actions and publish-adjacent edits
- Listing pages should absorb any pre-listing review modules that currently live on workflow detail pages.

### Workflow Detail Page
- Workflow detail should no longer be the primary place where teams complete testing or photography or perform final pre-listing review.
- After the consolidation, it should either:
  - become a lighter audit/history page, or
  - be removed entirely if its remaining functions are moved elsewhere.

## Workflow States To Preserve
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

## Audit Fields To Preserve
- `Accepted By`
- `Accepted At`
- `Processing Signed By`
- `Processing Signed At`
- `Testing Signed By`
- `Testing Signed At`
- `Photography Signed By`
- `Photography Signed At`
- `Pre-Listing Reviewed By`
- `Pre-Listing Reviewed At`
- `Awaiting Pre-Listing Review At`
- `Approved For Publish At`
- any later lifecycle timestamps already used by the workflow

## Filesystem Scope

### Frontend Navigation And Routing
- Reorganize the app-shell workflow navigation to follow the real work sequence: `Intake > Processing > Listing`.
- Group intake-owned pages first, processing-owned pages second, and listing-owned pages last.
- Keep the ordering lean and task-oriented rather than preserving legacy tab order.
- Reuse the intake page template for processing and listing pages where possible instead of creating separate page-shell patterns.
- Remove the dedicated pre-listing page route and tab.
- Keep Testing and Photography overview pages as standalone workflow pages.
- Repoint pre-listing notifications and dashboard links into Listings.

### Workflow Forms And Services
- Update Testing form submit behavior so it writes workflow signoff fields the same way Photos already does for workflow-owned rows.
- Keep Photos form workflow signoff behavior intact.
- Keep grouped-pricing, allocation, and customer-versus-internal note behavior unchanged unless separately approved.

### Listing Pages
- Extend the listing queue and selected-record experience to include listing-phase review work beginning at `Awaiting Pre-Listing Review`.
- Move pre-listing readiness and reviewer confirmation modules onto listing pages.

### Dashboard And Notifications
- Update dashboard shortcuts and notifications to reflect the new ownership of testing, photography, and listing review surfaces.
- Keep notification behavior in-app and preserve per-user workflow notification configurability.

### Auth And Page Access
- Remove `pre-listing-queue` from page definitions and role/grouping logic once the listing experience fully absorbs it.
- Keep testing and photography page access intact.

### Documentation And Tests
- Update workflow guide, operator guide, surface map, release smoke checklist, and any queue-specific documentation.
- Update unit tests that reference the removed route, old queue ownership, or workflow-detail review behavior.
- Re-check documentation changes against the original requirements for manual-entry parity, grouped intake handling, pricing/allocation rules, and data-separation rules.

## Phased Implementation Plan

### Phase 1. Make Forms The Only Stage-Completion Surfaces
1. Update the Testing form service so workflow-owned rows receive `Testing Signed By` and `Testing Signed At` on submit.
2. Keep Photos form workflow signoff behavior as the reference implementation.
3. Remove testing and photography completion buttons from workflow-detail and review-style surfaces.
4. Preserve testing and photography overview pages for work discovery and filtering.

### Phase 2. Strengthen Testing And Photography Directory Pages
1. Keep dedicated Testing and Photography overview pages in the app shell.
2. Make the post-intake parking lot behavior explicit in those overview pages so accepted rows are clearly visible before listing-phase work begins.
3. Reuse the intake page template structure for Testing and Photography directory pages where practical.
4. Ensure both pages support:
   - search
   - filters
   - sort modes
   - grouped-submission awareness
   - owner and aging visibility
   - URL-backed state
5. Make these pages the operational overview for downstream intake items waiting in the post-intake parking lot for testing or photography work.
6. Keep completion on the forms, not the overview pages.

### Phase 3. Move Pre-Listing Review Into Listings
1. Treat `Awaiting Pre-Listing Review` as the first listing-phase state.
2. Add a listing-phase queue bucket for rows awaiting final listing review.
3. Reuse the intake page template structure for listing-phase directory and detail pages where it fits the workflow.
4. Move the current reviewer-and-pricing gate modules from workflow detail into listing selected-record pages.
5. Keep the explicit approve-for-publish transition and audit writes.
6. Keep blocker actions that route users to Incoming Gear, Testing, Photos, or pricing tools when upstream data is missing.

### Phase 4. Remove The Dedicated Pre-Listing Route
1. Remove the `pre-listing-queue` page definition, route handling, and app-shell tab.
2. Remove direct-link logic that assumes `/workflow/pre-listing` remains a destination.
3. Repoint dashboard cards, notifications, and quick actions to Listings.
4. Remove page-access references for `pre-listing-queue` from frontend and shared auth/access code.
5. Preserve equivalent direct-link and audit/history access through the remaining in-app workflow surfaces.

### Phase 5. Reorganize Navigation Around Workflow Order
1. Reorder workflow navigation to match the operational sequence `Intake > Processing > Listing`.
2. Place Parking Lot and other intake surfaces before processing surfaces.
3. Place Testing and Photography overview surfaces before listing surfaces.
4. Ensure Listings appears only after the processing surfaces in navigation.
5. Keep the navigation model lean by avoiding redundant groups or duplicate destinations.

### Phase 6. Reassess Workflow Detail
1. Keep workflow detail only if it still provides unique audit or lifecycle value.
2. If retained, narrow it to history, grouped context, and audit-only functions.
3. If all practical actions move to forms, directories, and listings, remove the page entirely.

## Recommended Implementation Order
1. Update Testing form workflow signoff behavior.
2. Remove duplicate testing and photography completion actions from workflow detail.
3. Improve Testing and Photography directory pages where needed so overview behavior is strong enough to replace review pages.
4. Add listing-phase queue buckets and move pre-listing review modules into listing pages.
5. Repoint notifications, dashboard shortcuts, and route targets from `pre-listing-queue` to Listings.
6. Reorganize navigation into `Intake > Processing > Listing` order.
7. Remove the dedicated pre-listing route and access references.
8. Clean up docs, smoke tests, and workflow guide copy.

## Key Acceptance Criteria
- Parking Lot approval no longer makes rows appear prematurely in Listings.
- Accepted rows first appear in a downstream post-intake parking lot represented through the Testing and Photography overview pages.
- Testing completion happens only from the Testing form.
- Photography completion happens only from the Photos form.
- Listings shows only rows that have completed both testing and photography.
- Listing review and approve-for-publish work happen on listing pages, not dedicated review pages.
- The workflow state machine and audit fields remain intact.
- Notifications, dashboard links, and auth/access rules reflect the new surface ownership.

## Related Tracking Files
- Checklist: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/workflow-surface-consolidation-checklist.md`
