# CloudFront + S3 Frontend Hosting

This app is a static Vite SPA. The recommended AWS frontend deployment is:

- Amazon S3 for static assets
- Amazon CloudFront for CDN, TLS, and SPA rewrites
- A second CloudFront origin for `/api/*` requests to your backend

## Recommended Topology

- `/*` -> S3 origin
- `/assets/*` -> S3 origin with long cache TTL
- `/runtime-config.json` -> S3 origin with no-cache policy
- `/api/*` -> API origin (API Gateway, ALB, or other HTTP backend)

This keeps the frontend and backend on one domain and avoids production CORS drift.

## Why This Repo Now Supports Runtime Config

The app now loads public deployment settings from `/runtime-config.json` before React mounts.

Primary implementation points:

- `public/runtime-config.json`
- `src/config/runtimeConfig.ts`
- `src/config/runtimeEnv.ts`
- `src/main.tsx`

That means you can:

1. Build the app once.
2. Promote the same static bundle between environments.
3. Change only `runtime-config.json` per environment.

## Safe vs Unsafe Config

Only put public browser-safe values in `runtime-config.json`.

Safe examples:

- `VITE_APP_API_BASE_URL`
- `VITE_SHOPIFY_STORE_DOMAIN`
- public Airtable table ids/names used by the frontend
- `VITE_ANALYTICS_ENABLED`

Local-only or backend-only examples that do not belong in frontend deployment config:

- `VITE_AIRTABLE_API_KEY`
- `VITE_AIRTABLE_BASE_ID`
- `VITE_GOOGLE_GMAIL_ACCESS_TOKEN`
- `VITE_GOOGLE_GMAIL_FROM_EMAIL`
- any Shopify private token
- any eBay client secret or refresh token

Never put secrets in `runtime-config.json`, `VITE_*`, or the frontend bundle.

## Deployment Flow

### Option A: Promote One Build Across Environments

1. Run `npm run build`.
2. Upload `dist/` to the S3 bucket.
3. Replace `dist/runtime-config.json` for each environment, or upload an environment-specific file after the rest of the bundle.
4. Invalidate only:
   - `/index.html`
   - `/runtime-config.json`

Because Vite emits hashed assets, you usually do not need to invalidate `/assets/*`.

### Option B: Emit Environment-Ready Artifacts in CI

Run:

```bash
npm run validate:runtime-config
npm run build:cloudfront
```

This validates the checked-in public runtime config examples, builds the app, writes `dist/runtime-config.json` from safe public environment variables, and validates the rendered `dist/runtime-config.json` before upload.

### Option C: Deploy from the Repo with AWS CLI

Run:

```bash
npm run deploy:cloudfront -- --bucket YOUR_BUCKET --distribution-id YOUR_DISTRIBUTION_ID
```

What it does:

- runs `npm run build:cloudfront`
- uploads `dist/assets/*` with immutable cache headers
- uploads `index.html` and `runtime-config.json` with no-cache headers
- optionally creates a CloudFront invalidation for `/`, `/index.html`, and `/runtime-config.json`

Useful flags:

- `--skip-build`
- `--no-invalidate`
- `--runtime-only`
- `--profile`
- `--region`
- `--config`

If you deploy often, copy `cloudfront-frontend.deploy.example.json` to `.cloudfront-frontend.deploy.json` at the repo root and fill in your defaults:

```json
{
  "bucket": "my-frontend-bucket",
  "distributionId": "E123456789ABC",
  "profile": "prod",
  "region": "us-east-1"
}
```

Then you can run:

```bash
npm run deploy:cloudfront
```

CLI flags still override values from the local config file.

Example runtime-only config update:

```bash
npm run deploy:cloudfront -- --bucket YOUR_BUCKET --distribution-id YOUR_DISTRIBUTION_ID --runtime-only
```

This is useful when only `runtime-config.json` changed and the bundle does not need to be replaced.

There is also a convenience script:

```bash
npm run deploy:cloudfront:runtime-only -- --bucket YOUR_BUCKET --distribution-id YOUR_DISTRIBUTION_ID
```

## Named Environment Commands

If you prefer explicit staging and prod commands, this repo now includes a [Makefile](/Users/user/Sites/airtable-shopify-ebay/Makefile) with:

