# Inventory Processing Form Starter Kit

Use this starter kit when creating another local Airtable-backed form under the `Inventory Processing` menu.

## Included Templates

- `ProcessingFormTab.template.tsx`
- `processingFormSchema.template.ts`
- `processingFormService.template.ts`

## Recommended Workflow

1. Copy the three template files into their real destinations.
2. Rename placeholders like `ProcessingForm`, `processingForm`, `PROCESSING_FORM`, and Airtable field labels.
3. Add the route and menu wiring using `.github/inventory-processing-routing.instructions.md`.
4. Add a form-specific doc in `docs/forms/`.
5. Run `npm run build`.

## Suggested Destination Pattern

- UI component: `src/components/tabs/<FormName>Tab.tsx`
- Schema: `src/components/tabs/<form-name>/<formName>Schema.ts`
- Service: `src/services/<formName>.ts`

## Placeholder Conventions

- `ProcessingForm` = PascalCase feature name
- `processingForm` = camelCase feature name
- `PROCESSING_FORM` = upper snake case constant prefix
- `Processing Form` = user-visible label

## Notes

- The starter is intentionally generic. It gives you the established pattern, not a frozen implementation.
- Keep field order in the schema file.
- Keep Airtable request mapping in the service.
- Keep route/menu updates separate from field rendering logic.