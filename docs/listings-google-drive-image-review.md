# Listings Google Drive Image Coverage and Sync Review

Audit date: 2026-10-10  
Scope: all 513 records in the Listings-page workflow status subset, sorted newest first. SKU 10800 was skipped as requested.

## Latest exact-SKU folder coverage

The coverage comparison checks every file in every exact-SKU Drive folder. Identical files are grouped by MD5 checksum (or file ID if no checksum exists). A content group counts as represented only when it matches an included `testing`- or `photos`-stage Drive image in Airtable.

| Finding | Result |
|---|---:|
| Records checked | 513 |
| Records with an exact-SKU folder | 389 |
| Records with all exact-SKU folder content represented | 367 |
| Records needing visual review | 16 |
| Records needing classification | 6 |
| Records with no exact-SKU folder found | 123 |
| Records skipped by request | 1 |
| Exact-SKU folders / file copies | 991 / 10,778 |
| Distinct content groups / represented groups | 10,041 / 4,672 (46.5%) |
| Unlinked processed-image content groups | 0 |
| Unlinked listing-style content groups | 22 |
| Unlinked other non-original content groups | 45 |
| Unlinked camera-named content groups | 5,302 |
| Files explicitly marked `processed` in the filename | 0 |

### Latest reviewed-photo sync

The newest-first coverage refresh and sync completed on 2026-10-10. After visually verifying the image watermark and product match, checking public image access and the exact SKU folder, and applying the filename standard:

- Renamed **140 reviewed Google Drive files across 25 SKU folders**. Every rename passed preflight for exact folder membership, image MIME type, public readability, and filename collision; final readback confirmed the new names. No Drive permissions were changed.
- Added all **140 Drive file IDs** to the matching records' included `photos` entries in `Workflow Image Metadata JSON`.
- Replaced **36 seed-placeholder metadata rows** across SKUs 10539, 11500, 11462, 11363, 11362, and 11359. No Drive files or legacy Airtable `Images` attachments were removed or changed.
- Airtable apply readback verified the added IDs, placeholder removal, and unchanged legacy attachments. The subsequent full coverage run found **zero unlinked processed-image content groups** across all 513 records.
- A fresh full Listings metadata scan found **5,838 Google Drive URLs, zero Airtable URLs, and zero other-hosted image URLs** across 513 records. All 140 new entries have matching Drive URLs, filenames, included `photos` stage, and non-empty alt text, with no duplicate metadata IDs.

| SKU | Added photos |
|---:|---:|
| 10539 | 1 |
| 11320 | 14 |
| 11359 | 2 |
| 11362 | 7 |
| 11363 | 3 |
| 11396 | 8 |
| 11419 | 6 |
| 11421 | 10 |
| 11462 | 14 |
| 11500 | 2 |
| 11750 | 8 |
| 11752 | 5 |
| 11753 | 5 |
| 11754 | 7 |
| 11755 | 4 |
| 11756 | 5 |
| 12054 | 2 |
| 12081 | 5 |
| 12223 | 8 |
| 12241 | 3 |
| 12272 | 5 |
| 12275 | 9 |
| 12276 | 3 |
| 12278 | 3 |
| 12284 | 1 |

### Processed-candidate check

The figures below are from the earlier 206-candidate OCR/access snapshot, before the latest sync; they are retained as review history and are not current outstanding counts.

After excluding six photos already added and five content groups with a Drive file ID already present in workflow metadata, 206 unlinked non-camera candidates remained. Local Vision OCR detected the watermark text in 146; 98 of those returned public `image/jpeg` responses and 48 were private. OCR did not detect the watermark in the other 60, which is not proof they are unprocessed.

Of the 98 public watermark-positive candidates, five had naming-valid filenames; visual review found four packaging-only images and one wrong-product image. The other 93 had noncompliant filenames and required descriptive filename cleanup plus product review. The latest approved subset has since been renamed and synced as described above; other unverified listing-style and non-original groups remain excluded from the processed-photo count.

The per-file OCR/access results are in [listings-google-drive-processed-candidate-audit.csv](./listings-google-drive-processed-candidate-audit.csv).

The six photos below were visually verified for the watermark and product match, passed the public-image check, and were added as included `photos`-stage Drive entries. Airtable readback verified each file ID. No seed metadata, legacy `Images` attachments, or Drive sharing settings were changed.

| SKU | Added photos |
|---:|---:|
| 12216 | 1 |
| 12099 | 2 |
| 12100 | 1 |
| 12054 | 2 |

The refreshed file-level coverage report is [listings-google-drive-image-coverage.csv](./listings-google-drive-image-coverage.csv). The 5,302 camera-named groups are not assumed to be processed listing photos. A missing exact-SKU folder does not prove a record has no images; some records may use differently named folders or already have Drive metadata. This comparison checks folder/content representation, not visual correctness or public access for every image already linked.

SKU **11759** has three watermark-confirmed photo groups already stored in testing-stage metadata but not included in the listing. Their inclusion flags were left unchanged pending confirmation; two additional `-2` variants remain unclassified.

