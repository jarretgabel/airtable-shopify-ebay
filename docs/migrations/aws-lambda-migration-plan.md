# AWS Lambda Migration Plan

## Goal

Move backend-adjacent integrations out of the browser in small, reversible phases while keeping the current Vite app live. The preferred approach is a strangler pattern: add AWS API Gateway and Lambda beside the current frontend, introduce a thin app API client in the frontend, migrate one integration at a time behind feature flags, and defer the highest-risk auth and session redesign until the privileged reads and writes are already off the client.

## Companion Docs

- `docs/migrations/aws-lambda-package-1-workbook.md`
- `docs/migrations/aws-lambda-package-1-file-skeletons.md`
- `docs/migrations/aws-lambda-local-workflow.md`

## Core Rules

1. Add the frontend seam before moving any provider.
2. Migrate one integration at a time behind an independent feature flag.
3. Preserve current response shapes and user-visible error behavior.
4. Keep the existing direct or Vite-proxy path available until the Lambda path is validated.
5. Do not combine the server extraction with a frontend hosting migration.

## Phased Rollout

### Phase 0: Foundation and guardrails

Create the AWS scaffolding before migrating business logic.

- Choose one IaC path: AWS SAM or SST is preferred for the first pass.
- Define one HTTP API Gateway.
- Create shared Lambda utilities for request parsing, logging, error envelopes, and provider clients.
- Provision Secrets Manager or SSM Parameter Store for third-party credentials.
- Provision CloudWatch logging and metrics.
- Provision one DynamoDB table for server-owned session, config, and job state.
- Add frontend env flags so each integration can switch independently between direct or proxy and Lambda-backed behavior.

### Phase 0.5: Frontend seam creation

Create app-facing service wrappers under `src/services/app-api/` so the rest of the app depends on stable internal contracts instead of direct provider clients.

- `appApi.airtable`
- `appApi.jotform`
- later `appApi.shopify`
- later `appApi.ebay`
- later `appApi.ai`

The first version of each wrapper should delegate to the current client-side service without behavior changes.

### Phase 1: Low-risk secret extraction

Move JotForm, AI, and Gmail behind Lambda first because they have clear request and response boundaries and lower coupling to app state.

- Update the frontend wrappers to call Lambda endpoints.
- Preserve existing response contracts.
- Keep per-integration fallback flags until validated.

### Phase 2: Airtable read proxy

Move Airtable reads used by the dashboard, directory, auth lookups, and related hooks into Lambda-backed endpoints.

- Preserve current Airtable record shapes exactly.
- Keep direct Airtable writes untouched during this phase.
- Establish shared retry, pagination, and error normalization patterns.

### Phase 3: Airtable writes and auth-supporting operations

Move Airtable create, update, and delete operations plus auth-adjacent user-table actions behind Lambda.

- Add server-side validation for allowed tables and fields.
- Normalize write errors into the existing service error shape.
- Keep current client-side role checks initially, but make Lambda the enforcement point for sensitive writes where practical.

### Phase 4: Shopify Admin API

Move Shopify product reads, upserts, and media-related requests behind Lambda endpoints.

- Preserve current create and update contracts.
- Keep staged upload and collection assignment behavior aligned with the current flow.
- If staged media forwarding is awkward in Lambda, isolate that subflow behind S3-presigned upload mediation rather than expanding scope for all Shopify calls.

### Phase 5: eBay read proxy

Move eBay inventory, offers, taxonomy, and other read-only operations behind Lambda while initially preserving current browser session behavior if needed.

- The first pass can accept the current access token or a server token reference, whichever is less disruptive.
- The purpose of this phase is to decouple the UI from direct eBay API structure before changing OAuth or session ownership.

### Phase 6: eBay OAuth and token redesign

Move OAuth exchange, refresh, token storage, and eBay account configuration fully server-side using DynamoDB plus encrypted secret or session storage.

- Replace localStorage-driven refresh flows with server-owned session handling.
- Prefer secure httpOnly cookies plus server-side session storage over long-lived browser tokens.

### Phase 7: Listing publish orchestration

Extract the multi-service approval and publish flow into a Lambda orchestration endpoint.

- Start with one Lambda plus persisted job state in DynamoDB.
- Promote to Step Functions only if retries and compensation become complex enough to justify the extra operational surface.

### Phase 8: Scrape, proxy, and cleanup

Move HiFiShark and public eBay scraping behind Lambda after the critical token-based integrations are stable.

- Remove production dependence on Vite proxy behavior.
- Rotate credentials.
- Delete dead direct-provider code.
- Tighten IAM and document final service boundaries.

## Parallelism and Sequencing

### Parallel-safe early work

- JotForm, AI, and Gmail can be extracted independently once the app API seam exists.

