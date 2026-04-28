# AWS Lambda Local Workflow

## Purpose

This document defines the recommended local development and validation workflow for Package 1. The goal is to let the frontend and the first Lambda routes coexist locally without changing the production architecture decisions.

## Recommended Local Topology

Use a split local topology for Package 1:

- Vite frontend on `http://localhost:3000`
- local API on `http://127.0.0.1:3001` via either SAM or the no-Docker Node adapter
- frontend configured with `VITE_APP_API_BASE_URL=http://127.0.0.1:3001`

Reason:

- production should prefer same-origin routing where possible
- local development is simpler if the frontend can target the local API directly without adding a second proxy layer to Vite

## Package 1 Runtime Modes

### Mode A: direct-only seam validation

Use this first.

- `VITE_USE_LAMBDA_JOTFORM=false`
- `VITE_USE_LAMBDA_AIRTABLE=false`
- `VITE_APP_API_BASE_URL=`

Purpose:

- prove that the seam wrappers are a no-op abstraction
- validate hook reroutes without any AWS dependency

### Mode B: JotForm Lambda validation

- `VITE_USE_LAMBDA_JOTFORM=true`
- `VITE_USE_LAMBDA_AIRTABLE=false`
- `VITE_APP_API_BASE_URL=http://127.0.0.1:3001`

Purpose:

- validate only the JotForm Lambda path while Airtable still uses the direct path

### Mode C: Airtable Lambda validation

- `VITE_USE_LAMBDA_JOTFORM=false`
- `VITE_USE_LAMBDA_AIRTABLE=true`
- `VITE_APP_API_BASE_URL=http://127.0.0.1:3001`

Purpose:

- validate only the Airtable listing-read Lambda path while JotForm still uses the direct path

### Mode D: dual Lambda validation

- `VITE_USE_LAMBDA_JOTFORM=true`
- `VITE_USE_LAMBDA_AIRTABLE=true`
- `VITE_APP_API_BASE_URL=http://127.0.0.1:3001`

Purpose:

- validate that both wrappers can run in Lambda mode independently at the same time

## Recommended Local Files

### Frontend env example additions

Add these to `.env.example` when implementation starts:

```env
VITE_USE_LAMBDA_JOTFORM=false
VITE_USE_LAMBDA_AIRTABLE=false
VITE_APP_API_BASE_URL=
VITE_APP_API_PROXY_TARGET=http://127.0.0.1:3001
```

Notes:

- Use `VITE_APP_API_BASE_URL` for split-origin local validation.
- Use `VITE_APP_API_PROXY_TARGET` to keep the browser on same-origin `/api/*` paths while Vite proxies to SAM.

### AWS env example

Create `aws/env.local.json.example` with this shape:

```json
{
  "JotformGetFormsFunction": {
    "JOTFORM_API_KEY": "replace-me"
  },
  "JotformGetFormSubmissionsFunction": {
    "JOTFORM_API_KEY": "replace-me"
  },
  "AirtableGetListingsFunction": {
    "AIRTABLE_API_KEY": "replace-me",
    "AIRTABLE_BASE_ID": "replace-me",
    "ALLOWED_AIRTABLE_TABLE_NAME": "replace-me",
    "ALLOWED_AIRTABLE_VIEW_ID": "replace-me"
  }
}
```

## Command Workflow

### Step 1: validate the seam without AWS

From the repo root:

```bash
npm run build
npm run test
```

Expected result:

- the app still behaves the same with both Lambda flags off

### Step 2: validate the AWS package compiles

From `aws/`:

```bash
npm install
sam build --template-file template.yaml
```

Expected result:

- the Lambda package structure is valid enough for local execution

### Step 3: start the local API

Option A: SAM local

From `aws/`:

```bash
cp env.local.json.example env.local.json
sam local start-api --template-file template.yaml --env-vars env.local.json --port 3001
```

Expected result:

- local routes are reachable at `http://127.0.0.1:3001`

Option B: no-Docker Node adapter

From the repo root:

```bash
npm run local:api
```

Expected result:

- local routes are reachable at `http://127.0.0.1:3001`
- AWS handlers run in-process without Docker

Option C: one-command local frontend plus API

From the repo root:

```bash
npm run dev:full
```

Expected result:

- the local API starts first on `http://127.0.0.1:3001`
- Vite starts after the API is listening
- same-origin `/api/*` requests can be proxied through Vite with `VITE_APP_API_PROXY_TARGET=http://127.0.0.1:3001`

If port `3001` is already serving an existing local API instance, `npm run dev:full` should reuse it and start only Vite.

### Step 4: run the frontend against local Lambda

From the repo root:

```bash
npm run dev
```

Use one of the runtime modes above to switch integrations independently.

### Step 5: compare direct and local API responses

From the repo root:

```bash
npm run compare:lambda
```

Expected result:

- JotForm forms, JotForm submissions, and Airtable listings report matching counts, required keys, and sample ids
- users and inventory-directory Airtable sources also match when configured locally
- approval Airtable sources also match when their env vars are configured locally

### Step 5 alternative: compare handlers without SAM

Use this when `sam local` or Docker is unavailable on the machine.

From the repo root:

```bash
npm run prepare:aws:env
npm run compare:lambda:handler
```

Expected result:

- the generated `aws/env.local.json` contains the Package 1 runtime values derived from `.env.local`
- the in-process Lambda handlers match the direct provider responses on shape, counts, and sample ids

### Step 6: probe write routes safely

Use this only when you want an explicit write-path smoke test against the local `/api/*` server.

From the repo root:

```bash
npm run probe:lambda:writes
```

Expected result:

- a temporary Airtable row is created
- the row is updated
- optional attachment upload succeeds
- the row is deleted during normal completion or cleanup

See [aws-lambda-write-validation.md](./aws-lambda-write-validation.md) for the required env vars and the exact UI flows to validate.

## Manual Validation Checklist

### Milestone 1: seam only

- dashboard loads
- listing-dependent screens load
- JotForm inquiries load
- no UI component changes are required
- `npm run build` passes

### Milestone 3: JotForm Lambda

- forms list loads through Lambda
- submissions list loads through Lambda
- polling still updates inquiry results
- error handling still surfaces as the current hooks expect
- switching the JotForm flag off returns the app to the direct path

### Milestone 4: Airtable Lambda

- dashboard Airtable data loads through Lambda
- non-empty listing derivation still behaves the same
- unsupported table or view values are rejected server-side
- switching the Airtable flag off returns the app to the direct path

## Comparison Checks

Before enabling Lambda mode by default for either integration, compare:

- success payload shape
- empty-state behavior
- error message text exposed to the hook layer
- loading and retry behavior

Package 1 should treat shape compatibility as more important than elegance.

## Recommended Defaults

If no stronger constraint exists, use these defaults:

- same-origin in production
- direct SAM API host in local development
- `sam local start-api` as the first local validation tool
- root `npm run build` as the required seam-regression check after every meaningful frontend change

## Exit Signals For Moving Past Planning

Planning is sufficiently complete when all of the following are true:

1. the Package 1 file set is fixed
2. the local workflow is fixed
3. the first Airtable allowlist is fixed
4. the team has chosen SAM versus SST and a secret source

At that point, the next step should be implementation, starting with Milestone 1.