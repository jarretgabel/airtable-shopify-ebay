# Marketplace workflow fixes: proposed implementation plan

Date: 2026-10-16  
Status: Implementation started after owner approval. First batch addresses REQ-006 locally; no live-store writes or production deployment performed.

## Summary and requirements

Keep Airtable as the workflow source of truth, send acquisition cost to supported private marketplace fields, make pre-owned collection membership predictable, retain sold products without allowing another purchase, persist listing copy reliably, and restore relevant listings in the Post-Publish queues.

The IDs below identify the five in-scope requests in the planning conversation, not an independently approved feature specification. REQ-005 was removed with the out-of-scope storefront layout work; the new Post-Publish request uses REQ-006.

The resolutionavnyc.com Pre-Owned Hifi page layout and Shopify theme work belong to a separate project and are out of scope. Collection membership and sold-archive integration remain in scope.

| Requirement | Outcome |
| --- | --- |
| REQ-001 | Populate Shopify cost per item from inventory cost; establish whether eBay supports an equivalent private field. |
| REQ-002 | Persist the RAV/eBay blurb reliably and incorporate the supplied replacement copy once available. |
| REQ-003 | Include eligible products in Pre-Owned Hifi and their appropriate component collections; explain automatic membership in the listing tool. |
| REQ-004 | Apply `sold-archive` after a confirmed sale on either channel, prevent another purchase, and preserve the Shopify product for the archive. |
| REQ-006 | Show eligible listings in the appropriate Post-Publish queues and distinguish load failures from genuinely empty results. |

## Evidence and technical context

- Canonical constraints: [project reference](../PROJECT_REFERENCE_SUMMARY.md). Preserve contracts, authentication, local `/api` workflows, manual post-sale decisions, and existing quantity semantics outside the approved sale flow.
- React/TypeScript frontend, AWS TypeScript handlers, Airtable workflow storage, and Shopify/eBay providers. Relevant unit suites live under `tests/unit/`.
- Inventory already has `Cost`, used by [testingForm.ts](../../src/services/testingForm.ts) and projected by [usedGearQueue.ts](../../src/services/usedGearQueue.ts). Shopify's [approval inventory-item contract](../../aws/src/shared/contracts/shopifyApproval.ts) has no cost field.
- Shopify documents [`InventoryItemInput.cost`](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/InventoryItemInput) as unit cost in shop currency. Verify against the store's effective API version and permissions: the current client requests `2024-04`, not the documentation's latest version.
- Read-only capability inspection during the safety checkpoint returned served API version `2026-01`, confirmed `InventoryItemInput.cost` and `InventoryItem.unitCost` schema fields, and reported granted `read_inventory`/`write_inventory` scopes. This verifies schema/scope availability, not a successful cost write or cost readback.
- An equivalent eBay acquisition-cost field has not been established. Do not confuse shipping cost, retail price, or public item specifics with private acquisition cost.
- [eBay copy persistence](../../src/components/approval/listingApprovalEbayFieldPersistence.ts) already explicitly requires a writable long-text field named `eBay Template Copy`. The [project reference](../PROJECT_REFERENCE_SUMMARY.md) documents the intended behavior. Confirm the live schema before treating this as missing implementation.
- [Reusable copy presets](../../src/services/ebayTemplateCopyLibrary.ts) currently use browser local storage; they are not a shared, cross-device library.
- [Collection queries](../../aws/src/providers/shopify/client.ts) return smart/manual classification, but only one page of results and no full membership rules. The [selector](../../src/components/approval/ShopifyCollectionsSelect.tsx) supports multiple selections. The reason Pre-Owned Hifi is absent has not been verified.
- [Cross-channel closure](../../aws/src/services/crossChannelClose.ts) currently deletes the Shopify product after an eBay sale. [Manual takedown](../../aws/src/handlers/approval/takeDown.ts) also calls this helper with `forceShopifyDelete: true`; a sale-specific change must not silently change that explicit action.
- The supplied Post-Publish screenshot shows `Failed to load Airtable records for used-gear-workflow. Internal Server Error` alongside `No post-publish operational rows`. This establishes a load failure, not proof that no eligible listings exist. The underlying server error and any independent eligibility issue remain undiagnosed.
- [Post-Publish routing](../../src/components/tabs/PostPublishQueueTab.tsx), [queue rendering](../../src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.tsx), [queue loading](../../src/services/usedGearQueue.ts), and [summary loading](../../src/hooks/useUsedGearWorkflowPostPublishSummary.ts) are relevant surfaces. The summary hook resets counts to an empty summary on failure while exposing an error; consumers must not present those counts as a verified empty result.

## Preconditions and decisions

Implementation is gated on the relevant prerequisites, not on completion of unrelated work:

1. Owner confirmed that `Cost` comes from intake and is per sellable listing unit. Use it as-is, including when a pair is sold as one unit; do not divide by piece count or quantity. Source/store currency confirmation remains pending; do not convert by assumption.
2. Obtain the actual replacement blurb. Neither its full text nor the referenced cost screenshot is included in this conversation.
3. Inspect live collection IDs, handles, rule sets, and publication settings without changing them. Preserve `/collections/preowned` and existing navigation/SEO.
4. Verify actual webhook registration, delivery, sale-event semantics, matching, and inventory locations. Existing handlers alone do not demonstrate working production delivery.
5. Approve the recommended single-item sold policy below. Establish a separate rule for multi-unit listings before applying product-level sold tags to them.

