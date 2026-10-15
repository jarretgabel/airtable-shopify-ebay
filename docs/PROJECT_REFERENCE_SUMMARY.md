

# Project Patterns & Functionality Reference

> **See Also:**
> - [Onboarding Guide](ONBOARDING_GUIDE.md)
> - [How to Update Patterns](HOW_TO_UPDATE_PATTERNS.md)
> - [How to Add Workflow or Form](HOW_TO_ADD_WORKFLOW_OR_FORM.md)
> - [Troubleshooting Guide](TROUBLESHOOTING.md)
> - [FAQ & Gotchas](GOTCHAS_AND_FAQ.md)
> - [Architecture & Data Flow](ARCHITECTURE_AND_DATA_FLOW.md)
> - [Decision Log](DECISION_LOG.md)
> - [Examples](examples/)



## 1. Documentation & Instruction Sources
- `.github/copilot-instructions.md`: Engineering, UI, and workflow rules for all contributors.
- `docs/`: Architecture, workflow, operator/user guides, form patterns, and conventions.
- `src/services/userGuideContent.ts`, `src/components/tabs/workflowGuideContent.ts`: Programmatic workflow rules, page/module guides, role quick starts.

## 2. Architecture Patterns
### App Shell & Routing
- Route-level orchestration in `src/App.tsx`.
- Heavy logic and data derivation in hooks (`src/hooks/`) and services (`src/services/`).
- Domain view-model objects preferred over large prop surfaces.

### Service Layer
- Service entry modules are thin; request building, mappers, and constants are in helpers.
- All API integrations (Airtable, Shopify, eBay) use REST, with request/response validation.
- Environment variables validated at module boundaries (`src/config/runtimeEnv.ts`).

### UI Composition
- Components are focused and orchestration-centric; reusable UI blocks in `src/components/app` or `src/components/tabs`.
- Tailwind CSS v4 for all styling; no component-scoped global CSS.
- Shared class constants and helpers reused before introducing new patterns.
- Mobile-first responsive design, dark mode by default.

### State Management
- React Hooks and Context API for most state; Zustand or Redux for complex state.
- Shared state surfaces for workflow, listing, and approval context.

### File Structure
- Components, hooks, services, types, utils, context, and pages are organized by domain and function.
- Unit tests mirror source structure under `tests/unit/`.

## 3. Data Model & Mapping Patterns
### Inventory & Listing Data
- All forms and workflow actions target the `SB Inventory` Airtable table.
- Data model and field rules documented in `docs/used-gear-workflow/data-model-and-approvals.md`.
- Field mapping and schema patterns in `docs/forms/README.md` and `docs/forms/templates/README.md`.
- `eBay Template Copy` is a long-text field (rich text disabled) holding per-listing copy HTML, separate from `Ebay Body (HTML)`. Layout templates render it in their copy slot; blank copy adds nothing. Without a layout template, saved copy does not modify manual body HTML. Legacy embedded copy is migrated on the next listing save, not by bulk updates or republishing.
- The shared quantity input remains unchanged; the combined eBay section no longer repeats matching positive inventory/offer quantities in a separate panel. Compact messages report unavailable previews, invalid/mismatched quantities (including both values), or explicit zero without replacing it with 1. Quantity precedence remains `eBay Inventory Ship To Location Quantity`, then `Quantity`, then `Qty`, defaulting to 1 only when absent/blank; quantity-per-buyer is separate. These are draft-payload checks, not live stock checks. A stock-overwrite warning sits beside relevant eBay update/publish actions, including Update Both and reused existing offers, rather than inside the quantity section. Actual quantity-sending behavior is unchanged; no automatic stock-preserving update policy is implied.