### Sequential core path

- Airtable reads before Airtable writes.
- eBay reads before eBay OAuth and token redesign.
- Publish orchestration after Shopify and eBay are already Lambda-backed.

### Safety rules

- Every migration phase must ship with a feature flag or environment switch to revert that single integration.
- Do not remove the direct or proxy implementation until the Lambda path has passed local and production-like validation.

## AWS Target Shape

1. HTTP ingress: API Gateway HTTP API with domain routes such as `/api/airtable/*`, `/api/shopify/*`, `/api/ebay/*`, `/api/jotform/*`, `/api/ai/*`, and `/api/system/*`.
2. Compute: one Lambda per bounded capability at first, not one mega-handler.
3. Secrets: Secrets Manager or SSM Parameter Store for Airtable, Shopify, JotForm, OpenAI or GitHub Models, Gmail, and eBay credentials.
4. State: DynamoDB for eBay tokens, config, publish job state, and idempotency keys.
5. Files: S3 only where required for staged uploads, large artifacts, or server-generated exports.
6. Workflow: Step Functions only if the publish flow proves too fragile as a single Lambda plus polling.
7. Observability: CloudWatch logs, request correlation ids, error metrics, and structured error envelopes that match current frontend service expectations.

## Frontend Seam

The first seam should be introduced under `src/services/app-api/` so hooks and components depend on internal contracts rather than direct providers.

### Recommended first files

- `src/services/app-api/index.ts`
- `src/services/app-api/flags.ts`
- `src/services/app-api/http.ts`
- `src/services/app-api/jotform.ts`
- `src/services/app-api/airtable.ts`

### Recommended first reroutes

- `src/hooks/useJotForm.ts`
- `src/hooks/useListings.ts`

### Seam rule

- The first version of each app API wrapper preserves current behavior exactly by delegating to the existing provider-facing service.
- Only after the hook reroute is stable should the wrapper gain the Lambda branch.
- UI code should never know whether the wrapper is using direct or Lambda-backed behavior.

## First Package Scope

The first implementation package should prove the pattern with the smallest useful surface.

### Package 1 includes

- Frontend seam files under `src/services/app-api/`
- Hook reroutes for JotForm and Airtable listings
- AWS skeleton under `aws/`
- JotForm Lambda routes
- Airtable listing-read Lambda route
- Feature flags for JotForm and Airtable switching

### Package 1 deliberately excludes

- Shopify changes
- eBay changes
- publish orchestration changes
- auth redesign
- frontend hosting migration

## App API Contracts

### JotForm seam

- `getForms(): Promise<JotFormForm[]>`
- `getFormSubmissions(formId: string, limit?: number, offset?: number): Promise<JotFormSubmission[]>`

### Airtable seam

- `getListings(tableName: string, options?: { view?: string }): Promise<AirtableRecord[]>`

### Wrapper behavior

- Exported function signatures should match current hook needs exactly.
- Wrappers should preserve current types and error semantics.
- Wrappers own the migration flag check so hooks remain unaware of environment switches.

## Initial Route Contracts

### JotForm routes

`GET /api/jotform/forms`

- Optional query params: `limit`, `orderby`, `direction`
- Success body: `JotFormForm[]`
- Error body: `{ message, service: 'jotform', code, retryable }`

`GET /api/jotform/forms/{formId}/submissions`

- Path param: `formId`
- Optional query params: `limit`, `offset`, `orderby`, `direction`
- Success body: `JotFormSubmission[]`
- Error body: `{ message, service: 'jotform', code, retryable }`

Validation rules:

- Reject empty `formId`.
- Clamp or validate `limit` and `offset`.
- Preserve current submission ordering semantics.

### Airtable route

`GET /api/airtable/listings`

- Required query param: `tableName`
- Optional query param: `view`
- Success body: `AirtableRecord[]`
- Error body: `{ message, service: 'airtable', code, retryable }`

Validation rules:

- `tableName` must be in a server-side allowlist.
- `view` should be validated against allowed values where practical.
- Preserve `id`, `fields`, and `createdTime` exactly.
- Keep internal pagination server-owned so the frontend still receives a simple array.

## Concrete Repo Layout

### Frontend

- `src/services/app-api/index.ts`
- `src/services/app-api/flags.ts`
- `src/services/app-api/http.ts`
- `src/services/app-api/jotform.ts`
- `src/services/app-api/airtable.ts`

### AWS

- `aws/README.md`
- `aws/template.yaml`
- `aws/tsconfig.json`
- `aws/src/shared/http.ts`
- `aws/src/shared/errors.ts`
- `aws/src/shared/logging.ts`
- `aws/src/shared/secrets.ts`
- `aws/src/shared/types.ts` if shared route types are worth centralizing
- `aws/src/handlers/jotform/getForms.ts`
- `aws/src/handlers/jotform/getFormSubmissions.ts`
- `aws/src/handlers/airtable/getListings.ts`
- `aws/src/providers/jotform/client.ts`
- `aws/src/providers/airtable/client.ts`
- `aws/src/providers/airtable/validation.ts`

