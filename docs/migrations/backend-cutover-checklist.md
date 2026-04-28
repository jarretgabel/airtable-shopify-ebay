# Remaining Backend Cutover Checklist

This document tracks the remaining places where Lambda or another backend-owned boundary is a better fit than the frontend.

The goal is to separate:

- already backend-owned integrations
- integrations that already have an app-api seam but still need legacy direct-provider code removed
- flows that are still fundamentally frontend-owned and should move server-side
- code that should remain frontend-only

## Current Status

### Already backend-owned enough for marketplace operations

These are already cut over behind `/api/*` for the meaningful production paths:

- eBay inventory, offers, taxonomy, runtime config, sample publish, approval publish, hosted image upload
  - frontend seam: `src/services/app-api/ebay.ts`
  - backend handlers: `aws/src/handlers/ebay/*`
- Airtable configured reads and writes used by the app
  - frontend seam: `src/services/app-api/airtable.ts`
  - backend handlers: `aws/src/handlers/airtable/*`
- Shopify product, collection, taxonomy, category, and image endpoints
  - frontend seam: `src/services/app-api/shopify.ts`
  - backend handlers: `aws/src/handlers/shopify/*`

These do not need another major cutover. The remaining work there is hardening and deleting legacy direct-provider code that is no longer part of runtime.

### Backend seam exists and runtime is Lambda-only

These already have Lambda handlers and the frontend now uses `/api/*` only at runtime. Some legacy direct-provider modules may still exist as cleanup candidates:

- AI image identification
  - seam: `src/services/app-api/ai.ts`
  - backend handler: `aws/src/handlers/ai/identifyEquipment.ts`
- Gmail delivery
  - seam: `src/services/app-api/gmail.ts`
  - backend handler: `aws/src/handlers/gmail/send.ts`
- JotForm reads
  - seam: `src/services/app-api/jotform.ts`
  - helper module: `src/services/jotform.ts`
  - backend handlers: `aws/src/handlers/jotform/*`
- Shopify admin access through the backend seam
  - seam: `src/services/app-api/shopify.ts`
  - shared request builders/types: `src/services/shopify.ts`

### Still frontend-owned and should move server-side

These were the strongest remaining cutover points before the auth cutover.

- Welcome email orchestration fallback behavior

Current auth runtime is now backend-owned. Remaining frontend-owned edges live mainly in:

- `src/stores/auth/authStorage.ts`
- `src/components/ResetPasswordScreen.tsx`
- `src/components/SettingsTab.tsx`

### Probably frontend-only by design

These are local transformation or UI concerns, not integration boundaries:

- HTML/template builders
- draft payload builders
- tag parsing and formatting helpers
- local image processing UX
- notification dismissal state
- lightweight client analytics buffers

Do not move these unless there is a specific server-side need.

## Phase 1: Server-own Auth And Recovery

This is the highest-value remaining backend migration.

### Why this phase matters

The core auth/session flow has been moved behind backend routes and cookie-backed session transport:

- browser auth state is no longer restored from localStorage
- password reset and email-change tokens are no longer stored in browser localStorage
- session validation happens through `/api/auth/session`
- logout clears the backend-owned `lcc_session` cookie through `/api/auth/logout`
- password comparison and password updates happen server-side

This is the clearest remaining place where backend ownership is better than frontend ownership.

### Scope

- Keep cookie-backed session transport as the default auth path
- Keep local/dev cookie policy explicit with `APP_AUTH_COOKIE_SECURE_MODE`, `APP_AUTH_COOKIE_SAME_SITE`, and `APP_AUTH_COOKIE_DOMAIN`
- Remove any remaining doc and fallback references to frontend-managed auth persistence

### Suggested route surface

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `POST /api/auth/email-change/request`
- `POST /api/auth/email-change/confirm`

### Minimal persistence model

Short-term acceptable option:

- keep user profile records in Airtable
- move password hashes, session state, reset tokens, and email-change tokens to Lambda-owned storage

Preferred long-term option:

- move auth state fully off Airtable into a proper backend store

### Acceptance criteria

