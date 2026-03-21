# Service Organization and Data Layer Patterns

## Overview
Services handle external API communication, transformations, and configuration. Keep them thin and orchestration-focused; extract helpers for reusability.

## Service Organization Structure

Large services follow a modular pattern split across multiple files in the same domain:

```
src/services/{platform}/
├── {feature}.ts              # Main entry point (thin, orchestration)
├── {feature}Config.ts        # Env vars, constants, initialization
├── {feature}Request.ts       # Request builders, payload shapes
├── {feature}Mappers.ts       # Response transformations
├── {feature}Types.ts         # Domain types
└── {feature}.test.ts         # Integration and unit tests
```

## Main Entry Point Pattern

**`{feature}.ts`** — Orchestration + Public API

Responsibilities:
- Import from sibling helpers (Config, Request, Mappers)
- Export public async functions that coordinate API calls
- Keep function logic <= 30 lines (call helpers, don't duplicate logic)
- Re-export types and constants for downstream use

Example: `src/services/ebay/listing.ts`
```typescript
import { CLIENT_ID, validateRequiredEnv } from './config';
import { buildListingPayload, buildOffersPayload } from './request';
import { mapListingResponse, mapOffersResponse } from './mappers';
import type { EbayListing, OfferPayload } from './types';

// Re-export public types and helpers
export type { EbayListing, OfferPayload } from './types';
export { CLIENT_ID } from './config';

// Thin orchestration functions
export async function publishListing(params: PublishParams): Promise<EbayListing> {
  validateRequiredEnv(['CLIENT_ID', 'LISTING_POLICY_ID']);
  
  const payload = buildListingPayload(params);
  const response = await ebayApiCall('POST', '/inventory/offer', payload);
  
  return mapListingResponse(response);
}

export async function getInventoryItems(sku: string[]): Promise<EbayListing[]> {
  validateRequiredEnv(['CLIENT_ID']);
  
  const response = await ebayApiCall('GET', '/inventory/bulk-get', { skus: sku });
  
  return response.items.map(mapListingResponse);
}
```

## Config File Pattern

**`{feature}Config.ts`** — Environment + Constants

Responsibilities:
- Read and validate `import.meta.env` at module boundary
- Define service-level constants (endpoints, defaults, fallbacks)
- Export initialization functions if needed
- Fail fast if required env vars missing

Example: `src/services/ebay/config.ts` (compatibility wrapper)
```typescript
/**
 * eBay configuration compatibility wrapper.
 * 
 * Implementation split:
 * - configEnv.ts: constants, env reading, keys
 * - configRuntime.ts: localStorage-backed runtime config
 */

export * from './configEnv';
export * from './configRuntime';
```

Example: `src/services/ebay/configEnv.ts` (actual env reading)
```typescript
import { requireEnv } from '@/config/runtimeEnv';

export const CLIENT_ID = requireEnv('VITE_EBAY_CLIENT_ID');
export const SANDBOX_URL = 'https://api.sandbox.ebay.com';
export const PROD_URL = 'https://api.ebay.com';

export const IS_SANDBOX = (import.meta.env.MODE === 'development');
export const API_BASE = IS_SANDBOX ? SANDBOX_URL : PROD_URL;

// Service-level constants
export const REQUEST_TIMEOUT = 30000; // ms
export const RATE_LIMIT_RETRY_AFTER = 3600; // seconds
export const MAX_SKU_BATCH = 50;
```

## Request Builder Pattern

**`{feature}Request.ts`** — Payload Construction

Responsibilities:
- Pure functions that build request payloads
- Validate inputs and throw meaningful errors
- Normalize/transform parameters into API format
- Keep functions <= 50 lines, extract complex logic

Example: `src/services/ebay/request.ts`
```typescript
import {
  SHIPPING_SERVICE_OPTIONS,
  MAX_SKU_BATCH,
} from './config';
import type { ShippingService, ListingPayloadParams } from './types';

export function buildListingPayload(params: ListingPayloadParams) {
  if (!params.sku) throw new Error('SKU required for listing payload');
  
  const domestic = SHIPPING_SERVICE_OPTIONS.find(
    (s) => s.name === 'Domestic Service 1'
  );
  
  return {
    sku: params.sku.trim(),
    availability: {
      quantity: params.quantity || 1,
      availabilityThresholdType: 'MORE_THAN',
      availabilityThresholdValue: 0,
    },
    pricing: {
      pricingVisibility: 'SHOW',
      minimumAdvertisedPrice: params.mapPrice || 0,
      originalRecommendedRetailPrice: params.msrp,
      pricingType: 'FIXED_PRICE',
      price: {
        currency: 'USD',
        value: String(params.price),
      },
    },
    shipping: {
      shippingServices: domestic ? [buildShippingService(domestic, params)] : [],
    },
    // ... more fields
  };
}

function normalizeShippingCost(value: number): number {
  return Math.max(0, Math.min(value, 9999.99));
}

function buildShippingService(service: ShippingService, params: any) {
  return {
    shippingServiceCode: service.code,
    shippingCost: {
      currency: 'USD',
      value: String(normalizeShippingCost(params.shippingCost || 0)),
    },
  };
}
```

## Mappers Pattern

**`{feature}Mappers.ts`** — Response Transformation

Responsibilities:
- Transform API responses into app domain types
- Handle null/undefined values with defaults
- Normalize field names and values
- Extract reusable transformation logic into helpers

Example: `src/services/ebay/mappers.ts`
```typescript
import type { EbayApiResponse, EbayListing } from './types';
import { normalizeCondition, normalizeListingFormat } from './utils';

export function mapListingResponse(response: EbayApiResponse): EbayListing {
  if (!response?.sku) {
    throw new Error('Invalid listing response: missing SKU');
  }

  return {
    sku: response.sku,
    title: response.title || 'Untitled',
    status: response.status === 'ACTIVE' ? 'active' : 'inactive',
    price: parseFloat(response.pricing?.price?.value ?? '0'),
    quantity: response.availability?.quantity ?? 0,
    condition: normalizeCondition(response.itemCondition),
    listingFormat: normalizeListingFormat(response.listingType),
    createdAt: response.creationDate ? new Date(response.creationDate) : null,
    updatedAt: response.revisionDate ? new Date(response.revisionDate) : null,
    url: buildListingUrl(response.sku),
  };
}

export function mapOffersResponse(offers: EbayApiResponse[]): EbayListing[] {
  return offers
    .filter((o) => o?.sku) // Skip invalid entries
    .map(mapListingResponse);
}

function buildListingUrl(sku: string): string {
  return `https://ebay.com/itm/${encodeURIComponent(sku)}`;
}
```

## Types File Pattern

**`{feature}Types.ts`** — Domain Types

Responsibilities:
- Define API response shapes (often mirrors API structure)
- Define app domain types (what components use)
- Keep separate concerns: API types vs domain types
- Document complex fields

Example: `src/services/ebay/types.ts`
```typescript
// API response shapes (what eBay sends)
export interface EbayApiResponse {
  sku?: string;
  title?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  pricing?: {
    price?: { currency: string; value: string };
    minimumAdvertisedPrice?: number;
  };
  availability?: {
    quantity?: number;
    availabilityThresholdType?: string;
    availabilityThresholdValue?: number;
  };
  itemCondition?: 'NEW' | 'LIKE_NEW' | 'USED';
  listingType?: 'FIXED_PRICE' | 'AUCTION';
}

