# AWS Deployment Checklist

This checklist covers the next step after local Lambda validation: deploying the current `aws/` package to a real AWS Lambda + API Gateway environment and wiring the frontend to it.

For the operator-style deployment sequence, example `sam deploy --guided` answers, env matrices, and reusable SAM config, use [docs/aws-sam-deploy-runbook.md](/Users/user/Sites/airtable-shopify-ebay/docs/aws-sam-deploy-runbook.md).

## What the current AWS package includes

Defined in [aws/template.yaml](/Users/user/Sites/airtable-shopify-ebay/aws/template.yaml):

- Airtable routes
  - `/api/airtable/listings`
  - `/api/airtable/configured-records`
  - `/api/airtable/configured-metadata`
  - `/api/airtable/configured-records/{source}`
  - `/api/airtable/configured-records/{source}/{recordId}`
  - `/api/airtable/configured-attachments/{source}/{recordId}/{fieldId}`
- Shopify routes
  - `/api/shopify/products`
  - `/api/shopify/products/{productId}`
  - `/api/shopify/collections`
  - `/api/shopify/collections/search`
  - `/api/shopify/taxonomy-categories/search`
  - `/api/shopify/taxonomy-categories/resolve`
  - `/api/shopify/product-set`
  - `/api/shopify/product-set-with-collections`
  - `/api/shopify/products/{productId}/collections`
  - `/api/shopify/products/{productId}/category`
  - `/api/shopify/images`
- eBay routes
  - `/api/ebay/inventory-items`
  - `/api/ebay/offers`
  - `/api/ebay/offers/{offerId}`
  - `/api/ebay/offers/by-skus`
  - `/api/ebay/taxonomy/suggestions`
  - `/api/ebay/taxonomy/root-categories`
  - `/api/ebay/taxonomy/child-categories`
  - `/api/ebay/package-types`
  - `/api/ebay/runtime-config`
  - `/api/ebay/dashboard-snapshot`
  - `/api/ebay/sample-listings`
  - `/api/ebay/sample-listings/publish`
  - `/api/ebay/approval-listings/publish`
  - `/api/ebay/images`
- JotForm routes
  - `/api/jotform/forms`
  - `/api/jotform/forms/{formId}/submissions`
- AI route
  - `/api/ai/identify-equipment`
- Gmail route
  - `/api/gmail/send`
- Auth routes
  - `/api/auth/login`
  - `/api/auth/session`
  - `/api/auth/password-reset/request`
  - `/api/auth/password-reset/confirm`
  - `/api/auth/email-change/request`
  - `/api/auth/email-change/confirm`
  - `/api/auth/password/change`
- HiFiShark route
  - `/api/hifishark/model/{slug}`

## What is still not in the current AWS package

- eBay business policy discovery is still manual. Policy IDs must be supplied through deploy-time Lambda config.
- Scratch eBay probe cleanup is still manual. Probe-created offers and listings are not auto-deleted.
- Approval record persistence still uses the Airtable configured-record routes; only the final eBay publish/image steps moved to dedicated eBay routes.

## Required AWS-side runtime secrets and config

The current Lambda code expects plain environment variables with these names.

### Required for Airtable routes

- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `ALLOWED_AIRTABLE_TABLE_NAME`
- `ALLOWED_AIRTABLE_VIEW_ID`

Configured Airtable-source routes also need:

- `AIRTABLE_USERS_TABLE_REF`
- `AIRTABLE_USERS_TABLE_NAME`
- `AIRTABLE_APPROVAL_TABLE_REF`
- `AIRTABLE_APPROVAL_TABLE_NAME`
- `AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF`
- `AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME`
- `AIRTABLE_COMBINED_LISTINGS_TABLE_REF`
- `AIRTABLE_COMBINED_LISTINGS_TABLE_NAME`

### Required for Shopify routes

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ACCESS_TOKEN`

Important external dependency:

- For `/api/shopify/images`, the Shopify app token must include one of:
  - `write_files`
  - `write_images`
  - `write_themes`
- And the acting Shopify user must have create-files permission.

### Required for eBay routes

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN`
- `EBAY_LOCATION_KEY`
- `EBAY_FULFILLMENT_POLICY_ID`
- `EBAY_PAYMENT_POLICY_ID`
- `EBAY_RETURN_POLICY_ID`

Optional overrides:

- `EBAY_ENV`
- `EBAY_AUTH_HOST`
- `EBAY_APP_SCOPE`
- `EBAY_LOCATION_NAME`
- `EBAY_LOCATION_COUNTRY`
- `EBAY_LOCATION_POSTAL_CODE`
- `EBAY_LOCATION_CITY`
- `EBAY_LOCATION_STATE`
- `EBAY_LISTING_API`

### Required for JotForm routes

- `JOTFORM_API_KEY`

### Optional for AI route

At least one of:

- `GITHUB_TOKEN`
- `OPENAI_API_KEY`

### Optional for Gmail route

- `GOOGLE_GMAIL_ACCESS_TOKEN`
- `GOOGLE_GMAIL_FROM_EMAIL`