No formal feature spec or constitution was supplied. This is a discovery-backed proposal, not a passed implementation-readiness gate. No new architecture artifacts or migration are proposed.

## Implementation steps and task breakdown

Recommended execution order: discovery, Post-Publish visibility/load failure and sold safety as high-priority work, cost sync, collections, then copy. Post-Publish diagnostics need not wait for cost, collection, or blurb decisions.

### P1.1: Confirm prerequisites and capture baselines

Requirements: REQ-001 through REQ-004, REQ-006.

- [ ] T001 [Plan:1.1] Review the preconditions with the owner and record approved decisions in this document; inspect effective API support for private cost fields without modifying products.
- [ ] T002 [Plan:1.1] Capture read-only Airtable schema, collection rules, webhook delivery evidence, and the failing Post-Publish request/response with representative missing record IDs; use `scripts/validate-approval-combined-schema.mjs`, `aws/src/providers/shopify/client.ts`, and `src/services/usedGearQueue.ts`. Redact credentials and personal data from diagnostic evidence.

### P2.1: Retain sold products and prevent cross-channel resale

Requirement: REQ-004. Highest operational priority.

Recommended policy for one-off inventory:

- Shopify sale: retain Shopify's sale-adjusted stock, add `sold-archive`, and withdraw the matching eBay offer.
- eBay sale: retain the Shopify product, set its mapped sellable inventory to zero at relevant locations, disallow overselling, and add `sold-archive`.
- Keep the product published if it must appear on the public sold collection. A smart-collection tag is different from Shopify's product status `ARCHIVED`; do not set the latter by default.
- Preserve unrelated tags. Sale-driven updates and subsequent listing updates must not accidentally remove `sold-archive` or restore stock.
- Only verified sale events may initiate this action; unrelated order updates, cancellations, and refunds must not count as new sales.
- Do not automatically restock, remove the tag, change Airtable sold-ready/shipped status, or reverse manual post-sale decisions on refunds/returns.

- [ ] T003 [Plan:2.1] Introduce a dedicated sale-retention operation alongside `aws/src/services/crossChannelClose.ts`, using `aws/src/providers/shopify/client.ts`; preserve explicit deletion behavior in `aws/src/handlers/approval/takeDown.ts` and existing response contracts.
- [ ] T004 [Plan:2.1] Wire both `aws/src/handlers/shopify/receiveWebhook.ts` and `aws/src/handlers/ebay/receiveWebhook.ts` to the approved sale policy; account for all matched line items, sync locks, duplicate/out-of-order events, and partial failures. Do not mark the event fully complete before failed marketplace side effects can be retried; record actionable errors and verified operation results. Protect the sold tag/stock in `aws/src/providers/shopify/approvalPublish.ts`.

Acceptance: a controlled one-unit sale on either channel leaves a non-purchasable, tagged Shopify product visible in the sold collection and not purchasable on the other channel. Duplicate delivery is harmless; a failed remote operation remains visibly pending/failed and can recover on retry. Multi-unit products are not archived merely because one unit sells.

Read-only discovery (2026-10-16; nothing changed):

- **Current Shopify-sale behavior** (`receiveWebhook.ts`, `ORDERS_PAID`): the matched Airtable record is updated, then the eBay offer is withdrawn with reason `SOLD`. The Shopify product is left alone: it sells out through Shopify's own stock decrement but is never given `sold-archive`.
- **Current eBay-sale behavior** (`closeShopifyProductWhenSoldOnEbay`): the Shopify product is **permanently deleted** (REST `DELETE`). This contradicts the requested retained, tagged archive and loses the product history. The explicit manual takedown deliberately forces the same helper (`forceShopifyDelete: true`) and must keep its behavior.
- **Failure handling today:** a failed cross-channel close is logged, a result is written to the record's close-result field, and the webhook still answers HTTP 200. Neither marketplace will retry, so a failed withdrawal or product change is not recoverable automatically. Duplicate protection exists (Shopify event ID; eBay event type plus time).
- **Inventory facts:** across all 3,438 workflow records none has a quantity above 1; the 12 live-listed records have a blank quantity; only 2 live records carry both Shopify and eBay identifiers. In practice all inventory is single-unit.
- **Webhooks are not registered:** the app's Shopify credentials see **0** webhook subscriptions. Admin-created notifications would not appear in that list, so delivery cannot be fully excluded, but the registration script (`npm run shopify:webhooks:register`) has evidently not been run for this app. Local development cannot receive webhooks, so end-to-end verification needs a deployed endpoint plus an owner-approved registration, which is a live store change. eBay notification registration was not inspected.
- **Observed target state:** seven active `sold-archive` products with inventory 0 already exist, confirming the intended retained state. `Sold Archive` is a smart collection with the single rule tag = `sold-archive`.

Batch 7 progress (2026-10-16; owner approved the behavior, built test-first, nothing live):