- no password reset tokens stored in browser localStorage
- no email change tokens stored in browser localStorage
- session state no longer derived from browser localStorage alone
- session transport uses backend-issued httpOnly cookies
- password comparison and password updates happen server-side

## Phase 2: Enforce Lambda-Only Mode For Existing Seams

This is the next cleanup phase after auth.

### Goal

Keep the existing app-api seams and remove leftover direct-provider runtime assumptions.

Current implementation status:

- AI, Gmail, JotForm, Shopify, and Airtable now use Lambda `/api/*` routes at runtime.
- Direct-provider Vite proxies for those integrations have been removed.
- Remaining cleanup is deleting or isolating legacy direct-provider modules that are no longer used by the app runtime.

### AI

Current split:

- Lambda path: `src/services/app-api/ai.ts`

Current browser-secret dependency:

- backend-only provider credentials

Work:

- done for runtime; remaining work is documentation cleanup only if stale references remain

### Gmail

Current split:

- Lambda path: `src/services/app-api/gmail.ts`

Current browser-secret dependency:

- backend-only Gmail credentials

Work:

- done for runtime; remaining work is documentation cleanup only if stale references remain

### JotForm

Current split:

- Lambda path: `src/services/app-api/jotform.ts`

Current browser-secret or proxy dependency:

- backend-owned JotForm credentials

Work:

- done for runtime; remaining work is deleting or documenting any leftover helper-only code

### Shopify direct admin access

Current split:

- Lambda path: `src/services/app-api/shopify.ts`
- helper/types path: `src/services/shopify.ts`

Current dev proxy coupling:

- removed from runtime; Shopify traffic now goes through the backend seam

Work:

- done for runtime; keep only pure builders and shared types in the frontend module

### Airtable direct access

Current split:

- Lambda path: `src/services/app-api/airtable.ts`
- direct path: `src/services/airtable.ts` and `src/services/airtable/*`

Work:

- keep direct Airtable path only for local debugging if needed
- stop treating it as a normal deployment path

### Acceptance criteria

- production deployment does not require browser-visible provider tokens for AI, Gmail, JotForm, Shopify, or Airtable
- direct-mode flags are clearly scoped to local/dev only, or removed
- app-api becomes the mandatory transport in real environments

## Phase 3: Add A Real Backend Route For HiFiShark If Needed

Current state:

- frontend fetches through `/api/hifishark/model/{slug}` in `src/services/hifishark.ts`
- parsing now runs in the backend handler instead of the Vite dev proxy

Status:

- complete

### Suggested route surface

- `GET /api/hifishark/model/{slug}`

### Backend responsibilities

- perform upstream fetch with server-owned headers
- centralize parsing and error handling
- add throttling and caching if needed
- avoid dependence on Vite dev proxy behavior

### If not needed

If HiFiShark is only a developer convenience, leave it out of Lambda and treat it as non-production tooling.

## Frontend-Owned Code That Should Stay Frontend-Owned

Do not spend Lambda time on these unless a concrete backend need appears:

- `src/services/shopifyDraftFromAirtable.ts`
- `src/services/ebayDraftFromAirtable.ts`
- `src/services/shopifyBodyHtml.ts`
- `src/services/ebayBodyHtml.ts`
- `src/services/shopifyTags.ts`
- `src/services/shopifyTaxonomy.ts`
- `src/services/imageProcessor.ts`
- `src/services/workflowAnalytics.ts`
- `src/stores/notificationStore.ts`

These are draft-building, presentation, parsing, or local UX concerns rather than backend integration boundaries.

## Recommended Execution Order

1. Server-own auth/session/reset/email-change flow
2. Enforce Lambda-only mode for AI, Gmail, JotForm, Shopify, and Airtable in production paths
3. Decide whether HiFiShark needs a deployed backend route

## Definition Of Done

The backend cutover is effectively complete when:

- all marketplace and record mutations already run through Lambda
- auth and recovery flows are backend-owned
- no production-critical provider secret is expected in frontend env vars
- browser-direct provider access is either removed or limited to local/dev debugging only
- any remaining frontend-only code is clearly just local transformation or UI logic