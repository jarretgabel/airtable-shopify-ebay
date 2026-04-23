# Incoming Gear Instructions

## Purpose

The incoming gear form is the first-stage intake form for inventory items entering `SB Inventory` outside the public StereoBuyers quote-request workflow.

It is shown in the app under:

- Menu: `Inventory Processing`
- Route key: `incoming-gear`
- Path: `/incoming-gear`

## Current Implementation

- UI component: `src/components/tabs/AirtableEmbeddedForm.tsx`
- Schema and field order: `src/components/tabs/incoming-gear/incomingGearFormSchema.ts`
- Airtable submission logic: `src/services/incomingGearForm.ts`

## Airtable Behavior

- Creates a new record in `SB Inventory`.
- Uses Airtable metadata to populate select options for:
  - `Status`
  - `Component Type`
  - `Original Box`
  - `Manual`
  - `Remote`
  - `Power Cable`
  - `Shipping Method`
- Uploads selected images to `Images (Eduardo)` after record creation.
- Generates a temporary `SKU` if the field is left blank.
- Defaults `Status` to `Needs Initial Processing` if no status is selected.

## Environment Variables

Optional incoming gear form source links are read from:

- `VITE_AIRTABLE_INCOMING_GEAR_FORM_URL`
- `VITE_AIRTABLE_INCOMING_GEAR_FORM_EMBED_URL`

These variables are only used to show an external Airtable link in the UI. Submission goes directly to the Airtable table through the local service.

## Current Field Order

1. `Arrival Date`
2. `Pick Up #`
3. `Acquired From`
4. `Cost`
5. `SKU`
6. `Status`
7. `Make`
8. `Model`
9. `Component Type`
10. `Serial Number`
11. `Voltage`
12. `Inventory Notes`
13. `Cosmetic Notes`
14. `Images`
15. `Original Box`
16. `Manual`
17. `Remote`
18. `Power Cable`
19. `Additional Items`
20. `Weight`
21. `Shipping Dimensions`
22. `Shipping Method`

## Editing Guidance

- Change field order in `incomingGearFormFields` only.
- Keep `Component Type` as a searchable single-select unless the Airtable field contract changes.
- If Airtable field names change, update `submitIncomingGearForm` in the service to match the new field names.
- If new select fields are added, extend `IncomingGearFormOptionFieldName` and the metadata loader.
- If image upload behavior changes, update `uploadIncomingGearImages` rather than adding upload logic to the component.

## Validation Expectations

- Required UI validation currently covers:
  - `Arrival Date`
  - `Cost`
  - `Status`
  - `Make`
  - `Model`
  - `Component Type`
- After edits, run `npm run build`.