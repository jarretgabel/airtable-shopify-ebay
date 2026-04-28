# AWS Lambda Write Validation

## Purpose

This document defines the next validation slice after read-path parity is green: Airtable-backed write flows through the local `/api/*` Lambda adapter.

Use this with the no-Docker local API:

```bash
npm run local:api
```

Canonical readiness checks:

```bash
npm run local:api:check
curl -sSf http://127.0.0.1:3002/health
```

If a compare/probe script says the local API is not responding, restart it with the matching port, for example:

```bash
LOCAL_API_PORT=3002 npm run local:api
```

## Automated Write Probe

The write probe is intentionally opt-in so it does not mutate Airtable data unless you explicitly enable it.

Run it from the repo root:

```bash
npm run probe:lambda:writes
```

Required env vars:

```env
LAMBDA_WRITE_PROBE_ENABLED=true
LAMBDA_WRITE_PROBE_SOURCE=inventory-directory
LAMBDA_WRITE_PROBE_CREATE_FIELDS_JSON={"SKU":"LAMBDA-PROBE-001","Status":["Needs Initial Processing"]}
LAMBDA_WRITE_PROBE_UPDATE_FIELDS_JSON={"Inventory Notes":"lambda write probe updated"}
```

Optional attachment upload probe for `inventory-directory`:

```env
LAMBDA_WRITE_PROBE_ATTACHMENT_FIELD_ID=fldMXp0EaUHGglU8M
LAMBDA_WRITE_PROBE_ATTACHMENT_NAME=lambda-probe.txt
LAMBDA_WRITE_PROBE_ATTACHMENT_CONTENT_TYPE=text/plain
LAMBDA_WRITE_PROBE_ATTACHMENT_BASE64=SGVsbG8gZnJvbSBsYW1iZGEgcHJvYmU=
```

Supported probe sources:

- `users`
- `inventory-directory`
- `approval-ebay`
- `approval-shopify`
- `approval-combined`

Recommended practice:

- use obviously temporary values such as `LAMBDA-PROBE-*`
- prefer approval or inventory-directory scratch rows over real user records
- verify the probe deletes its temporary row at the end

## Shopify Mutation Probe

The Shopify probe is also opt-in, but unlike the Airtable probe it does not auto-delete created products because there is no local delete route in the Lambda package.

Run it from the repo root:

```bash
npm run probe:lambda:shopify
```

Safe default behavior:

- does nothing until `SHOPIFY_WRITE_PROBE_ENABLED=true`
- requires `SHOPIFY_WRITE_PROBE_ALLOW_CREATE=true` before creating any product
- supports using an existing scratch product id instead of creating a new one

Typical env vars:

```env
SHOPIFY_WRITE_PROBE_ENABLED=true
SHOPIFY_WRITE_PROBE_PRODUCT_ID=1234567890
SHOPIFY_WRITE_PROBE_COLLECTION_IDS_JSON=["gid://shopify/Collection/1234567890"]
SHOPIFY_WRITE_PROBE_CATEGORY_ID=gid://shopify/TaxonomyCategory/sg-4-17-2-17
```

Optional create probe for a scratch draft product:

```env
SHOPIFY_WRITE_PROBE_ENABLED=true
SHOPIFY_WRITE_PROBE_ALLOW_CREATE=true
SHOPIFY_WRITE_PROBE_CREATE_REQUEST_JSON={"input":{"title":"Lambda Probe Draft","status":"DRAFT"},"synchronous":true}
```

Optional combined mutation probe:

```env
SHOPIFY_WRITE_PROBE_WITH_COLLECTIONS_REQUEST_JSON={"input":{"title":"Lambda Probe Draft","status":"DRAFT"},"identifier":{"id":"gid://shopify/Product/1234567890"},"synchronous":true}
SHOPIFY_WRITE_PROBE_COLLECTION_IDS_JSON=["gid://shopify/Collection/1234567890"]
```

Optional image upload probe:

```env
SHOPIFY_WRITE_PROBE_IMAGE_NAME=lambda-probe.jpg
SHOPIFY_WRITE_PROBE_IMAGE_BASE64=/9j/4AAQSkZJRgABAQ...
SHOPIFY_WRITE_PROBE_IMAGE_MIME_TYPE=image/jpeg
SHOPIFY_WRITE_PROBE_IMAGE_ALT=Lambda probe image
```

