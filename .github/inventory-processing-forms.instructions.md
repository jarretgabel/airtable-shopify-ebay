---
description: Use when creating or updating local Airtable-backed forms under Inventory Processing, including incoming gear, testing, and future forms that should follow the same schema/component/service pattern.
applyTo: src/components/tabs/AirtableEmbeddedForm.tsx,src/components/tabs/TestingFormTab.tsx,src/components/tabs/incoming-gear/**,src/components/tabs/testing/**,src/services/incomingGearForm.ts,src/services/testingForm.ts,docs/forms/**
---

# Inventory Processing Form Pattern

Use this guidance when building or changing local forms that live under the `Inventory Processing` menu.

## Architecture Pattern

Follow the same three-part structure for each form:

1. A tab component for rendering, local state, validation, and submit orchestration.
2. A schema/config file for ordered field definitions, field labels, Airtable field names, and default values.
3. A dedicated service for Airtable metadata loading, request payload mapping, record creation, and image upload.

Do not collapse schema, rendering, and Airtable transport into one file unless there is a strong reason.

## File Placement

- Put the user-facing tab component in `src/components/tabs`.
- Put form-specific schema/config beside the form in a dedicated folder under `src/components/tabs/<form-name>/` when practical.
- Put Airtable logic in `src/services/<formName>.ts`.
- Document the form in `docs/forms/`.
- Start from the reusable scaffold in `docs/forms/templates/` when creating a new form.

## Routing And Navigation

- Inventory-processing forms should appear under the `Inventory Processing` dropdown, not as unrelated top-level tabs.
- Route keys must be clear, permanent identifiers that match the form purpose.
- When adding a new form, update the route/page definitions, navigation grouping, and any access helpers together.

## Schema Rules

- Keep field order in the schema file as the single source of truth for render order.
- Each field definition should include the Airtable field name used by the service.
- UI labels may differ from Airtable field names when needed, but the mapping must remain explicit.
- Put select-option metadata names in a dedicated option-field union type.
- Keep default values centralized in a factory like `create<FormName>Defaults()`.

## Component Rules

- The tab component should stay orchestration-focused.
- Keep validation lightweight and local to the component unless reused.
- Reuse shared state surfaces such as `PanelSurface`, `LoadingSurface`, and `ErrorSurface`.
- Prefer simple render branching by field type instead of embedding field-specific Airtable logic into JSX.
- Keep copy edits in the component when they are page-level presentation copy, and in schema when they are structured intro content.

## Airtable Service Rules

- Load select options from Airtable metadata instead of hardcoding them when the Airtable field is authoritative.
- Keep request payload construction in the service, not in the React component.
- Remove empty values before create calls.
- Convert UI-specific values into Airtable storage formats explicitly.
  - Example: duration minutes in the UI may need conversion to seconds for Airtable duration fields.
  - Example: searchable single-select UI values may need to be sent as single-item arrays when Airtable uses multi-select storage.
- Upload attachments after record creation using the Airtable content API.

## Form UX Consistency

- Use the same visual structure established by incoming gear and testing.
- Keep labels, help text, spacing, and form controls consistent across related forms.
- Use searchable single-select inputs for large Airtable option sets like `Component Type`.
- Use explicit date inputs for date fields.
- Keep button behavior consistent: `Reset` and submit actions at the bottom of the form.

## Documentation Rules

- When adding a new form, add or update a document in `docs/forms/`.
- Document:
  - purpose
  - route key and path
  - implementation files
  - Airtable target
  - field order
  - special mapping or conversion rules
- Keep `docs/forms/README.md` current when a new form is added.

## Validation Checklist

After meaningful changes to an inventory-processing form:

1. Run `npm run build`.
2. Verify route wiring and menu placement still work.
3. Confirm field order matches the schema.
4. Confirm required validation still aligns with business expectations.
5. Confirm any Airtable field-name changes are reflected in the service mapping.