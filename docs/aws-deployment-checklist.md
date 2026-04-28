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
- JotForm routes
  - `/api/jotform/forms`
  - `/api/jotform/forms/{formId}/submissions`
- AI route
  - `/api/ai/identify-equipment`
- Gmail route
  - `/api/gmail/send`

## What is not in the current AWS package

- eBay Sell API routes are not currently deployed through this Lambda package.
- Do not plan an `/api/ebay/*` production cutover from this checklist alone.
- eBay publish/listing creation still depends on the current browser-side/token-side setup until a later migration package adds eBay Lambda routes.
- eBay approval data can still participate in the staged cutover below because those screens save through the deployed Airtable configured-record routes rather than dedicated `/api/ebay/*` routes.

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

You do not need DynamoDB for the current package unless you are also taking on a later eBay/session redesign.

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

For deployed usage, enable the Lambda seams you want live:

```env
VITE_USE_LAMBDA_AIRTABLE=true
VITE_USE_LAMBDA_SHOPIFY=true
VITE_USE_LAMBDA_JOTFORM=true
```

Optional:

```env
VITE_USE_LAMBDA_AI=true
VITE_USE_LAMBDA_GMAIL=true
```

For deployed environments, `VITE_APP_API_PROXY_TARGET` is not needed.

## Recommended cutover order

### Phase 1: Airtable only

- Set `VITE_USE_LAMBDA_AIRTABLE=true`
- Keep the others off if you want a narrower first production cutover
- Validate core reads/writes and approval screens

Current validated scope:

- inventory directory and record editor loads
- JotForm list/detail reads
- Shopify approval Airtable-backed reads and saves
- eBay approval Airtable-backed reads and save/revert flows

### Phase 2: Shopify

- Set `VITE_USE_LAMBDA_SHOPIFY=true`
- Validate product reads, category resolution, publish flow, and image upload
- Do not treat `fileCreate` permission errors as Lambda failures

Current validated scope:

- Shopify approval exact request preview
- Shopify draft/product-set request shaping
- deployed Shopify approval reads

Open blocker before calling this fully complete:

- `/api/shopify/images` still depends on Shopify admin scopes and create-files permission outside AWS

### Phase 3: JotForm

- Set `VITE_USE_LAMBDA_JOTFORM=true`

Current validated scope:

- JotForm list and detail expansion through the deployed AWS endpoint

### Phase 4: Optional AI and Gmail

- Turn on only if you have configured those provider secrets in AWS

## Current staged cutover status

These cutovers can be completed now with the currently deployed stack and frontend flags:

- `VITE_USE_LAMBDA_AIRTABLE=true`
  - ready for inventory, JotForm-backed Airtable reads, Shopify approval Airtable reads/saves, and eBay approval Airtable reads/saves
- `VITE_USE_LAMBDA_JOTFORM=true`
  - ready for deployed JotForm list/detail reads
- `VITE_USE_LAMBDA_SHOPIFY=true`
  - ready for deployed Shopify read and request-build flows, with image upload still blocked by Shopify admin permissions rather than Lambda deployment

These cutovers are not complete yet:

- full eBay publish/API cutover, because the SAM package still does not provide `/api/ebay/*` server routes
- Shopify image-upload completion, until the Shopify app token and acting user have the required file/image permissions

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

Recommended storage model for this repo right now:

- keep real deploy values in local ignored `aws/samconfig.toml`
- pass secrets to SAM as direct `NoEcho` parameters during deploy
- avoid entering Lambda environment variables manually in the AWS console

Bootstrap helpers:

- [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example)
- [scripts/prepare-aws-samconfig.mjs](/Users/user/Sites/airtable-shopify-ebay/scripts/prepare-aws-samconfig.mjs)

## Current best next step

1. Keep `VITE_USE_LAMBDA_AIRTABLE=true` for inventory and approval data flows.
2. Keep `VITE_USE_LAMBDA_JOTFORM=true` for JotForm list/detail flows.
3. Keep `VITE_USE_LAMBDA_SHOPIFY=true` for deployed Shopify reads and request-build flows.
4. Fix Shopify admin file/image permissions before calling Shopify image upload complete.
5. Do not claim eBay publish cutover yet, because `/api/ebay/*` routes are still outside the current SAM package.