### Marketplace Closure History
- Marketplace closure fields are system-managed audit data, not listing inputs. Both channels' `Close Result`/`Closed At` values appear read-only under **Marketplace Closure History**, including when a record is back in Ready. Historical results/dates never determine the live lifecycle label; existing authenticated channel verification remains authoritative.
- eBay `Close Result` records the latest outcome, including failures. Future failed/invalid close attempts update that result without setting or clearing persisted `eBay Closed At`; only successful withdrawal writes that field. Existing historical dates are retained and may include older failed attempts or an earlier publication. Do not interpret an error result as successful takedown or bulk clear dates after republication.
- The takedown service's existing response `closedAt` remains an attempt timestamp on failure for contract compatibility; check `success`. It is not proof of a saved closure date. The latest result and retained recorded timestamp need not belong to the same attempt.
- Date-only lifecycle/closure fields retain their calendar day and show no invented clock time; full timestamps retain local date/time formatting.
- The manual **Mark Sold - Ready to Ship** workflow sets sold status/date and locks publish/update controls for sold-ready/shipped rows. Sale webhook handlers record events and attempt cross-channel closure, but do not automatically set that sold workflow status; the publish backend also lacks an independent sold-state lock. These changes were explicitly deferred. Keep current full-update quantity behavior; do not claim stock preservation or add price-only restrictions, a new stock action, or sale automation without renewed approval. Live webhook registration/delivery was not verified.

### Audiogon Ratings
- Testing and the inventory editor use the shared ten-grade contract in `aws/src/shared/contracts/audiogonRating.ts`: compact score/name choices with the complete selected description below the control. Photography keeps the rating read-only and uses the same configured choices.
- Use exact existing Airtable choice names, preferring the full standard description; existing short-score or numeric choices are supported without schema changes. The current `Audiogon Rating` field is `multipleSelects`, so a changed rating is sent as one array entry, preserving commas inside its description.
- Existing legacy values remain available as the current selection and are not normalized automatically. Testing/Photography pass their loaded rating baseline; unchanged ratings are omitted from saves, preserving legacy multi-choice fragments and newer saved ratings during unrelated edits. Blank ratings remain optional and do not clear an existing rating. Missing standard choices fail configuration loading rather than creating choices silently.

### Shopify Shipping
- Frontend/backend drafts share `aws/src/shared/contracts/shopifyShippingWeight.ts`. Explicit variant/generic weight fields keep their precedence; bare canonical `Weight`/`Shipping Weight` values retain the pounds default. Embedded supported units are respected, and explicit zero is preserved. Invalid, negative, conflicting or missing units fail rather than silently dropping native weight.
- When flat weight fields are blank, an explicitly labeled leading legacy weight such as `70lbs (27x25x12)` supplies native `inventoryItem.measurement.weight`. Variants JSON keeps per-variant weights; a shared legacy value is not applied to every JSON variant.
- Legacy dimension parsing excludes that labeled weight before applying the existing positional width/depth/height fallback. Separate dimension fields still win. Generated product dimensions use `custom.shipping_width_inches`, `custom.shipping_depth_inches`, and `custom.shipping_height_inches` (`number_decimal`), with shared destination keys in `aws/src/shared/contracts/shopifyShipping.ts`. Existing Airtable input aliases remain compatible; explicitly configured numbered metafields retain their configured keys. Old `custom.shipping_width`/`shipping_depth`/`shipping_height` values are retained, not automatically migrated or deleted. These metafields are not native package assignment or carrier-rate configuration.
- Intended destinations are native **Packed product size**, native **Weight**, and the existing custom dimension metafields. Leave **Package when shipped alone** unchanged; package assignment is not the requested size control. The observed API 2025-10 inventory/variant inputs expose no native packed length/width/height fields, and current public measurement-input documentation exposes only weight/package ID. Native Packed product size automation remains blocked until a supported write/readback path is established; custom metafields are not a substitute. Admin/CSV editing is a separate, deliberate workflow, not an automatic fallback.
- Do not create/change default or shared packages, add Airtable fields, change scopes/API versions, or repair live products without approval. Confirm the source width/depth/height to native length/width/height mapping before any native size write.
- Authenticated `GET /api/shopify/products/{id}?view=shipping` inspects native measurement, custom dimensions, served API version, granted scopes and relevant schema capabilities without mutation. `packedSizeSchema` reports actual inventory/variant input and measurement output field names, not an assumed native-size capability. Default product reads are unchanged. `variantsTruncated: true` means partial coverage, not a complete audit; an absent served-version header is reported as `null`. Schema package-assignment support does not establish native Packed product size support.
- The shipping inspection returns new-key values and their attached `definition`, separate `legacyDimensionMetafields`, and independently queried PRODUCT `dimensionDefinitions` even before new values exist. A saved value with `definition: null` is unstructured; it is not evidence of an editable/pinned admin definition. To display ordinary product fields, use matching `_inches` product definitions with the **Decimal number** (`number_decimal`) type; pinning controls main-page visibility. Do not create or pin store-wide definitions without approval. Definitions do not populate native Packed product size.
- Separately approved shipping-only repairs use authenticated/CSRF-protected `POST /api/shopify/product-set` with `action: "update-shipping"`, `productId`, and `shipping: { variantId, widthInches, depthInches, heightInches, weightPounds? }`. No product-set request is allowed alongside this action. The provider verifies product/variant membership, complete coverage, matching Decimal number PRODUCT definitions, and target type/digests before mutation. Supplied weight updates only native measurement; omitted weight triggers no inventory mutation and is checked unchanged on readback. Three `_inches` values are atomically set using their own fresh `compareDigest` values (null for absent targets, never legacy digests); exact values and definition attachment are verified. It never publishes, sets stock, changes prices/images, assigns packages, deletes legacy fields, or creates definitions. Weight/metafield writes are not one transaction: uncertain/partial failures require re-reading before retrying; no automatic rollback or full-listing retry.