## Source-of-truth mapping from frontend env to AWS runtime env

Use this mapping when moving from `.env.local` to deployed Lambda configuration.

### Airtable

- `VITE_AIRTABLE_API_KEY` -> `AIRTABLE_API_KEY`
- `VITE_AIRTABLE_BASE_ID` -> `AIRTABLE_BASE_ID`
- `VITE_AIRTABLE_TABLE_NAME` -> `ALLOWED_AIRTABLE_TABLE_NAME`
- `VITE_AIRTABLE_VIEW_ID` -> `ALLOWED_AIRTABLE_VIEW_ID`
- `VITE_AIRTABLE_USERS_TABLE_REF` -> `AIRTABLE_USERS_TABLE_REF`
- `VITE_AIRTABLE_USERS_TABLE_NAME` -> `AIRTABLE_USERS_TABLE_NAME`
- `VITE_AIRTABLE_APPROVAL_TABLE_REF` -> `AIRTABLE_APPROVAL_TABLE_REF`
- `VITE_AIRTABLE_APPROVAL_TABLE_NAME` -> `AIRTABLE_APPROVAL_TABLE_NAME`
- `VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF` -> `AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF`
- `VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME` -> `AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME`
- `VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF` -> `AIRTABLE_COMBINED_LISTINGS_TABLE_REF`
- `VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME` -> `AIRTABLE_COMBINED_LISTINGS_TABLE_NAME`

### Shopify

- `VITE_SHOPIFY_STORE_DOMAIN` -> `SHOPIFY_STORE_DOMAIN`
- `VITE_SHOPIFY_OAUTH_ACCESS_TOKEN` or `VITE_SHOPIFY_ADMIN_API_TOKEN` -> `SHOPIFY_ACCESS_TOKEN`

### eBay

- `VITE_EBAY_ENV` -> `EBAY_ENV`
- `VITE_EBAY_CLIENT_ID` -> `EBAY_CLIENT_ID`
- `VITE_EBAY_CLIENT_SECRET` -> `EBAY_CLIENT_SECRET`
- `VITE_EBAY_REFRESH_TOKEN` -> `EBAY_REFRESH_TOKEN`
- `VITE_EBAY_AUTH_HOST` -> `EBAY_AUTH_HOST`
- `VITE_EBAY_APP_SCOPE` -> `EBAY_APP_SCOPE`
- `VITE_EBAY_LOCATION_KEY` -> `EBAY_LOCATION_KEY`
- `VITE_EBAY_LOCATION_NAME` -> `EBAY_LOCATION_NAME`
- `VITE_EBAY_LOCATION_COUNTRY` -> `EBAY_LOCATION_COUNTRY`
- `VITE_EBAY_LOCATION_POSTAL_CODE` -> `EBAY_LOCATION_POSTAL_CODE`
- `VITE_EBAY_LOCATION_CITY` -> `EBAY_LOCATION_CITY`
- `VITE_EBAY_LOCATION_STATE` -> `EBAY_LOCATION_STATE`
- `VITE_EBAY_FULFILLMENT_POLICY_ID` -> `EBAY_FULFILLMENT_POLICY_ID`
- `VITE_EBAY_PAYMENT_POLICY_ID` -> `EBAY_PAYMENT_POLICY_ID`
- `VITE_EBAY_RETURN_POLICY_ID` -> `EBAY_RETURN_POLICY_ID`
- `VITE_EBAY_LISTING_API` -> `EBAY_LISTING_API`

### JotForm

- `VITE_JOTFORM_API_KEY` -> `JOTFORM_API_KEY`

### AI

- `VITE_GITHUB_TOKEN` -> `GITHUB_TOKEN`
- `VITE_OPENAI_API_KEY` -> `OPENAI_API_KEY`

### Gmail

- `VITE_GOOGLE_GMAIL_ACCESS_TOKEN` -> `GOOGLE_GMAIL_ACCESS_TOKEN`
- `VITE_GOOGLE_GMAIL_FROM_EMAIL` -> `GOOGLE_GMAIL_FROM_EMAIL`

## Recommended AWS services

Use:

- AWS Lambda
- API Gateway HTTP API
- AWS Systems Manager Parameter Store `SecureString` for secrets
- CloudWatch Logs for handler logs

You do not need DynamoDB for the current package.

## Deployment steps

### 1. Prepare the AWS package locally

From [aws](/Users/user/Sites/airtable-shopify-ebay/aws):

```bash
npm install
sam build --template-file template.yaml
```

### 2. Choose how secrets are supplied

Preferred:

- Store secrets in Secrets Manager or SSM Parameter Store.
- Inject them into each Lambda function as environment variables during deployment.

Minimum acceptable first pass:

- Use SAM deploy parameter/environment configuration if you need a faster first deployment.

Safer repo workflow:

- copy [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example) to local `aws/samconfig.toml`
- copy [aws/deploy/ssm-setup.example.sh](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/ssm-setup.example.sh) to local `aws/deploy/ssm-setup.sh`
- both local copies are gitignored

Do not:

- rely on frontend `VITE_*` vars in production Lambda runtime
- expose provider secrets to the browser after Lambda cutover

