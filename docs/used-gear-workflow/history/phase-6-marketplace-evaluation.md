## Historical: Phase 6 Marketplace Evaluation

> Historical reference only. This document records planning work and should not be used as the source of truth for new implementation tasks. Use the docs in the parent folder for current guidance.

This document evaluates future marketplace expansion against the current used-gear workflow architecture. It is intentionally scoped as a planning artifact rather than an implementation spec because the core workflow already depends on one authoritative Airtable row and a stable publish/writeback loop.

### Evaluation Rules
- Do not add a new intake or listing workflow per marketplace.
- Do not duplicate item data outside the authoritative row in `tbl0K0nFQL64jQMx8`.
- Do not introduce new Airtable fields for marketplace expansion without explicit approval.
- Treat manual or semi-manual channels as separate operational decisions from automated publish integrations.
- Require a credible writeback path for publish state, listing URL/reference, and lifecycle transitions before implementation begins.

### Marketplace Capability Checklist
- Can the marketplace reuse the existing authoritative row as the only operational source of truth?
- Can pricing, title, condition, notes, and media be mapped from the current workflow without adding a parallel intake path?
- Is there a supported publish path that the app can drive directly, or must the workflow remain manual-assist only?
- Can publish results be written back without inventing duplicate per-channel records outside the approved workflow model?
- Can stale, sold, and shipped lifecycle signals be represented without weakening the existing post-publish lifecycle design?
- Can the operational team review and correct channel-specific copy without splitting the shared pre-listing workflow?
- Does the marketplace require a separate compliance, moderation, or messaging workflow that would materially expand scope?

### Craigslist Evaluation
Recommendation: defer direct integration and treat Craigslist as manual-assist only unless a later backend project establishes a reliable publish and writeback path.

Reasoning:
- The current workflow can already produce the core listing inputs Craigslist would need: title, price, condition notes, description context, and photography assets.
- The current app does not yet have a Craigslist-specific approval, publish, or lifecycle writeback surface, so adding one now would expand scope beyond the stable shared workflow.
- Without an approved writeback contract for listing references, stale detection, and sold/shipped handoff, a Craigslist integration would risk creating side-channel state that diverges from the authoritative Airtable row.

Decision:
- Keep Craigslist out of the active implementation plan.
- If the team wants Craigslist next, start with a manual-assist review workflow that still reads entirely from the authoritative row and only proceeds to deeper integration after explicit approval.

### Facebook Marketplace Evaluation
Recommendation: defer direct integration and treat Facebook Marketplace as manual-assist or assisted-publish only until a separate integration project confirms how publish state and lifecycle updates can be written back safely.

Reasoning:
- The shared workflow already covers the item data Facebook Marketplace would need operationally: resolved title, price, notes, and required media.
- The current app architecture is optimized around a controlled publish handoff and authoritative writeback. Adding another channel without the same guarantees would weaken the single-row workflow model.
- Facebook Marketplace would likely need explicit channel-level operational review and lifecycle handling, but that should extend the current listing workflow rather than fork it.

Decision:
- Do not add Facebook Marketplace implementation work in the current rollout.
- Revisit only after the existing Shopify/eBay publish loop remains stable and the team decides whether Marketplace should be manual-assist or automation-backed.

### Shared Expansion Guardrails
- Any future marketplace must reuse the same authoritative Airtable row and shared workflow statuses.
- Any new marketplace review surface should extend the existing listing approval and publish-readiness flow rather than creating a separate intake or staging process.
- Any marketplace-specific data additions require explicit user approval before fields are added or relied upon.
- Any future integration should preserve the current post-publish lifecycle model instead of creating a duplicate stale/sold/shipped tracker.

### Current Decision
- Craigslist: evaluated, but deferred.
- Facebook Marketplace: evaluated, but deferred.
- Workflow model reuse: required for any future marketplace work.

This closes the current Phase 6 evaluation scope without expanding the approved Airtable or UI surface area.