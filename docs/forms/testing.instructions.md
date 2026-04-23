# Testing Instructions

## Purpose

The testing form is the second-stage inventory-processing form used after intake. It supports verification, bench testing, service tracking, and a final review of previously entered inventory details.

It is shown in the app under:

- Menu: `Inventory Processing`
- Route key: `testing`
- Path: `/testing`

## Current Implementation

- UI component: `src/components/tabs/TestingFormTab.tsx`
- Schema and field order: `src/components/tabs/testing/testingFormSchema.ts`
- Airtable submission logic: `src/services/testingForm.ts`

## Current Instructional Copy

The header description currently reads:

> In addition to general testing and service, please double check all previously entered details to ensure accuracy of information.

If this wording changes, update `src/components/tabs/TestingFormTab.tsx`.

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
- Submits `Testing Time` as seconds converted from entered minutes.
- Submits `Service Time` as seconds converted from entered minutes.
- Uses the Airtable field `Tested` while displaying the label `Testing Date` in the UI.

## Current Field Order

1. `SKU`
2. `Arrival Date`
3. `Acquired From`
4. `Make`
5. `Model`
6. `Component Type`
7. `Cost`
8. `Inventory Notes`
9. `Serial Number`
10. `Voltage`
11. `Audiogon Rating`
12. `Cosmetic Notes`
13. `Original Box`
14. `Manual`
15. `Remote`
16. `Power Cable`
17. `Additional Items`
18. `Shipping Weight`
19. `Shipping Dimensions`
20. `Shipping Method`
21. `Images`
22. `Testing Notes`
23. `Testing Time`
24. `Service Notes`
25. `Service Time`
26. `Testing Date`
27. `Status`

## Airtable Field Mapping Notes

- `Cosmetic Notes` maps to Airtable field `Cosmetic Condition Notes`.
- `Shipping Dimensions` maps to Airtable field `Shipping Dims`.
- `Testing Date` maps to Airtable field `Tested`.
- `Testing Time` maps to Airtable field `Testing Time` and is converted from minutes to seconds.
- `Service Time` maps to Airtable field `Service Time` and is converted from minutes to seconds.

## Editing Guidance

- Change field order in `testingFormFields` only.
- Keep required validation aligned with the schema and submit expectations.
- If Airtable field names change, update `submitTestingForm` in `src/services/testingForm.ts`.
- If new select fields are introduced, extend `TestingFormOptionFieldName` and the metadata loader in the service.
- Preserve the duration conversion pattern for time-entry fields unless Airtable changes those fields away from duration storage.

## Validation Expectations

- Required UI validation currently covers:
  - `SKU`
  - `Make`
  - `Model`
  - `Component Type`
  - `Status`
- After edits, run `npm run build`.