### Image Metadata
- Images uploaded to the `Images` attachment field after record creation.
- Shared image metadata in `Workflow Image Metadata JSON` (array of objects with attachmentId, url, filename, sourceStage, includedInListing, etc).
- Workflow image previews and listing payloads must use Google Drive URLs only (`drive.google.com` or Google-hosted `googleusercontent.com`). Airtable attachment URLs may be used for record correlation, but never as image sources.
- Intake images: `sourceStage: "intake"` (shown in intake snapshot, regardless of `includedInListing`).
- Testing/Photography images: `sourceStage: "testing"` or `"photos"`, shown in main listing gallery only if `includedInListing: true`.
- Workflow metadata is the canonical image source for listings. Legacy Airtable `Images` attachments may remain for archival/reference purposes, but must not be used as listing image URLs.
- Testing and Photography saves do not rebuild that metadata from `Images`. Unchanged image drafts omit the metadata field; edits merge only the current stage's changed fields into fresh saved rows, preserving other stages, annotations, order and eBay caches. Forms pass their loaded image baseline so conflicting stale edits fail visibly before saving. New archived uploads append to a freshly read library without rewriting existing images. Missing metadata fields or failed image writes are errors, not successful saves with silently discarded edits.
- Photography loads its image library directly from canonical metadata, without filtering it through archival `Images` attachments. Metadata-only Drive photos remain visible even when old sample attachments still exist. Listing captions use metadata alt text when no selected-image payload row exists; explicit draft captions, including a cleared caption, take precedence.
- Saved Testing/Photography image editors reuse the reference gallery's lazy authenticated preview loader with record/source context, rather than embedding Drive download-page URLs. Preview failures are visible and do not delete or change image metadata; the API still verifies that the requested image belongs to the record.
- Listing photo selection uses the same eligible-image classification as the gallery. Normally named Photography images remain selected alongside legacy `-processed` images when another photo is unchecked; deselection does not delete source files.
- Automatic listing format checks use the authenticated `inspect-workflow-image-metadata` action, which returns `validImageUrls` and `invalidImageUrls` without writing Airtable or returning replacement metadata. Results never replace draft selections, order, alt text, or metadata. Unsupported images remain visible and can be unchecked; they cannot be newly selected. Unchecked/new sources and temporary Drive failures are shown as unverified, not unsupported. The legacy `validate-workflow-image-metadata` action retains its explicit cleanup/write contract and must not be used for automatic checks or read-only audits.
- Combined-listing publish actions recheck included workflow sources after any pending save and before image preparation or marketplace requests. Unsupported/unverified selected photos or inspection failures block publishing visibly; excluded sources remain in the library. Format safety does not rely on silently removing photos from the draft.
- eBay preparation saves an optional `ebayHostedImageCache: { url, sha256 }` on each source image in `Workflow Image Metadata JSON`; no additional Airtable field is needed. The SHA-256 is computed from downloaded source bytes, not filenames or URLs. Unchanged images reuse an accessible eBay-hosted URL; new/changed images and URLs returning 404/410 are uploaded. Other verification errors are surfaced without duplicate uploads. Cache writes merge into the current saved metadata and preserve gallery order, inclusion, roles and annotations. Old listings need one preparation pass to establish these mappings. Whole-item Inventory API updates still include the ordered image URL list.
- `npm run workflow:sku-drive-images:audit` produces a read-only, newest-first reconciliation plan for exact-SKU Google Drive folders. It skips existing Drive-backed metadata and requires explicit approval for cleanly named images whose processed state cannot be inferred safely. Use `--only-skus sku1,sku2` for a bounded audit; when explicit file IDs are approved, only those selected images are planned, including for records that already have photos.
- `npm run workflow:sku-drive-images:coverage -- --skip-skus 10800` compares every file in every exact-SKU Drive folder against included testing/photos-stage metadata, newest records first. It groups identical file content across duplicate folders, distinguishes explicitly processed files from unverified candidates/originals, and never writes to Airtable or Drive.
- Apply only a reviewed plan with `npm run workflow:sku-drive-images:apply -- --plan <plan.json> --confirm SYNC_SKU_GOOGLE_DRIVE_PROCESSED_IMAGES`. If confirmed real photos replace workflow seed placeholders, also pass `--replace-seeded-photo-metadata`; that removes only the matching seed rows from `Workflow Image Metadata JSON`, never Drive files. The sync never modifies the legacy `Images` attachment field.
- Do not use `npm run workflow:drive-backfill:all:apply` to import existing SKU-folder photos. That script generates sample/JotForm stage images under record-ID folders, replaces stage metadata, and updates the Airtable `Images` field.
- Listing image filenames should use lowercase ASCII kebab-case with a stable brand-model prefix; hero images use `brand-model-product-type.jpg`, additional images use `brand-model-key-detail.jpg`. Use 4–10 words, with no camera names, company name, or version/processing suffixes.