- **T003 implemented locally.** New `aws/src/services/soldRetention.ts` keeps a sold single-unit Shopify product (stock 0 via the existing inventory sync, overselling denied, `sold-archive` appended with `tagsAdd`, other tags kept) and verifies it by readback. Multi-unit, untracked, or multi-page-variant products are left unchanged and flagged for review. Three new Shopify client operations back it: `getProductSaleState`, `addProductTags`, `denyVariantOversell`. The manual takedown's explicit delete is unchanged.
- **T004 implemented locally.** `crossChannelClose.ts` gains `retainShopifyProductWhenSoldOnEbay` / `...OnShopify`, which record the outcome in `Shopify Close Result`. An eBay sale no longer deletes the Shopify product. Both webhook handlers now run the sale side effects *before* recording the event as processed; a retryable failure returns 503 and records nothing so redelivery is not skipped, while permanent failures are recorded and answer 200. eBay withdrawal gained retry classification and an idempotency check that respects relisting (`eBay Closed At` must be at or after `eBay Published At`). Refunds, cancellations and returns trigger nothing.
- **Publish guard.** Updates of an existing product (`upsertProductWithUnifiedRequest` and the combined collections update) read its tags first and are refused with HTTP 409 `SHOPIFY_PRODUCT_SOLD_ARCHIVED` if `sold-archive` is present, so "Update Shopify" cannot untag or restock a sold item. Relisting requires removing the tag deliberately.
- **Verification:** 64 new tests across the retention policy (19), Shopify operations (7), close service (14), both handlers (8 each), and the publish guard (8); the full AWS suite passes (351/351), the full frontend suite passes (1,147), both typechecks and lint pass. Disabling the eBay handler's retry made 3 tests fail, then it was restored. Existing handler tests were updated only to rename the injected dependency and to stay offline.
- **Not done / not verified:** no product was changed and no webhook registered. The app sees 0 Shopify webhook subscriptions, and nothing fires until the endpoints are deployed and webhooks registered (a live store change needing explicit approval). A controlled one-unit test per channel with Shopify read-back, plus eBay notification registration, remains. The 7 existing sold-archive products can no longer be updated through the app (by design). Automatically setting the Airtable sold workflow status remains a manual step.

Batch 8 progress (2026-10-16; eBay notification receiver, built test-first, nothing live):