// App domain types (what we use internally)
export interface EbayListing {
  sku: string;
  title: string;
  status: 'active' | 'inactive';
  price: number;
  quantity: number;
  condition: string;
  listingFormat: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  url: string;
}

// Params for service functions
export interface PublishParams {
  sku: string;
  title: string;
  price: number;
  quantity: number;
  shippingCost?: number;
  mapPrice?: number;
  msrp?: number;
}
```

## Compatibility Wrapper Pattern

For services already split, create a main entry that re-exports from siblings:

Example: `src/services/ebay/config.ts`
```typescript
/**
 * eBay configuration compatibility wrapper.
 *
 * Split implementation lives in:
 * - configEnv.ts for constants/env/keys
 * - configRuntime.ts for localStorage-backed runtime helpers
 *
 * This maintains the original import path for consumers:
 * import { CLIENT_ID, getRuName } from '@/services/ebay/config'
 */
export * from './configEnv';
export * from './configRuntime';
```

Consumers import normally:
```typescript
import { CLIENT_ID, getRuName } from '@/services/ebay/config';
// No change needed even though implementation was split
```

## Error Handling Pattern

Wrap API calls and provide user-friendly errors:

Example: `src/services/shared/apiHelpers.ts`
```typescript
import { logServiceError } from './logger';

export interface ApiError extends Error {
  status?: number;
  details?: Record<string, unknown>;
  originalError?: unknown;
}

export async function apiCall<T>(
  method: string,
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!response.ok) {
      const error = new Error(`${method} ${url} failed: ${response.status}`) as ApiError;
      error.status = response.status;
      throw error;
    }

    return await response.json();
  } catch (err) {
    logServiceError('API call failed', { method, url, error: err });
    throw err;
  }
}
```

## Testing Pattern for Services

Test at three levels: request builders, mappers, and integration:

```typescript
// src/services/ebay/mappers.test.ts
import { mapListingResponse } from './mappers';
import { createMockApiResponse } from '../test-helpers';

describe('mapListingResponse', () => {
  it('should map valid API response to listing', () => {
    const response = createMockApiResponse({
      sku: 'TEST-SKU-001',
      title: 'Test Item',
    });

    const result = mapListingResponse(response);

    expect(result.sku).toBe('TEST-SKU-001');
    expect(result.title).toBe('Test Item');
    expect(result.url).toContain('TEST-SKU-001');
  });

  it('should use defaults for missing fields', () => {
    const response = createMockApiResponse({ sku: 'TEST-SKU' });

    const result = mapListingResponse(response);

    expect(result.title).toBe('Untitled');
    expect(result.quantity).toBe(0);
    expect(result.createdAt).toBeNull();
  });

  it('should throw error for missing SKU', () => {
    const response = createMockApiResponse({ title: 'No SKU' });

    expect(() => mapListingResponse(response)).toThrow(
      'Invalid listing response: missing SKU'
    );
  });
});
```

## Checklist for New Services

- [ ] Main entry file (`{feature}.ts`): < 200 lines, pure orchestration
- [ ] Config file (`{feature}Config.ts`): All env vars + constants, with validation
- [ ] Request file (`{feature}Request.ts`): Payload builders, < 50 lines each
- [ ] Mappers file (`{feature}Mappers.ts`): Response transformations
- [ ] Types file (`{feature}Types.ts`): API and domain types clearly separated
- [ ] Re-exports in main file: Types, constants, major helpers
- [ ] Error handling: Try/catch with user-friendly messages
- [ ] Environment variables: Documented in `.env` template, validated at boundary
- [ ] Tests: Builders, mappers, and integration flow tested
- [ ] Logging: Service calls logged via `logServiceError()` on failure
