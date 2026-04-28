# Admin Website Checklist

This file tracks the setup that must be done outside the repo in vendor/admin websites.

Use it as the handoff list for Shopify admin, eBay developer/seller setup, Airtable admin, and optional Gmail/AWS setup.

## Current status

- Airtable Lambda seam is validated locally.
- Shopify runtime calls are already routed through the app-api/Lambda seam.
- Deployed AWS-backed inventory, JotForm, Shopify approval, and eBay approval save/revert flows have been validated.
- eBay publishing still depends on valid seller/developer configuration and is not yet part of the deployed SAM package.
- The current known blocker is Shopify image upload permissions for `/api/shopify/images`.

## Required now

### Shopify admin

Website:

- Shopify Admin

Tasks:

- Confirm the store domain used by the app matches `VITE_SHOPIFY_STORE_DOMAIN`.
- In the Shopify app configuration, grant at least one of these scopes:
  - `write_files`
  - `write_images`
  - `write_themes`
- Confirm the Shopify user who runs uploads has permission to create files.
- Reinstall or reauthorize the app after changing scopes so the new token actually includes them.
- Rerun `npm run probe:lambda:shopify` after the scope change.

Why:

- The current failure is `Access denied for fileCreate field`, which is an external Shopify permission issue, not a Lambda issue.

Optional but useful:

- Create at least one scratch custom collection if you want to validate the real collection-join branch for `product-set-with-collections`.

### eBay developer portal

Website:

- eBay Developer Portal

Tasks:

- Create or confirm the eBay app keys used for:
  - `VITE_EBAY_CLIENT_ID`
  - `VITE_EBAY_CLIENT_SECRET`
- Generate a valid refresh token for the seller account and store it in `VITE_EBAY_REFRESH_TOKEN`.
- Confirm the app is using the correct environment in `VITE_EBAY_ENV`.
- Confirm the Lambda-side publish defaults are available:
  - `VITE_EBAY_LOCATION_KEY`
  - `VITE_EBAY_FULFILLMENT_POLICY_ID`
  - `VITE_EBAY_PAYMENT_POLICY_ID`
  - `VITE_EBAY_RETURN_POLICY_ID`

Required scopes:

- Current default scopes in the app are:
  - `https://api.ebay.com/oauth/api_scope`
  - `https://api.ebay.com/oauth/api_scope/sell.inventory`

Optional but recommended:

- Add Account API scope if you want the app to auto-read business policy IDs instead of entering them manually:
  - `https://api.ebay.com/oauth/api_scope/sell.account`

Why:

- The current UI and local Lambda adapter use a server-owned refresh token and deploy-time publish defaults.
- Account API scope remains optional unless you want future automation to discover business policies dynamically.

### eBay Seller Hub

Website:

- eBay Seller Hub

Tasks:

- Create or confirm these three business policies and copy their IDs into the app env:
  - fulfillment policy -> `VITE_EBAY_FULFILLMENT_POLICY_ID`
  - payment policy -> `VITE_EBAY_PAYMENT_POLICY_ID`
  - return policy -> `VITE_EBAY_RETURN_POLICY_ID`
- Create or confirm the inventory warehouse location values used by published offers:
  - `VITE_EBAY_LOCATION_KEY`
  - `VITE_EBAY_LOCATION_NAME`
  - `VITE_EBAY_LOCATION_COUNTRY`
  - `VITE_EBAY_LOCATION_POSTAL_CODE`
  - `VITE_EBAY_LOCATION_CITY`
  - `VITE_EBAY_LOCATION_STATE`

Notes:

- The app can create the warehouse location through eBay if your token and values are valid.
- The policy IDs still need to be supplied unless you add Account API scope and implement/read that path.

## Core external config

### Airtable admin

Website:

- Airtable account
- Airtable base UI

Tasks:

- Generate or confirm a personal access token for `VITE_AIRTABLE_API_KEY`.
- Confirm the Airtable base id for `VITE_AIRTABLE_BASE_ID`.
- Confirm the primary listings table and view IDs used by:
  - `VITE_AIRTABLE_TABLE_NAME`
  - `VITE_AIRTABLE_VIEW_ID`
- Confirm the approval table references used by:
  - `VITE_AIRTABLE_APPROVAL_TABLE_REF`
  - `VITE_AIRTABLE_APPROVAL_TABLE_NAME`
  - `VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF`
  - `VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME`
  - `VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF`
  - `VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME`
- Confirm the users table used for auth:
  - `VITE_AIRTABLE_USERS_TABLE_REF`
  - `VITE_AIRTABLE_USERS_TABLE_NAME`

Why:

- The local and Lambda Airtable paths depend on these references being correct.

### Gmail admin

Website:

- Google Cloud Console
- Gmail account/admin settings

Tasks:

- Enable Gmail API access for the sending account if you want automatic welcome emails.
- Create or confirm the Gmail access token used by `VITE_GOOGLE_GMAIL_ACCESS_TOKEN`.
- Confirm the sender address used by `VITE_GOOGLE_GMAIL_FROM_EMAIL`.

Skip this section if you are fine with the app falling back to opening a draft email instead of sending automatically.

### AI provider accounts

Websites:

- GitHub account settings
- OpenAI platform

Tasks:

- If using GitHub Models, create or confirm `VITE_GITHUB_TOKEN`.
- If using OpenAI for Image Lab identification, create or confirm `VITE_OPENAI_API_KEY`.

Skip whichever provider you are not using.

## Later, when deploying real AWS Lambdas

Website:

- AWS Console

Tasks:

- Store Airtable, Shopify, eBay, JotForm, Gmail, and AI secrets in Secrets Manager or SSM Parameter Store.
- Configure API Gateway routes for `/api/airtable/*`, `/api/shopify/*`, `/api/ebay/*`, `/api/jotform/*`, and other enabled domains.
- DynamoDB is not required for the current eBay architecture. Revisit it only if you later introduce per-user eBay sessions or durable publish-job state.

Note:

- This AWS console work is not required for the current local no-Docker Lambda validation.

## Recommended completion order

1. Fix Shopify app scopes and user file-create permission.
2. Rerun `npm run probe:lambda:shopify`.
3. Confirm Airtable refs and users table values are correct.
4. Confirm eBay developer keys, refresh token, policies, and location values.
5. Enable optional Gmail or AI provider settings only if you need those flows.
6. Do AWS console setup only when you move from local validation to deployed Lambdas.