- **Why.** The existing eBay receiver expects a custom payload (`order.created`, ...) that eBay never sends, and the repo's registration script posts event names eBay does not have. eBay's Notification API uses a destination (endpoint + verification token) and one subscription per topic (`ORDER_CONFIRMATION`, `ORDER_CANCELLATION_ACTIVITY`, `ORDER_RETURN_ACTIVITY`, `ORDER_INQUIRY_ACTIVITY`, `ITEM_MARKED_SHIPPED`), confirmed by a read-only topic lookup against this app's account.
- **Built.** `GET/POST /api/hooks/ebay/notifications` (`receiveNotification.ts`, `ebayNotifications.ts`): the challenge handshake (`sha256(challengeCode + verificationToken + endpoint)`), ECDSA signature verification of the raw body against eBay's public key (cached one hour, fails closed), and a mapping of `ORDER_CONFIRMATION` to the existing `order.created` sold flow. The order is looked up in the Fulfillment API to get listing ids and SKUs. Unmatched listings and permanent failures answer 200; retryable ones answer 503 so eBay redelivers. Existing sold-retention logic is reused unchanged. SAM route, `EbayNotificationVerificationToken` parameter and local-API route were added.
- **Deliberately not mapped.** Cancellation, return and inquiry topics are logged and ignored: their payload shapes are unconfirmed and guessing could mark the wrong outcome. They are mapped once a real sample is captured.
- **Verification:** 13 new tests (6 service, 7 handler); full AWS suite 364/364; AWS typecheck passes. Disabling the signature check made a test fail, then it was restored.
- **Registration rewritten (batch 8b).** `npm run ebay:notifications:setup` replaces the old `ebay:webhooks:register` flow (which posted event names eBay does not have). With no flag it is a read-only dry run; `-- --check-access` is a read-only token probe; `-- --apply` is the only mode that writes. It is additive and idempotent: it reuses an existing destination and subscriptions, creates only what is missing, never modifies or deletes, and warns about disabled or marked-down entries. It refuses localhost/non-HTTPS endpoints and malformed verification tokens before any call. The endpoint URL comes from one shared builder (a base URL ending in `/api`, as in `.env.example`, no longer yields `/api/api/...`) because the challenge hash includes it. Default topics: `ORDER_CONFIRMATION`, `ORDER_CANCELLATION_ACTIVITY`, `ORDER_RETURN_ACTIVITY` (override with `EBAY_NOTIFICATION_TOPICS`). Unmapped notifications log their key paths (never values) so real payload shapes can be learned without storing buyer data.
- **Finding (read-only access check, live):** the current eBay token **cannot read orders** (Fulfillment API returned HTTP 403, error 1100 "Insufficient permissions"), so sold notifications cannot be resolved to listings until the eBay authorization is renewed with `sell.fulfillment`, and with `sell.cancellation`, `sell.return` and `commerce.notification.subscription` for the other topics. Reading subscriptions works. A 401/403 order lookup now answers 503 (redelivery) instead of acknowledging, so a scope problem cannot silently drop a sale.
- **Verification (updated):** 28 new tests in total (service 8, handler 7, setup 7, provider 6); full AWS suite 379/379; AWS typecheck passes.
- **Shopify callback URL fix.** `buildShopifyWebhookCallbackUrl` now strips a trailing `/api` (and whitespace) from `SHOPIFY_WEBHOOK_BASE_URL`, matching the eBay builder, so the `.env.example` value no longer registers `/api/api/hooks/...`. Covered by a test that failed first; full AWS suite 380/380.
- **eBay re-authorization helper.** `npm run ebay:oauth` (`scripts/ebay-oauth.mjs`, `scripts/lib/ebayOAuth.mjs`, 5 tests) prints the consent URL with the five needed scopes added to the existing three, and exchanges the returned code for a refresh token saved to `.env.local` without printing it. It never creates a listing (unlike the older integration script). The current token has only `api_scope`, `sell.inventory` and `sell.account` because `VITE_EBAY_OAUTH_SCOPES` is unset.
- **Re-authorization done (2026-10-16).** After the owner renewed the eBay authorization, the read-only `--check-access` returned `orders: ok` and `subscriptions: ok` (previously orders was HTTP 403). The `sell.cancellation` and `sell.return` scopes are not separately verified; subscription creation reports error 195011 if a topic's scope is missing.
- **Deploy gap found and fixed.** `scripts/prepare-aws-samconfig.mjs` never passed any webhook parameter, so a deploy would leave `ShopifyWebhookSecret`, `ShopifyWebhookBaseUrl`, `EbayWebhookSecret`, `EbayWebhookBaseUrl` (and the new `EbayNotificationVerificationToken`) empty. It now passes all five (a non-`VITE_` variable such as `EBAY_WEBHOOK_BASE_URL` overrides the `VITE_` one, so staging and prod can differ).
- **Security fix.** `/api/hooks/ebay/listings` accepted requests with no check at all when `EBAY_WEBHOOK_SECRET` was empty, which is the state a deploy would have produced. Because sale events now zero stock and tag a Shopify product, that was an open door. It now fails closed (HTTP 500 `EBAY_WEBHOOK_SECRET_MISSING`) when the real environment secret is the source; internal callers that inject their own secret getter are unchanged. Test written first and failed before the fix. Shopify's handler already failed closed.
- **Verification:** full AWS suite 386/386; AWS typecheck passes.
- **Deployment verified (2026-10-16, harmless probes only).** The deployed `/api/hooks/ebay/notifications` returns 400 without a challenge code, answers the challenge with a hash that matches the locally computed one, and rejects an unsigned POST (401). The legacy listings route rejects requests without the secret (401), and the Shopify route rejects unsigned requests (401). The eBay setup dry run plans one destination and three subscriptions and writes nothing.
- **Unapproved live write (assistant error).** While probing, I ran `npm run shopify:webhooks:register -- --help` to inspect it; the script ignores arguments and registered six Shopify subscriptions (ORDERS_UPDATED x2, REFUNDS_CREATE, DISPUTES_CREATE, DISPUTES_UPDATE, RETURNS_APPROVE) pointing at the deployed API. There were none before. They are the intended subscriptions with the intended URLs, but they were created without the owner's approval and before any controlled test. Disclosed to the owner immediately; keep-or-remove decision pending.
- **Registered (2026-10-16, owner-approved).** `ebay:notifications:setup -- --apply` created one eBay destination (the challenge handshake passed against the deployed endpoint) and three subscriptions (`ORDER_CONFIRMATION`, `ORDER_CANCELLATION_ACTIVITY`, `ORDER_RETURN_ACTIVITY`); a re-run reports all four as existing with no warnings. Six Shopify subscriptions exist (see above; owner chose to keep them). The owner deferred any test purchase, so **no end-to-end sale has been verified on either channel**.
- **Not done:** a controlled end-to-end test on each channel (deferred by the owner) and mapping of cancellation/return payloads once real samples arrive. The signature scheme follows eBay's published sample and has not been run against a real eBay notification.

Batch 9 progress (2026-10-16; code only, nothing live): **"Pre-Owned Hifi" tag on publish (REQ-003, partial).**

- Owner decision: rely on a Shopify smart collection with rule `Tag equals "Pre-Owned Hifi"`, new products only (no backfill), tag added by the app only for used items.
- `aws/src/shared/contracts/shopifyPreOwnedTag.ts` (`withPreOwnedHifiTag`) appends `Pre-Owned Hifi` after the listing's own tags when the normalized condition is **Used** (Condition / Item Condition / `__Condition__` / eBay Inventory Condition, including eBay `USED_*` values). New, Open Box, For Parts and a blank condition are left untouched; an existing copy (any case) is not duplicated. Used by both the backend draft builder and the frontend builder, and the publish preview now takes its tags from the same draft so it shows what will be published.
- Verification: 2 new tests (one per builder), each failed first; AWS suite 387/387, frontend 164 files / 1,148 tests, both typechecks pass.
- **Collection created (2026-10-16, owner-approved live write):** smart collection "Pre-Owned Hifi" (`gid://shopify/Collection/526321058114`, handle `pre-owned-hifi`) with rules `Tag equals "Pre-Owned Hifi"` AND `Inventory greater than 0`. Read back and verified. Undo = delete the collection. It is additive and starts empty; no product or existing collection was changed. Sales-channel visibility was not set by the app.
- **Superseded note:** the following item is now done for the umbrella collection; component collections remain undecided:
- **Formerly needed in Shopify:** create the smart collection "Pre-Owned Hifi" with `Tag equals "Pre-Owned Hifi"` and `Inventory greater than 0`. Nothing happens visibly until it exists. Existing products are not tagged. An app update of an existing product replaces its tags with the Airtable tags plus this tag (unchanged replace behavior). Per-component collections still need the Option A/B decision.