## Environment Split

### Add now in the frontend

- `VITE_USE_LAMBDA_JOTFORM=false`
- `VITE_USE_LAMBDA_AIRTABLE=false`
- `VITE_APP_API_BASE_URL=`

### Keep temporarily in the frontend during migration

- `VITE_AIRTABLE_API_KEY`
- `VITE_AIRTABLE_BASE_ID`
- `VITE_JOTFORM_API_KEY`
- other current `VITE_*` provider values that still back the direct path

### Move to Lambda runtime first

- `VITE_JOTFORM_API_KEY` -> `JOTFORM_API_KEY`
- `VITE_AIRTABLE_API_KEY` -> `AIRTABLE_API_KEY`
- `VITE_AIRTABLE_BASE_ID` -> `AIRTABLE_BASE_ID`

### Delay until later phases

- `VITE_SHOPIFY_*`
- `VITE_EBAY_*`
- `VITE_GOOGLE_GMAIL_*`
- `VITE_GITHUB_TOKEN`
- `VITE_OPENAI_API_KEY`

## Day-by-Day Sequence For Package 1

### Day 1

- Add `src/services/app-api/flags.ts`, `http.ts`, `jotform.ts`, `airtable.ts`, and `index.ts`.
- Implement wrappers in direct-delegation mode only.

### Day 2

- Reroute `src/hooks/useJotForm.ts` to the app API JotForm seam.
- Reroute `src/hooks/useListings.ts` to the app API Airtable seam.
- Confirm no behavior change.

### Day 3

- Add the `aws/` folder, IaC skeleton, shared helpers, and empty handler files.
- Define route names, runtime env names, and error response conventions.

### Day 4

- Implement `GET /api/jotform/forms` and `GET /api/jotform/forms/{formId}/submissions`.
- Add `VITE_USE_LAMBDA_JOTFORM` handling inside the JotForm seam.
- Validate JotForm with the flag off first, then on.

### Day 5

- Stabilize JotForm Lambda behavior.
- Compare result shapes and error behavior against the current direct service.

### Day 6

- Implement `GET /api/airtable/listings` with allowlist validation.
- Add `VITE_USE_LAMBDA_AIRTABLE` handling inside the Airtable seam.
- Validate list-loading screens with the flag off first, then on.

### Day 7

- Stabilize Airtable Lambda behavior.
- Verify dashboard, directory-adjacent reads, and listing-dependent screens still behave the same.

### Exit criteria

- JotForm and Airtable listing reads can each run in direct mode or Lambda mode independently.
- The rerouted hooks do not need further import changes for the migration to continue.
- No UI component branches on migration flags.
- Provider-facing service modules remain available only as fallback implementations behind the seam.

## Verification

1. After the seam is introduced, prove it is a no-op abstraction by running the current frontend with unchanged behavior.
2. For each migrated integration, run local tests and targeted manual checks with the feature flag on and off, then run `npm run build`.
3. For each Lambda route, compare response shape and key error cases against the current browser service implementation before switching the frontend default.
4. For Airtable and later write paths, validate create, update, retry, and partial-failure behavior explicitly with staging data.
5. Before removing any direct provider code, run at least one release cycle with Lambda as default and the fallback path still available.
6. Before final cleanup, confirm no sensitive third-party credential remains in browser-delivered env vars.

## Key Decisions

- Keep the current frontend hosting path and add API Gateway plus Lambda beside it.
- Preserve current browser session behavior in early phases and redesign eBay or broader session ownership later.
- The first package should avoid a generic Airtable passthrough.
- The first package should avoid changing UI error presentation.
- Because the current TypeScript config scopes do not cover Lambda code, the AWS work should have its own `aws/tsconfig.json`.

## Relevant Files

- `vite.config.ts`
- `src/app/useAppData.ts`
- `src/services/airtable/service.ts`
- `src/services/inventoryDirectory.ts`
- `src/services/shopify.ts`
- `src/services/ebay/inventory.ts`
- `src/services/ebay/token.ts`
- `src/services/ebay/tokenOAuth.ts`
- `src/services/jotform.ts`
- `src/services/equipmentAI.ts`
- `src/stores/auth/authStorage.ts`
- `src/components/ListingApprovalTab.tsx`
- `src/hooks/useShopifyProducts.ts`
- `src/hooks/useEbayListings.ts`
- `src/hooks/useJotForm.ts`
- `src/hooks/useListings.ts`