# Inventory Processing Forms

This section documents the local forms under the `Inventory Processing` menu:

- [Used Gear Workflow Plan](../used-gear-workflow-plan.md)
- [Used Gear Workflow: Phase 1 Foundation](../used-gear-workflow/phase-1-foundation.md)
- [Used Gear Workflow: Phase 2 Intake And Parking Lots](../used-gear-workflow/phase-2-intake-and-parking-lots.md)
- [Used Gear Workflow: Phase 3 Processing And Handoffs](../used-gear-workflow/phase-3-processing-and-handoffs.md)
- [Used Gear Workflow: Phase 4 Pre-Listing And Publish Readiness](../used-gear-workflow/phase-4-pre-listing-and-publish-readiness.md)
- [Used Gear Workflow: Phase 5 Post-Publish Lifecycle](../used-gear-workflow/phase-5-post-publish-lifecycle.md)
- [Used Gear Workflow: Phase 6 Marketplace Expansion](../used-gear-workflow/phase-6-marketplace-expansion.md)
- [Used Gear Workflow: Data Model And Approvals](../used-gear-workflow/data-model-and-approvals.md)
- [Used Gear Workflow: Workflow Image Metadata](../used-gear-workflow/workflow-image-metadata-plan.md)
- [Used Gear Workflow: UI Surface Map](../used-gear-workflow/ui-surface-map.md)
- [Incoming Gear Instructions](./incoming-gear.instructions.md)
- [Testing Instructions](./testing.instructions.md)
- [Photos Instructions](./photos.instructions.md)
- [Starter Kit](./templates/README.md)

## Shared Rules

- Both forms create records in the `SB Inventory` Airtable table.
- Both forms are local React forms, not Airtable embeds.
- Both forms load select options from Airtable table metadata at runtime.
- Both forms upload images to the `Images` attachment field after the record is created.
- Shared workflow image metadata is documented in `Workflow Image Metadata` and uses the live `Workflow Image Metadata JSON` field alongside `Images`.

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