### P3.1: Sync private unit cost to Shopify

Requirement: REQ-001.

- Send approved per-unit `Cost` to Shopify inventory-item `cost`, not selling price or a storefront metafield.
- A blank source omits the update and preserves existing Shopify cost; explicit zero is valid. Invalid/negative values produce an explicit validation error. Clearing existing marketplace cost requires an intentional policy, not a blank default.
- Match the correct inventory item/variant by persisted IDs/SKU. Do not blanket-copy a record's cost to unrelated variants.
- Support existing-product updates and creation, with the same result in frontend preview and server publish. Verify cost by reading back `unitCost`.

- [ ] T005 [Plan:3.1] Extend `aws/src/shared/contracts/shopifyApproval.ts`, `src/services/shopify.ts`, `src/services/shopifyDraftFromAirtableProduct.ts`, `aws/src/providers/shopify/approvalDraftProduct.ts`, and `aws/src/providers/shopify/approvalDraftUnified.ts` using shared normalization where appropriate; ensure configured Airtable approval projections include `Cost`.
- [ ] T006 [Plan:3.1] Wire the supported inventory-item write through `aws/src/providers/shopify/client.ts` and `aws/src/providers/shopify/approvalPublish.ts`, including explicit partial-failure reporting. Verify eBay's applicable official API schema; if no equivalent exists, document that limitation and retain cost reporting in Airtable rather than exposing it publicly.

Acceptance: an approved cost such as `125.50` reads back as `125.50` in shop currency after create/update; blank does not erase an existing value, zero stays zero, and selling price/stock remain unchanged by the cost operation.

Batch 2 progress (2026-10-16):

- Implemented T005/T006 locally. A shared parser (`aws/src/shared/contracts/shopifyUnitCost.ts`) feeds both draft builders and the unified product-set requests. Intake `Cost` maps to the single flat variant's `inventoryItem.cost`; blank is omitted (existing Shopify cost preserved), `0` is sent as `0.00`, and negative/malformed/over-precise values are rejected with HTTP 400 `INVALID_SHOPIFY_UNIT_COST` before any Shopify call, including client-supplied product-set requests. The frontend builder never throws; it carries an invalid value through so the server rejects it.
- After a write that included a cost, the provider reads `unitCost` back. Mismatches, missing values, non-USD currency, or a failed readback are reported as publish warnings and never fail the call, because the product is already saved and its ID must still reach Airtable.
- Owner confirmed intake `Cost` is per sellable listing unit and the store currency is USD. Read-only inspection confirmed `InventoryItemInput.cost`/`InventoryItem.unitCost` and `read_inventory`/`write_inventory` scopes.
- eBay determination (T006): the official Inventory API OpenAPI spec (v1.18.5) has no private acquisition-cost property; its only cost-like fields are public shipping-cost overrides, and `Product.aspects` are public item specifics. eBay cost is therefore **not** synced and stays in Airtable.
- Verification: 13 new and 62 existing Shopify provider/handler tests pass; the new mapping tests were confirmed to fail when the mapping is removed. Frontend draft/request tests (69), both typechecks, and lint pass. Queue projections were intentionally not widened because publish reads the full record. (The 17 full-suite failures seen at this point were later traced to a working-tree rollback and resolved; see the T009 rollback resolution.)
- **Not yet verified against live Shopify:** no product was created or updated and no cost was written. Only a controlled single-item write with read-back (with your explicit approval) can prove the `productSet` cost write and permissions end to end. No historical backfill of existing products is proposed or performed.

### P4.1: Make pre-owned collection membership automatic and understandable

Requirement: REQ-003.

Recommended structure: overlapping collections, not an either/or choice or a literal collection hierarchy:

- **Pre-Owned Hifi:** all eligible available pre-owned products.
- **Pre-Owned component collections:** the same eligibility plus normalized component type, covering turntables, power/integrated amplifiers, preamplifiers, phono preamplifiers, speakers, DACs, CD players, and cables.
- **Sold archive:** products tagged `sold-archive`; active pre-owned collections exclude sold products.
- Reuse existing tags/product types where possible. Inspect supported rule operators first; do not assume nested AND/OR rules are available. Approve a simple supported rule set or maintained availability tag if required.
- Smart membership follows product data and Shopify rules, not a manual `collectionsToJoin` request. Manual collections remain editable. Show automatic collections separately with their reason; never imply that a manual selection assigns a smart collection.

- [ ] T007 [Plan:4.1] Diagnose missing Pre-Owned Hifi through `aws/src/providers/shopify/client.ts`, `aws/src/handlers/shopify/searchCollections.ts`, and `src/components/approval/shopifyCollectionsCache.ts`; check title/handle search, pagination, permissions, and caching before selecting a fix.
- [ ] T008 [Plan:4.1] Implement approved classification defaults consistently in `src/services/shopifyDraftFromAirtableProduct.ts` and `aws/src/providers/shopify/approvalDraftProduct.ts`; distinguish derived membership from manual assignments in `src/components/approval/ShopifyCollectionsSelect.tsx`, `aws/src/providers/shopify/approvalCollectionPreview.ts`, and `aws/src/providers/shopify/approvalPublish.ts`. Apply approved store rules separately, with a before/after preview.