### Sync & Mapping
- Bi-directional sync between Airtable, Shopify, and eBay.
- Mapping management for Airtable records to Shopify/eBay products.
- Conflict resolution and scheduled syncs (hourly, daily, on-demand).

## 4. Workflow & Functional Patterns
### Workflow Surfaces
- Intake > Processing > Listings > Post-Publish > Archive.
- Utility pages: User Guide, Market Research, JotForm, Image Lab, Settings, Notifications, User Management.

### Workflow Advancement
- Intake leaves Parking Lot after qualification decision and notes.
- Accepted rows stay in Parking Lot for arrival-stage handling; rejected rows move to Trash Review.
- Testing and Photography must be complete before Listings.
- Listings move to live status only after review and publish action.
- Post-Publish owns active post-sale follow-through and Archive owns shipped lookup/reference; Listings keeps record context but does not own post-sale workflow.
- Listings exposes compact `Take Down Shopify`, `Take Down eBay`, and `Take Down Both` actions. These still require confirmation and return the record to Ready after successful takedown. A standalone workflow-only Back to Ready button is not shown, because it would clear saved listing IDs without removing live listings.
- The Post-Publish Lifecycle label verifies the linked Shopify product and eBay offer through authenticated local `/api` reads and can display `Listed, Shopify + eBay`. This is a display label, not a new Airtable workflow status. Publish date writeback reads the current saved record so a stale pre-takedown timestamp cannot suppress restoring `Listed At`; ordinary live updates preserve the existing date.
- Marketplace link gating, workflow summary and Publish/Update action labels use the same derived lifecycle values as the lifecycle panel. Successful publish writeback exposes the listing links immediately, without waiting for the selected queue row to refresh; a successful takedown hides them immediately.
- Shopify approval publishing explicitly publishes the active product to Online Store after product creation/update and confirms its `onlineStoreUrl` before returning success. GraphQL `ACTIVE` alone does not publish a product to a sales channel. This publication step uses the existing REST product API and `write_products` access, preserves an existing publication, and changes no price, variant or image fields. The lifecycle panel requires both `ACTIVE` and an Online Store URL. The authenticated product-set API also accepts `{ action: "publish-online-store", productId }` to finish publication of an existing active product without recreating it.

