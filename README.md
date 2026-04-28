# Airtable-Shopify-eBay Sync

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
  - Copy `.env.example` to `.env.local`, then fill in your credentials:
    - `VITE_AIRTABLE_API_KEY`: Your Airtable personal access token for the local API adapter
    - `VITE_AIRTABLE_BASE_ID`: Your Airtable base ID for the local API adapter
  - `VITE_AIRTABLE_USERS_TABLE_REF` or `VITE_AIRTABLE_USERS_TABLE_NAME`: Airtable users table (auth source)

3. Run setup doctor (recommended for onboarding):
```bash
npm run onboard
```
This verifies required env variables and reports optional integrations.

4. Running the app:
```bash
npm run dev
```

This will start a development server on `http://localhost:3000`

For local AWS validation you can keep the frontend on same-origin `/api` paths by setting `VITE_APP_API_PROXY_TARGET=http://127.0.0.1:3001` in `.env.local` while leaving `VITE_APP_API_BASE_URL=` blank.

No-Docker local API option:

```bash
npm run local:api
```

This starts a local Node server on `http://127.0.0.1:3001` that mounts the compiled AWS handlers directly, without `sam local` or Docker.

One-command local frontend + API workflow:

```bash
npm run dev:full
```

This starts `local:api` first and then starts Vite after the local API is listening.
If `http://127.0.0.1:3001` is already in use by an existing local API instance, `dev:full` reuses it and starts only Vite.

AI, Gmail, JotForm, Shopify, and Airtable browser-direct runtime access has been removed.

- Use the Lambda `/api/*` routes for those integrations in local and deployed workflows.
- Local development should run `npm run local:api` or `npm run dev:full` so the frontend can talk to the backend seam.

After starting either `sam local start-api` or `npm run local:api`, run this comparison harness from the repo root to compare backend provider behavior against the local `/api` responses, including `users`, `inventory-directory`, and approval Airtable sources when those env vars are configured:
```bash
npm run compare:lambda
```

If `sam` or Docker are not installed, use the in-process fallback instead:
```bash
npm run prepare:aws:env
npm run compare:lambda:handler
```

Opt-in write probe for the local API:
```bash
npm run probe:lambda:writes
```

Opt-in Shopify mutation probe for the local API:
```bash
npm run probe:lambda:shopify
```

Cleanup helper for scratch Shopify probe products:
```bash
npm run cleanup:shopify:probe -- <productId>
```

Write validation checklist:

- [AWS Lambda Write Validation](./docs/migrations/aws-lambda-write-validation.md)
- [Remaining Backend Cutover Checklist](./docs/migrations/backend-cutover-checklist.md)

## Getting Your Airtable Credentials

1. **API Key**: Visit [Airtable Account](https://airtable.com/account/tokens) to generate a personal access token
2. **Base ID**: Found in your Airtable base URL: `https://airtable.com/app{BASE_ID}/...`

## Auth + Welcome Email Env Vars

These variables control user login storage in Airtable and new-user welcome email delivery.

Required for Airtable-backed auth:

- `VITE_AIRTABLE_API_KEY`
- `VITE_AIRTABLE_BASE_ID`
- one of:
  - `VITE_AIRTABLE_USERS_TABLE_REF` (preferred, supports table id like `tbl...`)
  - `VITE_AIRTABLE_USERS_TABLE_NAME`

Optional for automatic Gmail delivery (fallback is mail draft):

- `VITE_GOOGLE_GMAIL_ACCESS_TOKEN`
- `VITE_GOOGLE_GMAIL_FROM_EMAIL`

Behavior:

- When Gmail vars are configured and valid, welcome emails are sent via Gmail API.
- If Gmail vars are missing or invalid, the app falls back to opening a prefilled email draft.

## Project Structure

- `src/services/app-api/airtable.ts` - frontend Airtable app-api client
- `src/services/app-api/shopify.ts` - frontend Shopify app-api client
- `src/hooks/useListings.ts` - React hook to fetch listings
- `src/types/airtable.ts` - TypeScript types for Airtable records
- `src/App.tsx` - Main application component

## Workflow Analytics (Operator Events)

The app now emits operator workflow events (tab views, refresh, exports, and approval actions).

- Local buffer: events are stored in browser localStorage under `workflow_analytics_events`
- Optional server-side forwarder: set `ANALYTICS_FORWARD_ENDPOINT=https://your-endpoint/events` to have the Lambda analytics endpoint forward workflow events upstream
- Kill switch: set `VITE_ANALYTICS_ENABLED=false` to disable analytics

## Local Lambda Adapter

Use the no-Docker local adapter for `/api/*` Lambda validation:

- Start it with `npm run local:api`
- Check readiness with `npm run local:api:check`
- Direct health endpoint: `GET /health`

## Inventory Processing Forms

The app includes three local Airtable-backed forms under the `Inventory Processing` menu:

- `Incoming Gear` at `/incoming-gear`
- `Testing` at `/testing`
- `Photos` at `/photos`

Form documentation:

- [Inventory Processing Forms Overview](./docs/forms/README.md)
- [Incoming Gear Instructions](./docs/forms/incoming-gear.instructions.md)
- [Testing Instructions](./docs/forms/testing.instructions.md)
- [Photos Instructions](./docs/forms/photos.instructions.md)

Optional incoming gear source-link env vars:

- `VITE_AIRTABLE_INCOMING_GEAR_FORM_URL`
- `VITE_AIRTABLE_INCOMING_GEAR_FORM_EMBED_URL`

## Performance Notes

Large approval queues use deferred search input and precomputed sort/filter values to reduce render work on heavy screens.