### 3. Deploy the SAM stack

Typical first run from [aws](/Users/user/Sites/airtable-shopify-ebay/aws):

```bash
sam deploy --guided --template-file template.yaml
```

What to capture from deploy:

- stack name
- region
- API Gateway base URL
- any function-specific overrides if you add them

### 4. Record the deployed API base URL

The template output is:

- `AppApiUrl`

That becomes the frontend API base for deployed Lambda calls.

## Frontend env changes after deploy

Update the frontend runtime to point at the deployed API:

```env
VITE_APP_API_BASE_URL=https://your-api-id.execute-api.your-region.amazonaws.com
```

All supported integrations now use the backend `/api/*` seam by default.

- `VITE_APP_API_BASE_URL` is the only frontend routing variable needed for deployed split-origin setups.
- If the frontend and API are served from the same origin, leave `VITE_APP_API_BASE_URL` blank.
- `VITE_APP_API_PROXY_TARGET` is local-development-only and should stay unset in deployed environments.
- AI and Gmail do not require frontend toggles; they become available when their AWS secrets are configured.

## Current runtime status

Backend-routed by default:

- auth/session/password reset/email change
- Airtable reads, writes, metadata, and attachment uploads
- Shopify reads, request shaping, publish helpers, and image upload route
- JotForm list/detail reads
- eBay inventory, taxonomy, publish, image upload, runtime config, and dashboard routes

Backend-routed when AWS provider secrets are configured:

- AI equipment identification
- Gmail delivery

Not yet backend-routed:

- HiFiShark market scraping still goes through the Vite `/hifishark-proxy` developer proxy.
- If that feature needs deployed support, add a dedicated `/api/hifishark/*` route and retire the proxy.

Current validated scope:

- Shopify approval exact request preview
- Shopify draft/product-set request shaping
- deployed Shopify approval reads
- eBay Lambda-backed inventory and publish flows

Open blocker before calling this fully complete:

- `/api/shopify/images` still depends on Shopify admin scopes and create-files permission outside AWS

## Current staged cutover status

These surfaces can be completed now with the currently deployed stack:

- Airtable inventory, approvals, metadata, writes, and attachment uploads
- JotForm list/detail reads
- Shopify read and request-build flows, with image upload still blocked only by Shopify admin permissions rather than Lambda deployment
- eBay read, publish, and image routes
- auth/session and account-management routes
  - session transport is now httpOnly cookie based
  - frontend no longer needs browser-managed auth token storage

These cutovers are not complete yet:

- Shopify image-upload completion, until the Shopify app token and acting user have the required file/image permissions
- HiFiShark deployment support, until the proxy-backed scraper is moved behind Lambda

## Validation checklist after deployment

Run:

```bash
npm run compare:lambda
```

Then validate the deployed endpoint behavior with:

```bash
npm run probe:lambda:writes
npm run probe:lambda:shopify
```

UI checks:

- users management
- incoming gear
- testing
- photos
- approval save flows
- Shopify publish flows
- Image Lab Shopify uploads

## Known blocker to resolve before calling Shopify image upload complete

- Shopify app must have file/image write scope.
- Shopify user must have create-files permission.
- Without that, `/api/shopify/images` will fail even if Lambda deployment is correct.

## Practical minimal production secret set

If you want the smallest first deployed cutover, start with:

- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `ALLOWED_AIRTABLE_TABLE_NAME`
- `ALLOWED_AIRTABLE_VIEW_ID`
- all configured Airtable source refs/names used by the app
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ACCESS_TOKEN`
- `JOTFORM_API_KEY`

Add these only if you are deploying those routes now:

- `GITHUB_TOKEN` or `OPENAI_API_KEY`
- `GOOGLE_GMAIL_ACCESS_TOKEN`
- `GOOGLE_GMAIL_FROM_EMAIL`
- eBay secrets and business-policy values for publish/image flows
- `APP_AUTH_TOKEN_SECRET` for auth/session routes
- `APP_AUTH_COOKIE_SECURE_MODE` for auth cookie `Secure` policy: `always`, `never`, or `auto`
- `APP_AUTH_COOKIE_SAME_SITE` for auth cookie `SameSite`: `Lax`, `Strict`, or `None`
- `APP_AUTH_COOKIE_DOMAIN` if deployed auth should scope the session cookie to a shared parent domain

Recommended storage model for this repo right now:

- keep real deploy values in local ignored `aws/samconfig.toml`
- pass secrets to SAM as direct `NoEcho` parameters during deploy
- avoid entering Lambda environment variables manually in the AWS console

Bootstrap helpers:

- [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example)
- [scripts/prepare-aws-samconfig.mjs](/Users/user/Sites/airtable-shopify-ebay/scripts/prepare-aws-samconfig.mjs)

## Current best next step

1. Keep the deployed frontend pointed at the Lambda API with `VITE_APP_API_BASE_URL`.
2. Fix Shopify admin file/image permissions before calling Shopify image upload complete.
3. Decide whether HiFiShark should stay a developer-only proxy flow or move behind Lambda for deployed support.