# Decision Log

This log tracks major architectural, workflow, or convention changes, with rationale and date. All contributors should add entries for significant decisions that affect the codebase, process, or documentation.

| Date       | Area/Topic                | Decision Summary                                      | Rationale / Context                | Link to PR/Doc |
|------------|---------------------------|-------------------------------------------------------|------------------------------------|---------------|
| 2026-10-04 | Shopify/Taxonomy Attributes | Disabled the Shopify taxonomy attributes editor in the approval form | The Shopify API does not require these category attributes for product publish; retain the field, parser, and publish support for possible future use | `ShopifyTaxonomyAttributesEditor.tsx`, `taxonomyAttributes.ts` |
| 2026-05-30 | Documentation/Process     | Added Decision Log, Onboarding Guide, and more visuals| Improve onboarding and traceability| PR #, this doc|

*Add new entries at the top. Briefly describe what changed and why.*
