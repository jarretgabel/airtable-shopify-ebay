/**
 * eBay service — barrel re-export.
 *
 * Implementation is split across:
 *   ebay/types.ts     — interfaces & type aliases
 *   ebay/config.ts    — env vars, constants, localStorage helpers
 *   ebay/token.ts     — OAuth, token storage & refresh
 *   ebay/inventory.ts — read API (items, offers, public listings)
 *   ebay/listing.ts   — write API (draft, publish, Trading API)
 *
 * All requests are proxied through Vite (/ebay-api-proxy) to avoid CORS issues.
 */
export * from './ebay/types';
export * from './ebay/config';
export * from './ebay/token';
export * from './ebay/inventory';
export * from './ebay/listing';
export * from './ebay/taxonomy';
export * from './ebay/packageTypes';

