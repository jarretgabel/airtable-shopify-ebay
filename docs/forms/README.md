# Inventory Processing Forms

This section documents the local forms under the `Inventory Processing` menu:

- [Incoming Gear Instructions](./incoming-gear.instructions.md)
- [Testing Instructions](./testing.instructions.md)
- [Photos Instructions](./photos.instructions.md)
- [Starter Kit](./templates/README.md)

## Shared Rules

- Both forms create records in the `SB Inventory` Airtable table.
- Both forms are local React forms, not Airtable embeds.
- Both forms load select options from Airtable table metadata at runtime.
- Both forms upload images to the `Images (Eduardo)` attachment field after the record is created.

## Shared Airtable Target

- Base ID: `appjQj8FQfFZ2ogMz`
- Table ID: `tblirsoRIFPDMHxb0`
- Table name: `SB Inventory`

## Primary Implementation Files

- Incoming gear UI: `src/components/tabs/AirtableEmbeddedForm.tsx`
- Incoming gear schema: `src/components/tabs/incoming-gear/incomingGearFormSchema.ts`
- Incoming gear service: `src/services/incomingGearForm.ts`
- Testing UI: `src/components/tabs/TestingFormTab.tsx`
- Testing schema: `src/components/tabs/testing/testingFormSchema.ts`
- Testing service: `src/services/testingForm.ts`
- Photos UI: `src/components/tabs/PhotosFormTab.tsx`
- Photos schema: `src/components/tabs/photos/photosFormSchema.ts`
- Photos service: `src/services/photosForm.ts`

## Navigation And Routes

- Menu group: `Inventory Processing`
- Incoming gear route key: `incoming-gear`
- Incoming gear path: `/incoming-gear`
- Testing route key: `testing`
- Testing path: `/testing`
- Photos route key: `photos`
- Photos path: `/photos`

## Change Checklist

When updating either form:

1. Update the schema file first if field order, labels, or defaults change.
2. Update the service if Airtable field names or payload transforms change.
3. Update the tab component if instructional copy or presentation changes.
4. Update these docs when field order, required fields, or route details change.
5. Run `npm run build` after meaningful edits.