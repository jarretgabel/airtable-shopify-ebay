## Phase 5: Post-Publish Lifecycle

This phase adds the listing-aging and fulfillment lifecycle after publish behavior is stable.

### Goals
- Surface stale, sold, and shipped states operationally inside the app.
- Add the post-publish queue/review pages needed for daily work.
- Keep automation separate from basic operational visibility.

### Scope
1. Add status aging logic for `LISTED, SHOPIFY`, `LISTED, EBAY`, `STALE LISTING, SHOPIFY`, and `STALE LISTING, EBAY`, using a 30-60 day timer window unless later adjusted with user approval.
2. Design sold/shipped integration for `SOLD - READY TO SHIP` and `SHIPPED`, including sold price, customer notes, shipping metadata, and date shipped.
3. Keep sold/shipped automation behind backend integration readiness rather than bundling it into the first rollout.
4. Add any missing post-publish queue or review pages needed for stale listings, sold-ready-to-ship items, and shipped-history lookup if the existing listing surfaces are insufficient.
5. Define how stale, sold, and shipped transitions surface in the app for operational teams even if backend automation is deferred.

### Dependencies
- Phase 4 publish readiness complete.

### Deliverables
- Stale listing logic.
- Sold/shipped design or implementation based on readiness.
- Any needed stale/sold/shipped queue pages.
- Publish lifecycle writeback from the combined approval flow.

### Exit Criteria
- Stale-listing logic is defined and implemented.
- Sold/shipped integration is designed or delivered based on backend readiness.
- Operational teams can see and work the post-publish states through app pages, not just raw data.
- Publish-ready rows transition into listed workflow lifecycle state without manual Airtable cleanup.

### Relevant Files
- `/Users/user/Sites/airtable-shopify-ebay/src/components/approval/useListingApprovalPublishActions.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/dashboard/DashboardActionsSection.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/components/tabs/AirtableTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/hooks/useUsedGearWorkflowPostPublishSummary.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/usedGearWorkflowLifecycle.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/usedGearQueue.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/hooks/dashboard/insights.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/useActionGuidanceNotifications.ts`
- `/Users/user/Sites/airtable-shopify-ebay/src/app/AppTabContent.tsx`

### Checklist
- [x] Add stale-listing lifecycle logic for Shopify and eBay listing states.
- [x] Use a 30-60 day timer target for stale-listing transitions unless later revised.
- [x] Design sold/shipped workflow integration for the authoritative Airtable row.
- [x] Decide whether sold/shipped automation is ready for implementation or remains design-only.
- [x] Surface stale and sold-ready post-publish work through dashboard action cards and in-app action-guidance notifications.
- [x] Add dashboard insights and filtered Inventory deep links for stale and sold-ready post-publish workflow buckets.

### Implemented Lifecycle Logic
- The combined approval publish action now writes successful workflow rows back into the listed workflow family and captures `Listed At` so post-publish lifecycle state begins automatically when publish succeeds.
- Listed rows are considered stale once `Listed At` is at least 45 days old, which keeps the implementation inside the approved 30-60 day window without introducing a new unapproved setting.
- Listing teams can explicitly move live rows into `Stale Listing, Shopify` or `Stale Listing, eBay`, which also captures `Stale Listing At` for auditability.

### Implemented Operational Queues
- The Inventory tab now includes a post-publish workflow section with four operational buckets: active listings, stale listings, sold ready to ship, and shipped history.
- Listed and stale rows can be promoted into `Sold - Ready to Ship`, which captures `Sold Ready To Ship At`.
- Sold-ready rows can be marked `Shipped`, which captures `Shipped At`.
- Sold-ready and shipped rows now support Airtable-backed `Shipment Follow-Through Notes` with `Shipment Follow-Through Updated At` so packing, carrier, and fulfillment handoff context stays on the workflow row.
- Dashboard action cards now surface stale listings and sold-ready workflow work so operators can spot post-publish issues without opening the Inventory tab first.
- Global in-app action-guidance notifications now prompt inventory users when used-gear listings go stale or sold-ready rows need shipping follow-through.
- Dashboard insights now include used-gear stale-listing and sold-ready signals, and those insight/action shortcuts open the Inventory tab already filtered to the relevant post-publish lifecycle bucket.
- When operators change the post-publish bucket filter manually inside Inventory, the URL now updates in place so the filtered view remains shareable and refresh-safe.
- The post-publish section now includes a copy-link action so operators can share either the full queue view or the currently filtered lifecycle bucket directly from the UI.
- Post-publish search state now syncs into the Inventory URL, and Inventory exposes a reset action that clears all workflow queue search, bucket, and collapsed-group state in one step.
- Post-publish lifecycle buckets can now be collapsed individually or all at once, and that collapsed-bucket layout also syncs into the Inventory URL.
- Inventory now renders active workflow-filter summary chips so operators can confirm which queue searches, bucket filters, and collapsed layouts are active before sharing a link.
- Post-publish sort mode now persists in the Inventory URL, those summary chips can clear individual workflow-state slices, and dashboard stale/sold-ready entry points now show matching bucket chips before operators open the filtered Inventory view.
- Stale workflow rows now support Airtable-backed recovery tracking with `Stale Recovery Status`, `Stale Recovery Notes`, `Stale Recovery Updated At`, and `Relisted At`.
- Stale rows can now be updated in place from the post-publish queue and returned to `Listed, Shopify` or `Listed, eBay` through an explicit `Mark Relisted` action.
- Post-publish cards now support row selection with batch reconciliation helpers so operators can claim queue ownership, move multiple listed or stale rows into `Sold - Ready to Ship`, and move multiple sold-ready rows into `Shipped` without repeating one-row actions.
- Workflow rows now support lightweight ownership metadata through `Workflow Owner` and `Workflow Owner Assigned At`, which keeps queue accountability on the authoritative Airtable row without introducing a separate staffing table.
- The workflow detail page now surfaces the current stale-recovery state as a read-only post-publish audit panel.
- The workflow detail page now includes a shipment follow-through editor and audit panel so sold-ready and shipped rows retain operator notes without requiring separate Airtable history lookups.

### Automation Decision
- Sold and shipped workflow transitions are implemented as explicit in-app operational actions for now.
- Backend automation remains intentionally deferred until marketplace or fulfillment integrations are ready to drive those states with trustworthy events.

### Backlog
- [x] Add richer relist or stale-recovery actions once the team decides how stale inventory should be corrected and republished.
	- Design reference: `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/stale-listing-recovery-design.md`
- [x] Add archived or history-oriented filters so shipped workflow records can be reviewed without crowding active operational buckets.
- [ ] Add optional digest or throttling behavior for stale and sold-ready notifications if queue volume grows.
- [x] Add explicit sold and shipped reconciliation helpers if manual lifecycle actions become too repetitive at scale.
- [x] Add post-publish analytics snapshots for stale age, sold conversion timing, and shipping follow-through.
