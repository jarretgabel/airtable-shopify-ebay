# Historical: Workflow Image Metadata

> Historical reference only. This document records prior implementation planning context and should not be used as the source of truth for new implementation tasks. Use the docs in the parent folder for current guidance.

This document describes the live workflow image model used by Testing, Photos, and Listings.

## Status

- Implemented in the current app.
- Airtable attachments remain in `Images`.
- Shared per-image metadata is stored in `Workflow Image Metadata JSON`.
- Testing and Photos each load only their own stage attachments while preserving the other stage's metadata.
- Listings prefer workflow metadata first and publish only rows marked `includedInListing: true`.

## Goals

- Keep `Images` as the raw file attachment field.
- Add one structured metadata field that both Testing and Photos can read and write.
- Make image alt text, image order, and source-stage attribution durable outside the Listings page.
- Make Listings consume workflow-authored image metadata first, with attachment-only fallback for older rows.
- Avoid a hard migration to a linked-image Airtable table unless the JSON field proves too limiting.

## Current State

- Testing and Photos both upload image files to `Images`.
- Workflow forms persist per-image metadata such as alt text, ordering, stage ownership, and inclusion state in `Workflow Image Metadata JSON`.
- Listings derive their default selection state from workflow-managed image records, with attachment and legacy listing-field fallbacks retained for older rows.

## Recommended Airtable Schema

Keep the existing attachment field and add one new long-text JSON field on the same `SB Inventory` row.

### Existing Field

- `Images`
  - Type: attachment
  - Purpose: raw uploaded files used by Testing, Photos, and Listings

### New Field

- `Workflow Image Metadata JSON`
  - Type: long text
  - Purpose: structured image metadata authored by Testing and Photos, consumed by Listings

## Canonical Metadata Shape

The metadata field should store a JSON array using this shape.

```ts
export type WorkflowImageSourceStage = 'testing' | 'photos';

export interface WorkflowImageMetadataRecord {
  attachmentId?: string;
  url: string;
  filename: string;
  alt: string;
  sortOrder: number;
  sourceStage: WorkflowImageSourceStage;
  includedInListing: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

### Field Rules

- `attachmentId`
  - Optional because older Airtable payloads may not always provide one consistently.
  - Use as the primary reconciliation key when available.
- `url`
  - Required fallback reconciliation key.
- `filename`
  - Copied from the attachment payload for operator readability.
- `alt`
  - Workflow-authored alt text.
- `sortOrder`
  - The durable workflow image order.
- `sourceStage`
  - `testing` or `photos`, set when the metadata record is first created.
- `includedInListing`
  - Default listing inclusion recommendation from workflow.
  - Listings can continue to override this later if business rules require listing-specific selection.

## Ownership Rules

Recommended ownership model:

- Testing
  - Can upload images.
  - Can author or edit alt text for images it uploads.
  - Can set `includedInListing` for its images if needed.
  - Should not be the final authority on image order.
- Photos
  - Can upload images.
  - Can edit alt text for all workflow images.
  - Owns final workflow `sortOrder`.
  - Can set default `includedInListing` recommendations.
- Listings
  - Reads workflow metadata first.
  - Keeps the final include/exclude toggle for publish surfaces.
  - May optionally keep a listing-specific final reorder override, but should not become the primary metadata authoring surface.

If the team wants stricter permissions later, gate edits in the UI by `sourceStage` and form surface.

## TypeScript Additions

Add or extend the following helper types.

### New Shared Helper Module

- `src/services/workflowImageMetadata.ts`

Recommended exports:

```ts
export type WorkflowImageSourceStage = 'testing' | 'photos';