### Approval & Listing Flow
- Approval queues and listing review use shared UI conventions and change-tracking.
- Shopify/eBay listing forms are structurally aligned; channel-specific differences isolated in helpers.
- ApprovalQueueTable suppresses channel-irrelevant columns by passing `''` as the field name prop.

### Activity & Logging
- Real-time logging of sync events, filterable by platform, date, and status.
- Activity timeline and statistics panel for operational visibility.

## 5. UI/UX & Accessibility Patterns
- Tailwind-only component styling; no custom CSS except for global cross-cutting needs.
- Consistent color palette for status indicators (green=success, red=error, yellow=warning).
- Responsive design with breakpoints for tablet/desktop.
- Accessibility: ARIA labels, semantic HTML, keyboard navigation, visible focus states.
- Loading states: skeletons and spinners for async operations.
- Error boundaries for major sections.

## 6. Forms & Validation
- Local React forms for all inventory processing (not Airtable embeds).
- Field order, labels, and defaults defined in schema files.
- Airtable field names and payload transforms in service files.
- Select options loaded from Airtable table metadata at runtime.
- Images uploaded to `Images` field after record creation.
- Shared validation and error handling in `utils/validators.ts`.

## 7. Error Handling, Logging, and Activity Tracking
- Graceful degradation and retry logic for sync jobs.
- Comprehensive logs of all sync operations and conflicts.
- Error handling with user-friendly messages and error boundaries.
- Monitoring and alerting for failed syncs.

## 8. Testing, CI, and Deployment
- Unit tests for sync logic, integration tests for platform connections.
- Unit tests named `*.test.ts(x)` and live under `tests/unit/`.
- CI must pass typecheck, lint, test, and build before merge.
- Use SQLite for dev, PostgreSQL for production.
- API keys encrypted in env vars; HTTPS for all API comms.
- Rate limiting awareness and background job queues for heavy syncs.

## 9. Notable Code Conventions & Best Practices
- Prefer single-purpose helper functions with stable input/output shapes.
- Avoid repeated array scans in render paths; compute once and reuse.
- Extract reusable UI blocks and helpers for maintainability.
- Preserve original side effects and navigation flows after refactors.
- Remove dead style selectors/helpers when migrations eliminate their usage.

---

**For further details, see:**
- `docs/used-gear-workflow/operator-guide.md` (operator workflow, page/module breakdown)
- `src/services/userGuideContent.ts` and `src/components/tabs/workflowGuideContent.ts` (programmatic workflow rules, quick answers)
- `docs/forms/README.md` and `docs/forms/templates/README.md` (form and schema patterns)
- `.github/copilot-instructions.md` (engineering and review rules)

This file is a living reference. Update as new patterns, rules, or workflows are added.
