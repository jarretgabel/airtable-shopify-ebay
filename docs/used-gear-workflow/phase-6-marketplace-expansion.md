## Phase 6: Marketplace Expansion

This phase treats new marketplaces as follow-on work after the core workflow is stable.

### Goals
- Evaluate new marketplace targets without weakening the single-row source-of-truth model.
- Reuse the same workflow model rather than spawning separate marketplace-specific intake flows.

### Scope
1. Evaluate Craigslist and Facebook Marketplace as additional publish targets.
2. Reuse the same single-row inventory source-of-truth and stage model instead of creating separate duplicated workflows.

### Dependencies
- Phase 4 and Phase 5 are stable enough that marketplace expansion is not masking core workflow issues.

### Exit Criteria
- Marketplace expansion is scoped without weakening the primary workflow model.

### Relevant Files
- `/Users/user/Sites/airtable-shopify-ebay/src/components/approval/CombinedListingsApprovalTab.tsx`
- `/Users/user/Sites/airtable-shopify-ebay/src/services/inventoryDirectory.ts`
- `/Users/user/Sites/airtable-shopify-ebay/docs/used-gear-workflow/phase-6-marketplace-evaluation.md`

### Checklist
- [x] Evaluate Craigslist as a future publish target.
- [x] Evaluate Facebook Marketplace as a future publish target.
- [x] Confirm that any marketplace expansion reuses the same authoritative Airtable row and does not duplicate business data.

### Implemented Evaluation Outcome
- Phase 6 is currently a scoped evaluation, not an implementation phase.
- Craigslist and Facebook Marketplace were reviewed against the current single-row workflow model and both are intentionally deferred until the team chooses a supported manual-assist or automation-backed expansion path.
- Marketplace expansion remains blocked from creating a separate intake workflow, a duplicate data store, or unapproved Airtable fields.
- The shared evaluation rules and channel-by-channel recommendations now live in `docs/used-gear-workflow/phase-6-marketplace-evaluation.md`.

### Backlog
- [ ] Define a reusable marketplace capability checklist so future channel evaluations use the same decision criteria.
- [ ] Document the minimum workflow, pricing, media, and fulfillment requirements a new marketplace must satisfy before integration starts.
- [ ] Evaluate whether additional marketplaces need channel-specific publish summaries without splitting the shared workflow model.
- [ ] Add a risk review for manual-only marketplaces where publish state cannot be written back automatically.
- [ ] Revisit marketplace expansion only after Phase 4 and Phase 5 metrics show the core workflow is operationally stable.
