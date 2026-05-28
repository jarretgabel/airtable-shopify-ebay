# AWS Package 1

This package contains the first Lambda-backed routes for the strangler migration described in `docs/migrations/aws-lambda-migration-plan.md`.

## Included routes

- Airtable listing reads, configured source reads/writes, metadata, and attachment uploads
- JotForm forms and submissions
- Shopify product, collection, taxonomy, mutation, and image routes
- AI identify route
- Gmail send route
- Google Drive workflow image archiving on Airtable attachment uploads

## Local workflow

1. Copy `env.local.json.example` to `env.local.json` and fill in real values.
2. Run `npm install` inside `aws/`. This installs `esbuild`, which SAM uses for local Node bundling.
3. Run `sam build --template-file template.yaml`.
4. Run `sam local start-api --template-file template.yaml --env-vars env.local.json --port 3001`.

## No-Docker local workflow

If you only need local `/api/*` validation and do not need Lambda container emulation, you can start a lightweight Node adapter from the repo root instead:

```bash
npm run local:api
```

This builds the AWS TypeScript output, injects the same env vars used by the handlers, and serves the AWS routes directly on `http://127.0.0.1:3001`.

For Google Drive workflow image archiving in the no-Docker adapter, a plain Google API key is not enough. Use `VITE_GOOGLE_DRIVE_CLIENT_ID`, `VITE_GOOGLE_DRIVE_CLIENT_SECRET`, and `VITE_GOOGLE_DRIVE_REFRESH_TOKEN` in the repo root `.env.local`, plus `VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID` for the target personal Drive folder. Run `npm run google-drive:authorize` once to mint the refresh token, then `npm run google-drive:check` to verify real file upload/delete access before using the UI.

Before parity checks or write probes, verify the adapter explicitly:

```bash
npm run local:api:check
```

Canonical health endpoint:

```bash
curl -sSf http://127.0.0.1:3001/health
```

For split-origin validation, point the frontend at the local API with `VITE_APP_API_BASE_URL=http://127.0.0.1:3001` and enable one migration flag at a time.

For same-origin validation during `vite` development, leave `VITE_APP_API_BASE_URL=` blank and set `VITE_APP_API_PROXY_TARGET=http://127.0.0.1:3001` in the root `.env.local` so `/api/*` requests are proxied by Vite.

From the repo root, run `npm run local:api:check` first, then `npm run compare:lambda` to compare direct provider responses against the local endpoints after either `sam local start-api` or `npm run local:api` is up.

For guarded mutation checks against the no-Docker local API, use:

```bash
npm run local:api:check
npm run probe:lambda:writes
npm run probe:lambda:shopify
```

Both probes are opt-in and require explicit env vars before any write is attempted.

`sam local start-api` requires a container runtime such as Docker or Finch to be installed and running.

If SAM local is unavailable, you can still validate the handler behavior from the repo root by running `npm run prepare:aws:env` followed by `npm run compare:lambda:handler`.