- `make deploy-staging`
- `make deploy-prod`
- `make deploy-staging-runtime`
- `make deploy-prod-runtime`

These targets expect local config files at the repo root:

- `.cloudfront-frontend.staging.deploy.json`
- `.cloudfront-frontend.prod.deploy.json`

Start from the checked-in examples:

- `cloudfront-frontend.staging.deploy.example.json`
- `cloudfront-frontend.prod.deploy.example.json`

Before first deploy, replace these fields in the local files:

- `bucket`
- `distributionId`
- `profile` if needed
- `region` if needed
- `runtimeConfigPath` to point at the environment-specific runtime config file

The deploy flow now runs `scripts/validate-cloudfront-deploy-config.mjs` first and will fail fast if a local file still contains the checked-in placeholder bucket or distribution id values.

When `runtimeConfigPath` is set in the deploy config, the deploy helper builds `dist/runtime-config.json` from that file automatically. That makes `make deploy-staging` and `make deploy-prod` safe to run without manually copying an environment config over `public/runtime-config.json` first.

## CloudFormation Template

This repo now includes a frontend infrastructure template at:

- `aws/deploy/cloudfront-s3-frontend.template.yaml`

It provisions:

- a private versioned S3 bucket
- CloudFront Origin Access Control
- CloudFront distribution
- SPA fallback for `403` and `404` to `index.html`
- cache policies for immutable assets and mutable shell files
- response headers policy with baseline security headers
- optional `/api/*` routing to a backend origin

Template parameters let you supply:

- environment name
- custom domain name
- ACM certificate ARN
- backend API origin domain name
- backend API origin path

## Recommended CloudFront Settings

### Origin Access

Use:

- private S3 bucket
- CloudFront Origin Access Control (OAC)

Avoid public S3 website hosting unless you have a specific reason to use it.

### SPA Routing

Because this app uses browser routing, deep links must return `index.html`.

Recommended approach:

- CloudFront custom error responses:
  - `403` -> `/index.html` with response code `200`
  - `404` -> `/index.html` with response code `200`

This works well with a private S3 bucket behind OAC.

### Cache Policy

Recommended cache behavior:

- `/assets/*`
  - long TTL
  - immutable caching
- `/index.html`
  - `Cache-Control: no-cache, no-store, must-revalidate`
- `/runtime-config.json`
  - `Cache-Control: no-cache, no-store, must-revalidate`

If you upload with AWS CLI, set metadata explicitly for the mutable files.

Example:

```bash
aws s3 cp dist/index.html s3://YOUR_BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

aws s3 cp dist/runtime-config.json s3://YOUR_BUCKET/runtime-config.json \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "application/json"
```

Upload hashed assets with a long max-age.

### Security Headers

Attach a CloudFront response headers policy with at least:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

Add `Content-Security-Policy` if you are ready to validate all outbound and inline requirements.

## Backend Routing Recommendation

Prefer same-origin API routing:

- frontend: `https://app.example.com`
- backend routes: `https://app.example.com/api/*`

If you do this, keep `VITE_APP_API_BASE_URL` empty in `runtime-config.json`.

## Runtime Config Example

Example production `runtime-config.json`:

```json
{
  "VITE_APP_API_BASE_URL": "",
  "VITE_SHOPIFY_STORE_DOMAIN": "store.example.com",
  "VITE_AIRTABLE_TABLE_NAME": "tblExample",
  "VITE_AIRTABLE_APPROVAL_TABLE_REF": "appExample/viwExample",
  "VITE_AIRTABLE_APPROVAL_TABLE_NAME": "tblApproval",
  "VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF": "appExample/viwShopify",
  "VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME": "tblShopifyApproval",
  "VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME": "tblCombined",
  "VITE_ANALYTICS_ENABLED": "true",
  "VITE_AI_PROVIDER": "none"
}
```

Checked-in example files you can adapt:

- `public/runtime-config.staging.example.json`
- `public/runtime-config.prod.example.json`

## Validation Checklist

- `npm run build` succeeds
- `npm run build:cloudfront` succeeds
- opening a deep link returns the SPA, not S3 XML errors
- `/api/*` requests reach the backend origin through CloudFront
- `runtime-config.json` is not cached aggressively
- no secrets appear in `runtime-config.json` or the built JS bundle