Acceptance: a pre-owned power amplifier appears in both the umbrella and power-amplifier collections without manual smart assignment. The UI explains that membership. Once sold, it leaves available collections and appears in the sold collection.

Read-only discovery results (2026-10-16; no store changes):

- **No "Pre-Owned Hifi" collection exists.** The app's Shopify access sees 131 collections (complete, under the 250 page size); title/handle search for "Pre-Owned Hifi" and `preowned` returns nothing, while "Pre-Owned" returns six component collections. Search, pagination, permissions and caching are not the cause. The public `/collections/preowned` URL is not a collection the Admin API returns (possibly a redirect; storefront work is out of scope).
- **Existing component collections are smart collections whose rules disagree.** All rules in each must match: Amplifiers (type `Pre-Owned`, tag `Amplifier`, inventory > 0); Preamplifiers (tags `Preamplifier` and `Used`, no type rule); Speakers (tag `Preowned Speakers`, not tag `New`, type `Pre-Owned`); Turntables (tag `Pre-Owned Turntable`, type contains `Pre-Owned`); Accessories (tags `Accessories` AND `Cables` AND `Power Cable`, which almost nothing satisfies); Music Streamers (handle `music-streamers-copy`, 0 products).
- **Legacy and app-published products differ.** Older pre-owned products use type `Pre-Owned` with tags such as `Amplifier, Luxman, Preowned, Used`. The app derives type from the last segment of the Shopify Type path (for example `Integrated Amplifiers`) and builds tags only from Airtable tag fields, which are blank for the Mark Levinson 5802. It therefore matches none of the rules.
- **The 5802 is a member of "Pre-Owned Amplifiers" only through explicit assignment** (its `Shopify Collections` selection), not through the rules. Whether Shopify keeps a non-matching member after the next rule re-evaluation is unverified. The other four members are draft/archived, so the 5802 is the only active one.
- **Sold archive works as described.** `Sold Archive` (handle `sold-archive-3`) is a smart collection with the single rule tag = `sold-archive` and 10 products. Seven active products carry the tag with inventory 0, which is the desired retained state. Because `productSet` replaces a product's tags, a later app update of a sold product could remove the tag unless protected (T004).
- Shop currency is USD (verified directly).
- Pre-requisite decisions before T008: the canonical type/tag convention, whether to normalize the collection rules, and whether to create an umbrella collection. All store-rule changes need explicit approval and a before/after preview.

### P5.1: Repair blurb persistence without losing listing-specific copy

Requirement: REQ-002. Lower priority.

- [ ] T009 [Plan:5.1] Verify a writable plain long-text `eBay Template Copy` field on the actual configured Airtable inventory source. Add it only through an approved schema change if missing; verify provider metadata/cache refresh and `src/components/approval/listingApprovalEbayFieldPersistence.ts` behavior when the field starts blank.
- [ ] T010 [Plan:5.1] Once the replacement text is supplied, update the approved default/preset in `src/components/approval/listingApprovalEbayConstants.ts` and `src/services/ebayTemplateCopyLibrary.ts` as appropriate. Preserve saved per-listing overrides and existing local presets; do not bulk-replace descriptions or republish products.

Acceptance: edit, save, reload, and preview retain the listing's exact copy beneath the intended template sections. Saving does not publish. A missing/unwritable field reports an actionable error. A shared editable cross-device preset library is a separate feature, not part of this fix.

Read-only discovery results (2026-10-16): the live `used-gear-workflow` table defines `eBay Template Copy` as a long-text (`multilineText`) field, so a missing field is not the current cause; the sample record has no saved copy. The metadata endpoint rejects the `approval-combined` source (HTTP 400), so only the workflow source was inspected.

Rollback resolution (2026-10-16): the working tree had been partially rolled back. Ten files (the eBay field helpers, preview state/hook, tab panels, field renderers, the eBay section, `approvalPublish.ts`, and three test files) were byte-identical to their versions before the last four commits (`b19e687`, Oct 12), which removed the Oct 14-15 work: saved template-copy resolution, the quantity summary and placeholder, closed-at/close-result hiding, and the Online Store publish step. Apart from three cost-warning lines of this work, no content in those files was newer than HEAD. They were restored to HEAD (a full pre-restore patch is saved in the session files as `working-tree-before-restore.patch`; reverse with `git apply`). The unrelated `scripts/start-local-api.mjs` edit was left alone. Result: the full frontend suite went from 17 failures to 2, the full AWS unit suite passes (287/287), and both typechecks pass. The 2 remaining failures (workflow image selection in `useListingApprovalActionNotifications.test.tsx` and `WorkflowSnapshotPage.test.tsx`) also failed at a clean checkout of HEAD. They were later traced to outdated test fixtures rather than code defects and fixed by updating the tests only: the publish test used non-Google-Drive image URLs, which the documented Drive-only policy (`getIncludedWorkflowImageMetadata`) correctly filters out, and the snapshot test expected a direct Drive thumbnail `src` from before the October change to authenticated lazy previews (`WorkflowReferenceImagesPanel`, which has its own tests). No source files changed; the full frontend suite now passes (164 files, 1,147 tests).