The newest unresolved review entries, in the audit's creation-time order, are SKUs **12335** (T+A HA200), **12333** (Meze Audio Empyrean Elite), **12313** and **12312** (VTL ST-85), **12300** (PS Audio BHK 250), **12351** (VTL TT 25 Limited Edition), **12352** (LAB 12 DAC 1 Reference), and **12350** (VTL ST 150). Their remaining files still need visual verification/classification before adding.

## Previously reported completed sync (historical snapshot)

After reviewing full-size Drive images for the processed-photo watermark, matching duplicate copies by image content, checking the listing filename rules, and verifying public image access:

- Added **84 processed Google Drive photos across 20 records** to `Workflow Image Metadata JSON`.
- Removed **120 workflow seed-placeholder photo rows** from those same 20 records. These are test/sample metadata rows, not files deleted from Drive.
- Preserved every record's legacy Airtable `Images` attachment field. No Drive sharing permissions were changed.
- The sync read back each updated record and verified added Drive file IDs, placeholder removal, and unchanged legacy attachments.
- At that time, a fresh Airtable read verified all **84 added file IDs**, found **5,730 Google Drive URLs and zero Airtable or other-hosted URLs** in workflow image metadata, and found no duplicate Drive file IDs within a record. The current URL totals are reported in Latest reviewed-photo sync above.

Updated SKUs and number of photos added:

| SKU | Added photos |
|---:|---:|
| 11520 | 2 |
| 11320 | 1 |
| 12284 | 1 |
| 12278 | 2 |
| 12275 | 2 |
| 12276 | 1 |
| 12272 | 1 |
| 12241 | 1 |
| 12223 | 1 |
| 12127 | 3 |
| 12101 | 1 |
| 11756 | 9 |
| 11755 | 11 |
| 11754 | 8 |
| 11753 | 12 |
| 11752 | 13 |
| 11750 | 9 |
| 11421 | 2 |
| 11419 | 1 |
| 11396 | 3 |

## Earlier targeted sync audit (historical; superseded by the folder-coverage totals above)

| Audit status | Records | Meaning |
|---|---:|---|
| Existing Drive photos | 476 | At least one included, non-original Google Drive photo URL exists in workflow metadata. This check does not re-verify every existing image in its Drive folder. |
| No matching SKU folder | 17 | No exact SKU-named folder was found in Google Drive. |
| Manual image review | 18 | The record needs another decision: unwatermarked or otherwise unverified candidates, seed metadata without a confirmed replacement, existing testing-stage photos, or other folder/product ambiguity. |
| Duplicate SKU folders | 1 | SKU 12219 has multiple candidate folders and no confirmed matching product-photo set. |
| Skipped by request | 1 | SKU 10800 remains untouched. |

That earlier sync audit planned **zero writes at that time**. Its 17-candidate figure predates the broader folder-coverage review and is not the current remaining-candidate count. The full 513-row sync audit is [listings-google-drive-image-sync-audit.csv](./listings-google-drive-image-sync-audit.csv).

## Earlier follow-up records (historical snapshot)

### No exact SKU folder found

SKUs **10580, 11638, 11633, 11629, 11582, 11542, 11497, 11491, 11492, 11454, 11444, 10969, 12273, 12274, 12227, 12226, and 11831**.

### Manual review

SKUs **10539, 11500, 11462, 11373, 11363, 11362, 11359, 11314, 12254, 12128, 12116, 12050, 12049, 12022, 12021, 11793, 11780, and 11759**.

Among the unlinked candidates, some files for SKUs **10539, 11462, and 11314** are private to the configured Drive account. They were not added because the listing app cannot read them without a permission change. Do not change their Drive sharing settings without approval; select a public processed copy or resolve access first.

### Known product/source cautions

- **10800:** Explicitly skipped. Do not update unless the user removes that exclusion.
- **12219:** Candidate image files in the matching SKU folders do not establish a correct product-photo set; a previously inspected candidate depicts a different product. Keep unlinked pending the correct source.
- **12128:** The matching folder has camera-named intake/testing images and no confirmed processed listing set.
- **11759:** Existing Drive-backed metadata is in `testing`, not `photos`; review its stage/inclusion intent instead of duplicating those Drive file IDs.
- The remaining 29 records containing the known workflow seed-image filename pattern were not automatically cleared. Remove placeholders only when a real processed replacement is confirmed; the 20 completed replacements removed only matching seed-placeholder metadata and did not delete Drive files.

## Rules and data safety

- Listing images use Google Drive URLs only, in `Workflow Image Metadata JSON`; Airtable attachment URLs are never substituted as listing image sources.
- The legacy Airtable `Images` attachments remain in Airtable and are not deleted by this workflow.
- An image is not considered processed from its filename alone. Candidates must be visually confirmed, correctly matched to the product, naming-compliant, and publicly readable by the listing app.
- Filenames use lowercase ASCII kebab-case with a consistent brand-model prefix; hero images follow `brand-model-product-type.jpg`, additional images `brand-model-key-detail.jpg`. Use 4–10 words, no company name, camera names, random numbers, or processing/version suffixes. Every image includes alt text.
- The existing `sync-drive-images` updater is unsafe for this backfill because it scans record-ID folders and replaces workflow metadata. Use the audit-first [sync-sku-google-drive-images.mjs](../scripts/sync-sku-google-drive-images.mjs).
