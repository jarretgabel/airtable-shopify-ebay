# Manual Intake Instructions

## Purpose

The Manual Intake form is the first-stage intake form for inventory items entering `SB Inventory` directly inside the app rather than through the public StereoBuyers quote-request workflow.

It is shown in the app under:

- Menu: `Inventory Processing`
- Route key: `manual-intake`
- Path: `/inventory/manual-intake`

## Current Implementation

- UI component: `src/components/tabs/AirtableEmbeddedForm.tsx`
- Schema and field order: `src/components/tabs/manual-intake/manualIntakeFormSchema.ts`
- Airtable submission logic: `src/services/manualIntakeForm.ts`

## Airtable Behavior

- Creates a new record in `SB Inventory` when opened without a record id.
- Updates an existing inventory or workflow-backed row when opened with a record id.
- Uses Airtable metadata to populate select options for:
  - `Status`
  - `Component Type`
  - `Original Box`
  - `Manual`
  - `Remote`
  - `Power Cable`
  - `Shipping Method`
- Uploads selected images to `Images` after the record exists.
- Generates a temporary `SKU` if the field is left blank.
- Defaults `Status` to `Needs Initial Processing` if no status is selected.
- Supports routing new manual-entry records into Parking Lot 1 review or the accepted-arrival Parking Lot 2 states.

## Current Field Order

1. `Arrival Date`
2. `Pick Up #`
3. `Acquired From`
4. `Cost`
5. `Customer Cosmetic Notes`
6. `Customer Functional Notes`
7. `Customer Inclusion Notes`
8. `Customer Submitted Photos Notes`
9. `SKU`
10. `Status`
11. `Make`
12. `Model`
13. `Component Type`
14. `Serial Number`
15. `Voltage`
16. `Inventory Notes`
17. `Images`
18. `Cosmetic Condition Notes`
19. `Original Box`
20. `Manual`
21. `Remote`
22. `Power Cable`
23. `Additional Items`
24. `Weight`
25. `Shipping Dimensions`
26. `Shipping Method`

## Editing Guidance

- Change field order in `manualIntakeFormFields` only.
- Keep `Component Type` as a searchable single-select unless the Airtable field contract changes.
- If Airtable field names change, update `submitManualIntakeForm` in the service to match the new field names.
- If new select fields are added, extend `ManualIntakeFormOptionFieldName` and the metadata loader.
- If image upload behavior changes, update the image-upload helper in the service rather than adding upload logic to the component.
- Keep the manual-entry routing fields and status mapping logic in the service so the component stays presentation-focused.

## Validation Expectations

- Required UI validation currently covers:
  - `Arrival Date`
  - `Cost`
  - `Status`
  - `Make`
  - `Model`
  - `Component Type`
- After edits, run `npm run build`.