Live persistence test (2026-10-16, owner-chosen record `recmqmULLCS5kXqCq`, Cary 303/200, "Awaiting Pre-Listing Review", not listed on either marketplace): through the real editor, a one-sentence copy was entered, **Save Updates** was confirmed (the dialog reported exactly one changed field), and a full diff of the record showed `eBay Template Copy` as the only changed field (absent to `<p>Persistence test copy - safe to delete.</p>`; workflow status, Body HTML and all other fields unchanged). After a full reload the editor held the saved copy, and the rendered eBay preview contained it in `<div id="template-copy">` between the title and the description. No Publish control was used. **T009's save, reload and preview acceptance is verified.**

The test also exposed a bug: clearing the visual editor saved `<p><br></p>`, which the preview rendered as an empty paragraph block, contradicting "Blank copy adds nothing". A failing-first test set was added and `resolveEbayTemplateCopyValue` now treats copy with no visible text or media as blank (text, images, links, tables and rules are kept). A second live save then wrote a truly blank value, restoring the test record to its original state: a diff against the pre-test snapshot showed zero differences (50 fields before and after). Records that already hold a stale `<p><br></p>` are handled on their next normal copy edit; no bulk cleanup is proposed. The UI's source mode cannot submit an empty string, since it snaps back to `<p><br></p>`, which the new normalization now treats as blank.

Not yet done for REQ-002 (T010): the replacement blurb text still has not been supplied, so no default or preset was changed.

### P6.1: Restore relevant listings in Post-Publish

Requirement: REQ-006. High priority; independent of cost, collections, and copy.

- First reproduce the failing `used-gear-workflow` fetch and trace its server-side error. Check configured source/table/view, field projections, permissions, Airtable responses, and pagination before selecting the fix; do not assume classification is the sole cause.
- Once loading succeeds, trace representative missing listings through publish writeback, queue loading, and `src/services/usedGearWorkflowLifecycle.ts`. Verify each channel's identifiers/status/timestamps and the existing active/stale/sold-ready/shipped eligibility rules without inferring current publication from historical closure fields.
- Preserve authentication, source contracts, user-scoping, intentional filters, and the current 45-day freshness policy. Do not bulk-mark records as published/sold or broaden access to make rows appear.
- Distinguish loading, error, successful-empty, and filtered-empty states. A failed initial load must not assert that no operational rows exist; on refresh failure, either retain clearly stale last-successful data or show an explicit error state. Expose a working retry and do not present failed summary counts as authoritative zeros.

- [ ] T011 [Plan:6.1] Trace and fix the confirmed root cause from `src/services/usedGearQueue.ts` through the configured-record endpoint and `aws/src/providers/airtable/sources.ts`; follow `src/services/usedGearWorkflowLifecycle.ts` and marketplace publish writeback if successful responses still omit eligible records. Verify representative single-channel and dual-channel records, relevant fields, pagination, and existing user/filter boundaries.
- [ ] T012 [Plan:6.1] Correct error/empty/retry and summary presentation in `src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.tsx`, `src/components/tabs/PostPublishQueueTab.tsx`, and consumers of `src/hooks/useUsedGearWorkflowPostPublishSummary.ts` as needed; preserve existing navigation and lifecycle buckets.

Batch 1 progress (2026-10-16):

- Implemented the T011/T012 code changes: a shared, projected `post-publish` subset filters the existing lifecycle statuses at the Airtable provider, without a default record cap; UI load errors and retries no longer claim an empty queue. Dashboard actions/insights distinguish unavailable summaries.
- Production read-only reproduction: the broad workflow request returned HTTP 500, while a minimal-field read succeeded and identified 12 Shopify-listed records among 3,438 inventory rows. A one-record broad read also succeeded. The exact production platform failure was not confirmed from server logs; do not label a specific timeout or payload limit as proven.
- The current source handler, exercised in an isolated authenticated local server against the configured Airtable source, returned HTTP 200 with 1,293 eligible rows (12 listed and 1,281 shipped), 220,656 response bytes. An unauthenticated request returned HTTP 401.
- Browser replay of that real read response rendered the 12 listing rows. Injected load failure showed neither global nor per-stage false-empty guidance; retry restored all 12 rows. This replay does not prove production deployment or the existing all-route local server has loaded the changed handler.
- Focused tests, lint, and Vite bundling passed. Startup follow-up restored the missing Shopify shipping/publication implementations and their supporting contracts. A subsequent narrow repair restored the eBay category selector's existing `required` prop/presentation contract without changing selection or publishing. The latest checkpoint passes 197 frontend tests, 57 AWS tests, both typechecks, category-control lint, and an isolated-output frontend build. Local API health passes; the authenticated all-route Post-Publish read returns 1,293 rows (12 listed/1,281 shipped), and the unauthenticated read returns 401. The existing approval script remains skipped because its login credentials were not configured; no live publish/takedown probes were substituted.
- T011/T012 remain unchecked until repository-wide typechecks and deployed acceptance are satisfied. Other workstreams remain pending their own prerequisites; see `batch-report.yaml` and `checkpoints/tasks-to-impl.yaml`.

Price persistence follow-up (2026-10-16):

