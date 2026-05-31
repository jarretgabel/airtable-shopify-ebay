# How to Add a New Workflow, Form, or Integration

## Adding a New Workflow
1. Define the workflow and its stages in `docs/PROJECT_REFERENCE_SUMMARY.md` and `docs/used-gear-workflow/`.
2. Add or update the UI surface in `src/components/tabs/`.
3. Update navigation and menu wiring as needed.
4. Add or update schema and service files.
5. Update all relevant docs and instruction files.
6. Add example data in `docs/examples/` if applicable.

## Adding a New Form
1. Copy and adapt the starter kit from `docs/forms/templates/`.
2. Update schema, service, and UI files.
3. Add the route and menu wiring.
4. Document the form in `docs/forms/` and update the summary file.
5. Add example payloads in `docs/examples/`.

## Adding a New Integration
1. Add service and API client files in `src/services/`.
2. Update environment variable docs and `.env.example`.
3. Add UI and/or backend orchestration as needed.
4. Update all relevant docs and the summary file.
5. Add example API payloads in `docs/examples/`.

## Checklist
- [ ] Update `docs/PROJECT_REFERENCE_SUMMARY.md`
- [ ] Update or add to `docs/` and `.github/` instruction files
- [ ] Add example data/payloads
- [ ] Reference all changes in your PR
