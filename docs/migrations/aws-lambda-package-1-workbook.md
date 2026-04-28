# AWS Lambda Package 1 Workbook

## Purpose

This document turns the migration plan into the first execution-ready package. Package 1 is the proving ground for the seam pattern, not the full backend migration.

Related docs:

- `docs/migrations/aws-lambda-migration-plan.md`
- `docs/migrations/aws-lambda-package-1-file-skeletons.md`
- `docs/migrations/aws-lambda-local-workflow.md`

## Package 1 Outcome

At the end of this package:

- the frontend can call JotForm through either the current direct service or Lambda
- the frontend can call Airtable listing reads through either the current direct service or Lambda
- hooks depend on `src/services/app-api/` instead of direct provider services
- provider secrets for the migrated Lambda paths can move out of browser-delivered env

## In Scope

- `src/services/app-api/flags.ts`
- `src/services/app-api/http.ts`
- `src/services/app-api/jotform.ts`
- `src/services/app-api/airtable.ts`
- `src/services/app-api/index.ts`
- `src/hooks/useJotForm.ts`
- `src/hooks/useListings.ts`
- `src/vite-env.d.ts`
- `.env.example`
- `aws/template.yaml`
- `aws/tsconfig.json`
- `aws/src/shared/*`
- `aws/src/handlers/jotform/*`
- `aws/src/handlers/airtable/getListings.ts`
- `aws/src/providers/jotform/client.ts`
- `aws/src/providers/airtable/client.ts`
- `aws/src/providers/airtable/validation.ts`

## Out Of Scope

- Shopify migration
- eBay migration
- Airtable writes
- Gmail migration
- AI migration
- listing publish orchestration
- auth redesign

## Execution Order

### Milestone 1: Frontend seam only

Deliverables:

- add `src/services/app-api/`
- implement direct-delegation wrappers only
- reroute `useJotForm` and `useListings`
- add new frontend env declarations without changing runtime behavior

Acceptance criteria:

- no visible UI behavior change
- no component reads migration flags directly
- `npm run build` passes

### Milestone 2: AWS skeleton only

Deliverables:

- add `aws/` folder structure
- add `template.yaml`
- add `aws/tsconfig.json`
- add shared helpers for response shaping, errors, logging, and secret loading
- add empty handlers and provider clients with compile-safe exports

Acceptance criteria:

- repo structure is ready for Lambda implementation
- route names, env names, and error contract are documented

### Milestone 3: JotForm Lambda path

Deliverables:

- implement `GET /api/jotform/forms`
- implement `GET /api/jotform/forms/{formId}/submissions`
- add JotForm Lambda branch in the app API wrapper
- validate flag-off direct mode and flag-on Lambda mode

Acceptance criteria:

- both routes return the same shape the hook already expects
- wrapper-level error normalization preserves current hook behavior
- fallback direct mode still works

### Milestone 4: Airtable listing-read Lambda path

Deliverables:

- implement `GET /api/airtable/listings`
- add server-side allowlist validation for table and optional view
- add Airtable Lambda branch in the app API wrapper
- validate flag-off direct mode and flag-on Lambda mode

Acceptance criteria:

- listing screens behave the same in both modes
- Airtable record shape is preserved exactly
- fallback direct mode still works

## Hard Requirements

1. No UI component or hook should branch on `import.meta.env` for migration behavior.
2. Package 1 must not change API payload shapes consumed by current hooks.
3. Lambda error responses must be normalized by the wrapper before reaching hooks.
4. Airtable phase 1 must use server-side allowlists, not a generic passthrough.
5. Current provider-facing services remain as fallback implementations until the Lambda path is proven.

## Dependencies And Prerequisites

### Required before Milestone 3

- decide whether to use SAM or SST
- decide where secrets live: Secrets Manager or SSM
- decide whether the frontend will call same-origin APIs or use `VITE_APP_API_BASE_URL`

### Required before Milestone 4

- define the first Airtable table allowlist
- define allowed views per table where practical
- confirm current `useListings` read paths that must stay shape-compatible