- Read-only inspection of `recshEJE85lpcboJ7` confirmed that Airtable defines numeric `Shopify Price` but omits its value on this record. Its saved eBay price is 3,750; the linked live Shopify variant is 3,500. These are separate prices, not interchangeable defaults.
- Repaired save paths that skipped initially omitted canonical prices, targeted legacy aliases despite known canonical metadata, or silently dropped unknown Shopify price fields during backend retries. Added regressions for numeric writes, zero/clearing, and fresh/cached unknown-field failures. These defects explain how a price could fail to persist, but the record's historical write failure was not established from audit logs.
- User confirmed Airtable-only pricing. The initial investigation performed no live-price fallback, historical backfill, or Airtable/marketplace writes.
- Subsequently, the user authorized a one-record backfill for `recshEJE85lpcboJ7`. Reconfirmed its linked active Shopify variant's price and wrote only numeric `Shopify Price: 3500` through the existing session/CSRF-protected app API client. An independent GET returned 3,500 and a full editor reload displayed 3,500. Saved eBay price (3,750), workflow status, and Shopify product link were unchanged. No Shopify writes or ongoing live-price fallback were added.

Acceptance: known eligible listings appear in the correct existing Post-Publish stages after successful load, refresh, and navigation, including relevant Shopify-only, eBay-only, and dual-channel listings. Active/stale boundary behavior stays consistent with the existing 45-day rule; sold-ready/shipped handling follows existing workflow policy. Ineligible records remain excluded. A simulated load failure shows an actionable error/retry rather than a definitive empty queue or verified zero counts; successful retry restores the correct rows and summaries.

Safety checkpoint before the next workstream:

- The current implementation's local validation gate is clear; production deployment and deployed acceptance remain pending. This is not a full-repository test-suite or production sign-off.
- No new marketplace, inventory, schema, or bulk-backfill writes were performed for this checkpoint. Existing user-run local servers were left running.
- Owner confirmed intake `Cost` is per sellable listing unit and the Shopify store currency is USD; read-only Shopify inspection confirms cost input/output schema fields and inventory scopes. Private cost sync is implemented locally (see Batch 2 progress) but unverified against live Shopify. Sold-retention automation remains deferred pending its separate sale-policy, quantity, and webhook prerequisites; collection-rule writes and replacement-copy changes retain their own approval gates. Passing this checkpoint does not authorize those side effects.

### P7.1: Verify and roll out in small, reversible batches

Requirements: REQ-001 through REQ-004, REQ-006.

- [x] T013 [Plan:7.1] Run the existing targeted validation relevant to the implemented files, followed by frontend/backend typechecks and local `/api` checks. Verify controlled store outcomes only with explicit approval; no real purchases, destructive probes, or automatic bulk backfills. Passed for the currently implemented batch; repeat this gate for each subsequent implementation batch.
- [ ] T014 [Plan:7.1] Update `docs/PROJECT_REFERENCE_SUMMARY.md` and `docs/used-gear-workflow/operator-guide.md` for approved behavior. Deploy application changes in small batches, review one controlled item per flow, and only then propose a dry-run historical cost/tag/classification backfill with rollback snapshots.

## Validation and rollout notes

No new test framework is needed. Planning edits do not require application tests; implementation batches run the relevant existing suites and add regression coverage without changing live inventory data. Relevant suites include:

- `tests/unit/aws/src/services/crossChannelClose.test.ts`
- `tests/unit/aws/src/handlers/shopify/receiveWebhook.test.ts`
- `tests/unit/aws/src/handlers/ebay/receiveWebhook.test.ts`
- `tests/unit/aws/src/providers/shopify/client.test.ts`
- `tests/unit/src/services/shopifyDraftFromAirtable.test.ts`
- `tests/unit/src/components/approval/listingApprovalEbayFieldPersistence.test.ts`
- `tests/unit/src/components/tabs/PostPublishQueueTab.test.tsx`
- `tests/unit/src/components/tabs/airtable/UsedGearWorkflowPostPublishSection.test.tsx`

Use `npm run test:web -- <affected frontend test paths>` and `node --import tsx --import ./tests/unit/aws/network-guard.ts --test <affected AWS test paths>`, then `npm run typecheck`, `npm --prefix aws run typecheck`, `npm run local:api:check`, and `npm run local:api:approval-check` where applicable. Inspect those local validation scripts' current prerequisites/write behavior before executing against any non-disposable records.

Remote acceptance requires read-back from Shopify and confirmed webhook delivery; passing mocked tests alone is insufficient. Post-Publish acceptance also requires a successful deployed queue response and reconciliation of representative record IDs against their expected lifecycle stages, not merely removal of the error banner.

Keep existing unrelated worktree edits intact. Snapshot affected store rules before changes. Rollback must never restore available stock for an item that has sold.

## Requirement mapping

| Requirement | Plan items | Tasks | Completion evidence |
| --- | --- | --- | --- |
| REQ-001 | P1.1, P3.1, P7.1 | T001-T002, T005-T006, T013-T014 | Matching private Shopify unit cost read-back; explicit eBay capability determination. |
| REQ-002 | P1.1, P5.1, P7.1 | T001-T002, T009-T010, T013-T014 | Writable Airtable copy field and unchanged exact text after reload/preview. |
| REQ-003 | P1.1, P4.1, P7.1 | T001-T002, T007-T008, T013-T014 | Verified live rules, overlapping memberships, and accurate smart/manual UI. |
| REQ-004 | P1.1, P2.1, P7.1 | T001-T004, T013-T014 | Non-deleted, tagged, non-purchasable sold product; cross-channel closure and recoverable failures. |
| REQ-006 | P1.1, P6.1, P7.1 | T001-T002, T011-T014 | Successful queue response, correct eligible record IDs/stages, and truthful error/empty/retry/summary states. |
