import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  closeEbayListingWhenSoldOnShopify,
  closeShopifyProductWhenSoldOnEbay,
} from '../../../../../aws/src/services/crossChannelClose.js';

describe('Cross-Channel Close Service', () => {
  describe('closeEbayListingWhenSoldOnShopify', () => {
    it('returns success when the eBay listing is already closed', async () => {
      const updateRecord = mock.fn(async () => ({}));
      const result = await closeEbayListingWhenSoldOnShopify('record-123', {
        'eBay Listing Status': 'ENDED',
        'eBay Offer ID': 'offer-123',
        'eBay Listing ID': 'listing-123',
      }, { updateRecord });

      assert.equal(result.success, true);
      assert.match(result.message, /already closed/);
      assert.equal(updateRecord.mock.callCount(), 0);
    });

    it('withdraws an eBay offer when listing status is missing', async () => {
      const originalFetch = globalThis.fetch;
      const originalEnv = process.env.EBAY_ENV;
      const originalClientId = process.env.EBAY_CLIENT_ID;
      const originalClientSecret = process.env.EBAY_CLIENT_SECRET;
      const originalRefreshToken = process.env.EBAY_REFRESH_TOKEN;
      const updateRecord = mock.fn(async () => ({}));
      const fetchMock = mock.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/identity/v1/oauth2/token')) {
          return Response.json({ access_token: 'test-token' });
        }
        return new Response('', { status: 200 });
      });
      process.env.EBAY_ENV = 'production';
      process.env.EBAY_CLIENT_ID = 'client-id';
      process.env.EBAY_CLIENT_SECRET = 'client-secret';
      process.env.EBAY_REFRESH_TOKEN = 'refresh-token';
      globalThis.fetch = fetchMock as typeof fetch;

      try {
        const result = await closeEbayListingWhenSoldOnShopify('record-123', {
          'eBay Offer ID': 'offer-123',
          'eBay Listing ID': 'listing-123',
        }, { updateRecord });

        assert.equal(result.success, true);
        assert.match(result.message, /withdrawn/);
        assert.equal(fetchMock.mock.callCount(), 2);
        assert.equal(fetchMock.mock.calls[1].arguments[0], 'https://api.ebay.com/sell/inventory/v1/offer/offer-123/withdraw');
        assert.equal(updateRecord.mock.callCount(), 1);
        assert.equal(
          updateRecord.mock.calls[0]?.arguments[2]['eBay Close Result'],
          'eBay offer withdrawn',
        );
      } finally {
        globalThis.fetch = originalFetch;
        if (originalEnv === undefined) delete process.env.EBAY_ENV;
        else process.env.EBAY_ENV = originalEnv;
        if (originalClientId === undefined) delete process.env.EBAY_CLIENT_ID;
        else process.env.EBAY_CLIENT_ID = originalClientId;
        if (originalClientSecret === undefined) delete process.env.EBAY_CLIENT_SECRET;
        else process.env.EBAY_CLIENT_SECRET = originalClientSecret;
        if (originalRefreshToken === undefined) delete process.env.EBAY_REFRESH_TOKEN;
        else process.env.EBAY_REFRESH_TOKEN = originalRefreshToken;
      }
    });

    it('does not treat a missing eBay offer as a successful withdrawal', async () => {
      const originalFetch = globalThis.fetch;
      const originalEnv = process.env.EBAY_ENV;
      const originalClientId = process.env.EBAY_CLIENT_ID;
      const originalClientSecret = process.env.EBAY_CLIENT_SECRET;
      const originalRefreshToken = process.env.EBAY_REFRESH_TOKEN;
      const updateRecord = mock.fn(async () => ({}));
      const fetchMock = mock.fn(async (input: string | URL | Request) => {
        if (String(input).endsWith('/identity/v1/oauth2/token')) {
          return Response.json({ access_token: 'test-token' });
        }
        return new Response('offer not found', { status: 404 });
      });
      process.env.EBAY_ENV = 'production';
      process.env.EBAY_CLIENT_ID = 'client-id';
      process.env.EBAY_CLIENT_SECRET = 'client-secret';
      process.env.EBAY_REFRESH_TOKEN = 'refresh-token';
      globalThis.fetch = fetchMock as typeof fetch;

      try {
        const result = await closeEbayListingWhenSoldOnShopify('record-123', {
          'eBay Offer ID': 'missing-offer',
          'eBay Listing ID': 'listing-123',
        }, { updateRecord });

        assert.equal(result.success, false);
        assert.match(result.message, /404 offer not found/);
        assert.equal(updateRecord.mock.callCount(), 1);
        assert.match(
          String(updateRecord.mock.calls[0]?.arguments[2]['eBay Close Result']),
          /404 offer not found/,
        );
      } finally {
        globalThis.fetch = originalFetch;
        if (originalEnv === undefined) delete process.env.EBAY_ENV;
        else process.env.EBAY_ENV = originalEnv;
        if (originalClientId === undefined) delete process.env.EBAY_CLIENT_ID;
        else process.env.EBAY_CLIENT_ID = originalClientId;
        if (originalClientSecret === undefined) delete process.env.EBAY_CLIENT_SECRET;
        else process.env.EBAY_CLIENT_SECRET = originalClientSecret;
        if (originalRefreshToken === undefined) delete process.env.EBAY_REFRESH_TOKEN;
        else process.env.EBAY_REFRESH_TOKEN = originalRefreshToken;
      }
    });

    it('records a validation failure when the eBay offer ID is missing', async () => {
      const updateRecord = mock.fn(async () => ({}));
      const result = await closeEbayListingWhenSoldOnShopify('record-123', {
        'eBay Listing ID': 'listing-123',
        'eBay Listing Status': 'ACTIVE',
      }, { updateRecord });

      assert.equal(result.success, false);
      assert.match(result.message, /Missing eBay Offer ID/);
      assert.equal(updateRecord.mock.callCount(), 1);
      const [source, recordId, fields, options] = updateRecord.mock.calls[0].arguments;
      assert.equal(source, 'used-gear-workflow');
      assert.equal(recordId, 'record-123');
      assert.equal(typeof fields['eBay Closed At'], 'string');
      assert.match(String(fields['eBay Close Result']), /Missing eBay Offer ID/);
      assert.deepEqual(options, { typecast: true });
    });

    it('records a timestamp when eBay close validation fails', async () => {
      const before = Date.now();
      const result = await closeEbayListingWhenSoldOnShopify('record-123', {
        'eBay Listing ID': 'listing-123',
        'eBay Listing Status': 'ACTIVE',
      }, { updateRecord: async () => ({}) });

      const closedAt = new Date(result.closedAt).getTime();
      assert.ok(closedAt >= before);
      assert.ok(closedAt <= Date.now());
    });
  });

  describe('closeShopifyProductWhenSoldOnEbay', () => {
    it('returns success when the Shopify product is already closed', async () => {
      const updateRecord = mock.fn(async () => ({}));
      const result = await closeShopifyProductWhenSoldOnEbay('record-123', {
        'Shopify Closed At': '2024-01-01T12:00:00Z',
        'Shopify Close Result': 'Shopify product already closed',
        'Shopify REST Product ID': 'product-123',
      }, { updateRecord });

      assert.equal(result.success, true);
      assert.match(result.message, /already closed/);
      assert.equal(updateRecord.mock.callCount(), 0);
    });

    it('force deletes when takedown overrides an already-closed flag', async () => {
      const originalFetch = globalThis.fetch;
      const originalDomain = process.env.SHOPIFY_STORE_DOMAIN;
      const originalToken = process.env.SHOPIFY_ACCESS_TOKEN;
      const updateRecord = mock.fn(async () => ({}));
      const fetchMock = mock.fn(async () => new Response('', { status: 200 }));
      process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
      globalThis.fetch = fetchMock as typeof fetch;

      try {
        const result = await closeShopifyProductWhenSoldOnEbay('record-force-1', {
          'Shopify Closed At': '2024-01-01T12:00:00Z',
          'Shopify Close Result': 'Cross-channel auto-close: Product deleted when sold on eBay',
          'Shopify REST Product ID': '123456789',
        }, { updateRecord, forceShopifyDelete: true });

        assert.equal(result.success, true);
        assert.match(result.message, /deleted/);
        assert.equal(fetchMock.mock.callCount(), 1);
        assert.equal(fetchMock.mock.calls[0].arguments[0], 'https://example.myshopify.com/admin/api/2024-04/products/123456789.json');
        assert.equal((fetchMock.mock.calls[0].arguments[1] as RequestInit).method, 'DELETE');
        assert.equal(updateRecord.mock.callCount(), 1);
        assert.equal(
          updateRecord.mock.calls[0]?.arguments[2]['Shopify Close Result'],
          'Shopify product deleted',
        );
      } finally {
        globalThis.fetch = originalFetch;
        if (originalDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
        else process.env.SHOPIFY_STORE_DOMAIN = originalDomain;
        if (originalToken === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN;
        else process.env.SHOPIFY_ACCESS_TOKEN = originalToken;
      }
    });

    it('records a validation failure when Shopify product ID is missing', async () => {
      const updateRecord = mock.fn(async () => ({}));
      const result = await closeShopifyProductWhenSoldOnEbay('record-123', {}, { updateRecord });

      assert.equal(result.success, false);
      assert.match(result.message, /Missing Shopify REST Product ID/);
      assert.equal(updateRecord.mock.callCount(), 1);
      const fields = updateRecord.mock.calls[0].arguments[2];
      assert.match(String(fields['Shopify Close Result']), /Missing Shopify REST Product ID/);
    });

    it('does not treat an unsuccessful Shopify close result as already closed', async () => {
      const originalDomain = process.env.SHOPIFY_STORE_DOMAIN;
      const originalToken = process.env.SHOPIFY_ACCESS_TOKEN;
      process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
      process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';

      try {
        const result = await closeShopifyProductWhenSoldOnEbay('record-1', {
          'Shopify Closed At': '2024-01-01T12:00:00Z',
          'Shopify Close Result': 'Shopify delete failed: 500 upstream error',
          'Shopify REST Product ID': 'product-123',
        }, { updateRecord: async () => ({}) });

        assert.equal(result.success, false);
        assert.match(result.message, /invalid product id/);
      } finally {
        if (originalDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
        else process.env.SHOPIFY_STORE_DOMAIN = originalDomain;
        if (originalToken === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN;
        else process.env.SHOPIFY_ACCESS_TOKEN = originalToken;
      }
    });
  });
});