Optional automatic cleanup of a product created via `product-set` during the current probe run:

```env
SHOPIFY_WRITE_PROBE_AUTO_CLEANUP=true
```

Recommended practice:

- use only scratch products and scratch collections
- keep the created product in `DRAFT`
- enable `SHOPIFY_WRITE_PROBE_AUTO_CLEANUP=true` when the probe creates a new scratch product and you want it deleted automatically at the end of that run
- remove scratch products after probing with:

```bash
npm run cleanup:shopify:probe -- <productId>
```

- preserve the collection and category ids used in approval flow validation so publish behavior stays representative

Observed probe prerequisites:

- the no-Docker local API must export `SHOPIFY_ACCESS_TOKEN` for the AWS Shopify provider; `npm run local:api` now derives that automatically from `VITE_SHOPIFY_OAUTH_ACCESS_TOKEN` or `VITE_SHOPIFY_ADMIN_API_TOKEN`
- `product-set-with-collections` only exercises real collection joins if the target store actually has custom collections; if `/api/shopify/collections` returns an empty array, the route still validates existing-product mutation behavior but not collection assignment
- `/api/shopify/images` requires Shopify app scopes and permissions for file creation; if the probe returns `Access denied for fileCreate field`, treat that as an external Shopify permission issue, not a Lambda seam failure. Add one of `write_files`, `write_images`, or `write_themes` plus user create-files permission, then rerun the probe.

## eBay Mutation Probe

The eBay probe is opt-in and intentionally scratch-only because publish routes create or update live eBay offers and listings.

The probe targets the Lambda-only eBay path backed by server-owned credentials and deploy-time publish defaults.

Run it from the repo root:

```bash
npm run probe:lambda:ebay
```

Required env vars:

```env
EBAY_WRITE_PROBE_ENABLED=true
EBAY_WRITE_PROBE_PUBLISH_SETUP_JSON={"locationConfig":{"key":"resolution-av-warehouse","name":"Resolution AV Warehouse","country":"US","postalCode":"10001","city":"New York","stateOrProvince":"NY"},"policyConfig":{"fulfillmentPolicyId":"123","paymentPolicyId":"456","returnPolicyId":"789"}}
```

Optional sample mode override:

```env
EBAY_WRITE_PROBE_SAMPLE_MODE=inventory
```

Optional approval publish probe:

```env
EBAY_WRITE_PROBE_APPROVAL_BUNDLE_JSON={"inventoryItem":{"sku":"LAMBDAEBAYPROBE001","product":{"title":"Lambda Probe Listing"},"availability":{"shipToLocationAvailability":{"quantity":1}}},"offer":{"sku":"LAMBDAEBAYPROBE001","marketplaceId":"EBAY_US","format":"FIXED_PRICE","availableQuantity":1,"categoryId":"3276","listingDescription":"<p>Lambda probe listing</p>","listingDuration":"GTC","pricingSummary":{"price":{"value":"4999.00","currency":"USD"}}}}
```

Optional image upload probe:

```env
EBAY_WRITE_PROBE_IMAGE_NAME=lambda-probe.jpg
EBAY_WRITE_PROBE_IMAGE_BASE64=/9j/4AAQSkZJRgABAQ...
EBAY_WRITE_PROBE_IMAGE_MIME_TYPE=image/jpeg
```

Optional automatic cleanup of the exact SKUs created by the current probe run:

```env
EBAY_WRITE_PROBE_AUTO_CLEANUP=true
```

Recommended practice:

- use scratch SKUs such as `LAMBDAEBAYPROBE*`
- prefer `inventory` or `trading-verify` sample mode unless you specifically need a live Trading API listing
- keep approval-probe pricing compatible with the configured business shipping policy; low scratch prices can trigger eBay shipping-policy rejections that are not Lambda seam failures
- enable `EBAY_WRITE_PROBE_AUTO_CLEANUP=true` when you want the probe to withdraw and delete the exact scratch SKUs created during that run
- clean up created scratch offers and inventory records after probing with:

```bash
npm run cleanup:ebay:probe
```

- override the default cleanup targets if needed with exact SKUs as arguments, for example:

```bash
npm run cleanup:ebay:probe -- LAMBDAEBAYPROBE1777393818299
```

## UI Flows To Validate

### Users management

Code path:

