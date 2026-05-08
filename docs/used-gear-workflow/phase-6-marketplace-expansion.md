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

### Checklist
- [ ] Evaluate Craigslist as a future publish target.
- [ ] Evaluate Facebook Marketplace as a future publish target.
- [ ] Confirm that any marketplace expansion reuses the same authoritative Airtable row and does not duplicate business data.

### Backlog
- [ ] Define a reusable marketplace capability checklist so future channel evaluations use the same decision criteria.
- [ ] Document the minimum workflow, pricing, media, and fulfillment requirements a new marketplace must satisfy before integration starts.
- [ ] Evaluate whether additional marketplaces need channel-specific publish summaries without splitting the shared workflow model.
- [ ] Add a risk review for manual-only marketplaces where publish state cannot be written back automatically.
- [ ] Revisit marketplace expansion only after Phase 4 and Phase 5 metrics show the core workflow is operationally stable.