export interface WorkflowImageMetadataRecord {
  attachmentId?: string;
  url: string;
  filename: string;
  alt: string;
  sortOrder: number;
  sourceStage: WorkflowImageSourceStage;
  includedInListing: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function parseWorkflowImageMetadata(raw: unknown): WorkflowImageMetadataRecord[];
export function serializeWorkflowImageMetadata(records: WorkflowImageMetadataRecord[]): string;
export function mergeWorkflowImageMetadata(params: {
  attachments: Array<Record<string, unknown>>;
  existingMetadata: WorkflowImageMetadataRecord[];
  sourceStage: WorkflowImageSourceStage;
  nowIso: string;
}): WorkflowImageMetadataRecord[];
export function reorderWorkflowImageMetadata(
  records: WorkflowImageMetadataRecord[],
  orderedUrls: string[],
): WorkflowImageMetadataRecord[];
export function updateWorkflowImageAltText(
  records: WorkflowImageMetadataRecord[],
  url: string,
  alt: string,
  nowIso: string,
): WorkflowImageMetadataRecord[];
export function updateWorkflowImageInclusion(
  records: WorkflowImageMetadataRecord[],
  url: string,
  includedInListing: boolean,
  nowIso: string,
): WorkflowImageMetadataRecord[];
```

### Existing Approval Helper Alignment

Extend the listing-side image helpers to prefer metadata when available.

- `src/components/approval/workflowListingImageHelpers.ts`

Recommended additions:

```ts
export function buildWorkflowListingImageRowsFromMetadata(
  metadata: WorkflowImageMetadataRecord[],
): WorkflowListingImageRow[];

export function buildWorkflowListingSelectionFromMetadata(
  metadata: WorkflowImageMetadataRecord[],
): string[];
```

## Form Data Model Changes

### Photos Form

Extend the Photos form loader result to include workflow image metadata.

- `src/services/photosForm.ts`

Recommended additions:

```ts
export interface PhotosFormStageContext {
  inventoryNotes: string;
  testingNotes: string;
  existingAttachments: PhotosFormContextAttachment[];
  imageMetadata: WorkflowImageMetadataRecord[];
}
```

Add a Photos-only editing surface for:

- alt text
- image order
- included-in-listing default

### Testing Form

Extend the Testing form loader result to include workflow image metadata.

- `src/services/testingForm.ts`

Recommended additions:

```ts
export interface TestingFormLoadResult {
  source: TestingFormRecordSource;
  values: TestingFormValues;
  customerReference: TestingFormCustomerReference;
  imageMetadata: WorkflowImageMetadataRecord[];
}
```

Testing UI should support:

- uploading new images
- editing alt text for testing-uploaded images
- optional inclusion recommendation editing

Testing should not surface the final durable reorder UI unless operations explicitly want it there.

## Listing Behavior Changes

Listings should resolve workflow images in this priority order:

1. `Workflow Image Metadata JSON`
2. `Images` attachment field fallback
3. Existing listing image fields fallback for older approval records

The listing selector should consume workflow metadata as follows:

- selected images: all metadata records where `includedInListing === true`
- order: ascending `sortOrder`
- alt text: `alt`

Listings may continue to save their resolved image fields for Shopify/eBay payload generation, but the source data should come from workflow metadata.

## Merge And Reconciliation Rules

When loading a record:

1. Parse `Workflow Image Metadata JSON`.
2. Parse `Images` attachments.
3. Reconcile each attachment to an existing metadata record by:
   - `attachmentId`
   - otherwise `url`
4. Create missing metadata rows for attachments not yet represented.
5. Drop metadata rows whose attachments no longer exist, unless keeping tombstones is required later.

Default values for new metadata rows:

- `alt: ''`
- `includedInListing: true`
- `sortOrder`: append to the end
- `sourceStage`: current form stage
- `createdAt` and `updatedAt`: `now`

## Exact Repo Patch Order

Implement in this order to keep the rollout safe.

### Slice 1: Shared Helpers And Read Path

1. Add `src/services/workflowImageMetadata.ts`.
2. Add tests for parse, serialize, merge, reorder, and alt-text updates.
3. Update `photosForm.ts` loader to read `Workflow Image Metadata JSON`.
4. Update `testingForm.ts` loader to read `Workflow Image Metadata JSON`.
5. Update listing image helpers to prefer metadata when present.

Validation:

- metadata helper unit tests
- existing Photos/Testing load tests
- existing listing image tests still pass

### Slice 2: Photos Metadata Authoring

1. Add a workflow-image metadata editor section in `PhotosFormTab.tsx`.
2. Allow editing alt text, order, and `includedInListing`.
3. Update `submitPhotosForm` to write merged metadata JSON alongside attachment uploads.
4. Update docs for the Photos form and workflow phase.

Validation:

- Photos form tests for metadata load and save
- build

### Slice 3: Testing Metadata Authoring

1. Add a lighter metadata editor in `TestingFormTab.tsx`.
2. Allow editing alt text for testing images.
3. Update `submitTestingForm` to merge metadata JSON after attachment uploads.
4. Add Tests for testing-form metadata writeback.

Validation:

- Testing form tests for metadata load and save
- build

### Slice 4: Listings Read Metadata First

1. Update listing selector defaults to come from metadata.
2. Keep listing image include/exclude toggles and reorder behavior, but seed from workflow metadata.
3. Preserve current Shopify/eBay image payload generation by serializing the resolved workflow image rows back into the existing listing fields.

Validation:

- approval selector tests
- Shopify payload tests
- eBay payload tests
- full test suite

## Files Expected To Change

### New

- `src/services/workflowImageMetadata.ts`
- `tests/unit/src/services/workflowImageMetadata.test.ts`

### Existing

- `src/services/photosForm.ts`
- `src/services/testingForm.ts`
- `src/components/tabs/PhotosFormTab.tsx`
- `src/components/tabs/TestingFormTab.tsx`
- `src/components/approval/workflowListingImageHelpers.ts`
- `src/components/approval/WorkflowListingImageSelector.tsx`
- `src/components/approval/ApprovalFormFieldsSupplementalEditors.tsx`
- `src/services/shopifyDraftFromAirtableAssets.ts`
- `src/services/ebayDraftFromAirtable.ts`

### Docs

- `docs/forms/README.md`
- `docs/forms/photos.instructions.md`
- `docs/forms/testing.instructions.md`
- `docs/used-gear-workflow/phase-3-processing-and-handoffs.md`

## Validation Checklist

- [ ] Photos loads workflow image metadata alongside attachments.
- [ ] Photos can edit alt text and order and save both successfully.
- [ ] Testing can upload new images and merge metadata without deleting existing entries.
- [ ] Listings prefer workflow metadata over raw attachments when metadata exists.
- [ ] Listings still fall back gracefully for old rows that only have `Images`.
- [ ] Shopify image payloads reflect workflow alt text and order.
- [ ] eBay image URL ordering reflects workflow order.
- [ ] Full test suite and build pass.

## Deferred Questions

- Should `includedInListing` be workflow-owned, listing-owned, or dual-layer with listing override?
- Should Testing be allowed to reorder images, or only Photos?
- Do we want to keep alt text editable in Listings as a final override, or remove that entirely once workflow metadata exists?
- If Airtable field size becomes an issue, should the next migration step be a linked `Workflow Images` table?

## Recommendation

Use `Workflow Image Metadata JSON` as the immediate shared model, with Photos as the primary final metadata editor and Testing as a contributor. This gives the team a durable, shared image metadata source without forcing a large Airtable linked-table migration in the first pass.