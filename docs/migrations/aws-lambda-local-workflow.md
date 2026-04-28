# AWS Lambda Local Workflow

## Purpose

This document defines the current local development workflow now that Airtable, Shopify, JotForm, eBay, auth, AI, Gmail, and HiFiShark all route through the backend `/api/*` seam.

## Recommended Local Topology

Use one of these supported local topologies:

- Vite on `http://localhost:3000` plus the no-Docker local API on `http://127.0.0.1:3001`
- Vite on `http://localhost:3000` plus `sam local start-api` on `http://127.0.0.1:3001`
- `npm run dev:full` to start the local API first and then Vite

Recommended frontend routing:

- keep `VITE_APP_API_BASE_URL=` blank when using same-origin `/api/*` requests through Vite
- set `VITE_APP_API_PROXY_TARGET=http://127.0.0.1:3001` so Vite forwards `/api/*` to the local backend

Alternative split-origin routing:

- set `VITE_APP_API_BASE_URL=http://127.0.0.1:3001`
- leave `VITE_APP_API_PROXY_TARGET` blank

## Local Env Model

The root `.env.local` still contains provider credentials for local development, but those values now feed the backend runtime instead of browser-direct service calls.

Current behavior:

- `npm run local:api` reads root `.env` and `.env.local`
- it maps the `VITE_*` provider variables into backend environment variables before loading the Lambda handlers
- the browser calls only `/api/*` routes for Airtable, Shopify, JotForm, eBay, auth, AI, Gmail, and HiFiShark
- auth session state is carried by the backend `lcc_session` httpOnly cookie rather than frontend localStorage
- the local adapter defaults `APP_AUTH_COOKIE_SECURE_MODE=never` so cookie auth works on plain `http://127.0.0.1:*`

## Command Workflow

### Step 1: validate the frontend build

From the repo root:

```bash
npm run typecheck
npm run build
```

Expected result:

- the frontend compiles with the current app-api seam

### Step 2: validate the AWS package compiles

From `aws/`:

```bash
npm run typecheck
npm run build
```

Expected result:

- the Lambda package is valid for local execution and deployment

### Step 3: start the local API

Option A: no-Docker Node adapter

From the repo root:

```bash
npm run local:api
```

Expected result:

- local routes are reachable at `http://127.0.0.1:3001`
- AWS handlers run in-process without Docker

Option B: one-command local frontend plus API

From the repo root:

```bash
npm run dev:full
```

Expected result:

- the local API starts first on `http://127.0.0.1:3001`
- Vite starts after the API is listening
- same-origin `/api/*` requests can be proxied through Vite with `VITE_APP_API_PROXY_TARGET=http://127.0.0.1:3001`

Option C: SAM local

From `aws/`:

```bash
cp env.local.json.example env.local.json
sam local start-api --template-file template.yaml --env-vars env.local.json --port 3001
```

Expected result:

- local routes are reachable at `http://127.0.0.1:3001`

### Step 4: compare provider behavior against the local API

From the repo root:

```bash
npm run compare:lambda
```

Expected result:

- Airtable, Shopify, JotForm, eBay, and configured approval sources match the local backend responses where comparison coverage exists

Alternative when `sam local` or Docker is unavailable:

```bash
npm run prepare:aws:env
npm run compare:lambda:handler
```

### Step 5: probe write routes safely

Use these only when you want explicit smoke tests against the local `/api/*` server.

From the repo root:

```bash
npm run probe:lambda:writes
npm run probe:lambda:shopify
npm run probe:lambda:ebay
```

Expected result:

- temporary test records/listings are created through the backend seam
- cleanup scripts can remove probe artifacts when needed

See [aws-lambda-write-validation.md](/Users/user/Sites/airtable-shopify-ebay/docs/migrations/aws-lambda-write-validation.md) for the required env vars and exact validation flows.

## Manual Validation Checklist

- dashboard loads
- listing-dependent screens load
- JotForm inquiries load and poll correctly
- approval flows save through `/api/airtable/*`
- Shopify publish helpers and image upload route hit `/api/shopify/*`
- eBay inventory, taxonomy, image, and publish flows hit `/api/ebay/*`
- auth and user-management flows hit `/api/auth/*`
- HiFiShark model lookups hit `/api/hifishark/*`