## Open Decisions To Resolve Before Coding The AWS Side

1. IaC choice: SAM or SST. The current plan assumes SAM unless there is a repo-level reason to prefer SST.
2. Secret store: Secrets Manager or SSM Parameter Store.
3. Deployment topology: same-origin behind one host or separate API host with `VITE_APP_API_BASE_URL`.
4. Initial Airtable allowlist: exact tables and optional views supported in Package 1.
5. Local workflow: whether to standardize on `sam local` for handler validation during the first package.

## Suggested Default Answers

If no stronger constraint exists, use these defaults:

- use SAM for Package 1
- use Secrets Manager for provider credentials
- prefer same-origin routing in production and keep `VITE_APP_API_BASE_URL` only as an escape hatch
- keep the first Airtable allowlist narrow to the exact `useListings` path in use today

## Repo-Backed Defaults For Package 1

### Seam call sites confirmed from current code

- `src/hooks/useJotForm.ts` imports `getForms` and `getFormSubmissions` directly from `src/services/jotform.ts`
- `src/hooks/useListings.ts` imports the Airtable service directly and calls `getRecords(tableName, { view: viewId })`
- `src/app/useAppData.ts` is the current shared caller for `useListings(tableName, viewId)`
- `src/app/useAppData.ts` reads `tableName` from `VITE_AIRTABLE_TABLE_NAME` and `viewId` from `VITE_AIRTABLE_VIEW_ID`

### Recommended Package 1 Airtable allowlist

Start with one allowlisted route shape only:

- `tableName = process.env.ALLOWED_AIRTABLE_TABLE_NAME`
- optional `view = process.env.ALLOWED_AIRTABLE_VIEW_ID`

Practical interpretation for Package 1:

- support only the same table currently used by `useAppData`
- support only the current optional default view used by `useAppData`
- reject any other `tableName`
- reject any non-empty `view` value that does not match the configured allowed view when a view allowlist is present

### What this intentionally does not include yet

- approval table reads
- Shopify approval table reads
- auth user-table reads
- reference-based Airtable reads
- record-detail reads

Those can be added in later packages after the narrow listing-read path is stable.

### JotForm defaults confirmed from current code

- `useJotFormSubmissions` currently calls `getFormSubmissions(id, 100)`
- `useJotFormInquiries` also calls `getFormSubmissions(formId, 100)`
- current submission ordering is `created_at DESC`

Implication for Package 1:

- keep the Lambda JotForm routes compatible with `limit=100`, `orderby=created_at`, and `direction=DESC` without requiring hook changes

## Risk Register

### Risk: wrapper drift

If the app API wrapper changes return shapes or error semantics, hooks will need unnecessary rewrites.

Mitigation:

- keep wrapper signatures identical to current hook expectations
- compare direct and Lambda results side by side before enabling Lambda by default

### Risk: Airtable over-generalization

If the first Airtable Lambda route becomes a generic passthrough, the validation and security surface expands too early.

Mitigation:

- keep the route narrow
- enforce server-side allowlists in Package 1

### Risk: mixed concerns in the first package

If Shopify, eBay, or auth work leaks into Package 1, validation scope expands and rollback becomes harder.

Mitigation:

- keep Package 1 limited to seam, JotForm, and Airtable listings
- defer all other providers until the pattern is proven

## Definition Of Done

Package 1 is done when all of the following are true:

1. `useJotForm` and `useListings` import only from `src/services/app-api/`.
2. JotForm and Airtable listings each support independent direct and Lambda modes.
3. Frontend env declarations include the new seam flags.
4. Lambda secrets are no longer required in browser env for the migrated routes.
5. The direct provider path still exists as a fallback.
6. `npm run build` passes after the seam reroutes.

## Immediate Next Planning Tasks

1. Confirm the IaC choice and secret store.
2. Write the exact Package 1 file skeletons for `src/services/app-api/` and `aws/`.
3. Define the Airtable allowlist for the first Lambda route.
4. Decide the local validation workflow for Lambda handlers.