- [src/stores/auth/authStorage.ts](/Users/user/Sites/airtable-shopify-ebay/src/stores/auth/authStorage.ts)

Validate:

- create a user
- edit a user
- delete a user
- unsupported field fallback still works when Airtable rejects unknown fields

### Incoming Gear form

Code path:

- [src/services/incomingGearForm.ts](/Users/user/Sites/airtable-shopify-ebay/src/services/incomingGearForm.ts)

Validate:

- create a new inventory row
- update an existing inventory row
- upload at least one image attachment
- confirm the fallback SKU candidate path still succeeds

### Testing form

Code path:

- [src/services/testingForm.ts](/Users/user/Sites/airtable-shopify-ebay/src/services/testingForm.ts)

Validate:

- create a new inventory row
- update an existing inventory row
- upload at least one image attachment
- confirm duration fields still persist as seconds

### Photos form

Code path:

- [src/services/photosForm.ts](/Users/user/Sites/airtable-shopify-ebay/src/services/photosForm.ts)

Validate:

- create a new inventory row
- update an existing inventory row
- upload at least one image attachment
- confirm the status and photo date fields still write correctly

### Inventory Directory inline edits

Code path:

- [src/services/inventoryDirectory.ts](/Users/user/Sites/airtable-shopify-ebay/src/services/inventoryDirectory.ts)

Validate:

- numeric edits remain numeric
- checkbox edits remain boolean
- multi-select edits remain arrays
- duration edits remain seconds in Airtable

### Listing approval save/create flows

Code path:

- [src/components/ListingApprovalTab.tsx](/Users/user/Sites/airtable-shopify-ebay/src/components/ListingApprovalTab.tsx)

Validate:

- create a new Shopify approval row
- save an existing approval row
- save a combined approval row
- confirm Shopify REST Product ID writeback still succeeds after publish

### Shopify approval publish flows

Code path:

- [src/components/ListingApprovalTab.tsx](/Users/user/Sites/airtable-shopify-ebay/src/components/ListingApprovalTab.tsx)

Validate:

- new-product publish uses `product-set`
- existing-product publish uses `product-set-with-collections` when collection ids are present
- collection fallback still retries through `addProductToCollections` when combined mutation fails on collection assignment
- taxonomy resolution still uses the app-api seam before publish
- Shopify REST Product ID writeback still saves through the Airtable Lambda seam after create

Current known local validation constraint:

- if the store has no custom collections, you can validate `product-set`, existing-product `product-set-with-collections` with an empty collection list, and category updates, but not the collection-join branch until a scratch custom collection exists

### Image Lab Shopify uploads

Code path:

- [src/components/imagelab/useImageLabItems.ts](/Users/user/Sites/airtable-shopify-ebay/src/components/imagelab/useImageLabItems.ts)

Validate:

- original image upload works through `/api/shopify/images`
- processed image upload still returns a stable image id/url payload
- upload errors still surface in item state without clearing the queue

If the route fails with a `fileCreate` access error, fix Shopify app scopes first instead of debugging the Lambda seam.

### eBay publish and image flows

Code paths:

- [src/components/EbayTab.tsx](/Users/user/Sites/airtable-shopify-ebay/src/components/EbayTab.tsx)
- [src/components/ListingApprovalTab.tsx](/Users/user/Sites/airtable-shopify-ebay/src/components/ListingApprovalTab.tsx)
- [src/components/imagelab/useImageLabItems.ts](/Users/user/Sites/airtable-shopify-ebay/src/components/imagelab/useImageLabItems.ts)

Validate:

- sample inventory draft creation uses `/api/ebay/sample-listings`
- sample publish uses `/api/ebay/sample-listings/publish`
- approval publish uses `/api/ebay/approval-listings/publish`
- Image Lab eBay upload uses `/api/ebay/images`
- Lambda error messages still surface the same configuration blockers for missing location or policy setup

## Exit Criteria

This write slice is complete when all of the following are true:

1. `npm run compare:lambda` remains green
2. `npm run probe:lambda:writes` succeeds for at least one scratch source
3. `npm run probe:lambda:shopify` succeeds for a scratch Shopify flow or approved scratch product id
4. `npm run probe:lambda:ebay` succeeds for a scratch eBay publish or image-upload flow
5. users, inventory processing, approval save flows, Shopify publish/image flows, and eBay publish/image flows work through the local API
6. no write-path payload or error-surface mismatch remains open