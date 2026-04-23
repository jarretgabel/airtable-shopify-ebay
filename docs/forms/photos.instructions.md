# Photos Instructions

## Purpose

The photos form is the third-stage inventory-processing form used after testing. It supports primary image uploads, cosmetic review notes, and marking the unit as photo'd.

It is shown in the app under:

- Menu: `Inventory Processing`
- Route key: `photos`
- Path: `/photos`

## Current Implementation

- UI component: `src/components/tabs/PhotosFormTab.tsx`
- Schema and field order: `src/components/tabs/photos/photosFormSchema.ts`
- Airtable submission logic: `src/services/photosForm.ts`

## Current Instructional Copy

The header description currently reads:

> Use this form after testing is complete to upload the primary listing photos, add any box or detail shots, and mark the unit as photo'd for listing prep.

If this wording changes, update `src/components/tabs/PhotosFormTab.tsx`.

## Airtable Behavior

- Creates a new record in `SB Inventory`.
- Uses Airtable metadata to populate select options for:
  - `Status`
  - `Component Type`
  - `Audiogon Rating`
  - `Original Box`
  - `Manual`
  - `Remote`
  - `Power Cable`
- Uploads selected primary images to `Images (Eduardo)` after record creation.
- Uses the Airtable field `Photo'd` while displaying the label `Photo Date` in the UI.

## Current Field Order

1. `SKU`
2. `Make`
3. `Model`
4. `Component Type`
5. `Original Box`
6. `Manual`
7. `Remote`
8. `Power Cable`
9. `Additional Items`
10. `Audiogon Rating`
11. `Cosmetic Notes`
12. `Images`
13. `Photo Date`
14. `Status`

## Airtable Field Mapping Notes

- `Cosmetic Notes` maps to Airtable field `Cosmetic Condition Notes`.
- `Audiogon Rating` maps to the Airtable field of the same name.
- `Photo Date` maps to Airtable field `Photo'd`.
- `Images` uploads to Airtable field `Images (Eduardo)`.

## Editing Guidance

- Change field order in `photosFormFields` only.
- Keep required validation aligned with the schema and submit expectations.
- If Airtable field names change, update `submitPhotosForm` in `src/services/photosForm.ts`.
- If new select fields are introduced, extend `PhotosFormOptionFieldName` and the metadata loader in the service.
- Keep the visible field set aligned to the current photo workflow unless requirements change.

## Validation Expectations

- Required UI validation currently covers:
  - `SKU`
  - `Make`
  - `Model`
  - `Component Type`
  - `Photo Date`
  - `Status`
  - At least one image
- After edits, run `npm run build`.