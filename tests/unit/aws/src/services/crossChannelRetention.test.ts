import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  closeEbayListingWhenSoldOnShopify,
  retainShopifyProductWhenSoldOnEbay,
  retainShopifyProductWhenSoldOnShopify,
} from '../../../../../aws/src/services/crossChannelClose.js';
import type { SoldRetentionResult } from '../../../../../aws/src/services/soldRetention.js';

const retained: SoldRetentionResult = { success: true, retryable: false, outcome: 'retained', message: 'Shopify product retained (stock 0, tagged sold-archive)' };

type RetainInput = { productId: number; soldOn: 'shopify' | 'ebay' };

function setup(result: SoldRetentionResult) {
  const updateRecord = mock.fn(async () => ({}));
  const retainShopifyProduct = mock.fn(async () => result);
  return { updateRecord, retainShopifyProduct };
}

const inputOf = (fn: { mock: { calls: Array<{ arguments: unknown[] }> } }) => fn.mock.calls[0]?.arguments[0] as RetainInput;
const written = (updateRecord: ReturnType<typeof setup>['updateRecord']) => updateRecord.mock.calls.map((call) => (call.arguments as unknown[])[2] as Record<string, unknown>);

describe('retainShopifyProductWhenSoldOnEbay', () => {
  it('retains the product (never deletes it) and records the closure in Airtable', async () => {
    const { updateRecord, retainShopifyProduct } = setup(retained);
    const result = await retainShopifyProductWhenSoldOnEbay('rec-1', { 'Shopify REST Product ID': '15430268879170' }, {
      updateRecord: updateRecord as never, retainShopifyProduct,
    });

    assert.equal(result.success, true);
    assert.deepEqual(inputOf(retainShopifyProduct), { productId: 15430268879170, soldOn: 'ebay' });
    const [fields] = written(updateRecord);
    assert.equal(fields['Shopify Close Result'], 'Shopify product retained (stock 0, tagged sold-archive)');
    assert.equal(typeof fields['Shopify Closed At'], 'string');
  });

  it('accepts a Shopify product GID', async () => {
    const { updateRecord, retainShopifyProduct } = setup(retained);
    await retainShopifyProductWhenSoldOnEbay('rec-1', { 'Shopify REST Product ID': 'gid://shopify/Product/777' }, {
      updateRecord: updateRecord as never, retainShopifyProduct,
    });
    assert.equal(inputOf(retainShopifyProduct).productId, 777);
  });

  it('makes no Airtable write when the product was already retained', async () => {
    const { updateRecord, retainShopifyProduct } = setup({ success: true, retryable: false, outcome: 'already-retained', message: 'already' });
    const result = await retainShopifyProductWhenSoldOnEbay('rec-1', { 'Shopify REST Product ID': '123' }, {
      updateRecord: updateRecord as never, retainShopifyProduct,
    });

    assert.equal(result.success, true);
    assert.equal(updateRecord.mock.callCount(), 0);
  });

  it('records a review message without a closed date when the product needs manual review', async () => {
    const { updateRecord, retainShopifyProduct } = setup({ success: true, retryable: false, outcome: 'needs-review', message: 'Multi-unit product (3 in stock) left unchanged; review manually' });
    const result = await retainShopifyProductWhenSoldOnEbay('rec-1', { 'Shopify REST Product ID': '123' }, {
      updateRecord: updateRecord as never, retainShopifyProduct,
    });

    assert.equal(result.success, true);
    const [fields] = written(updateRecord);
    assert.match(String(fields['Shopify Close Result']), /Multi-unit/);
    assert.equal('Shopify Closed At' in fields, false);
  });

  it('reports a retryable failure and records it for the operator', async () => {
    const { updateRecord, retainShopifyProduct } = setup({ success: false, retryable: true, outcome: 'failed', message: 'Shopify sold-retention error: HTTP 503' });
    const result = await retainShopifyProductWhenSoldOnEbay('rec-1', { 'Shopify REST Product ID': '123' }, {
      updateRecord: updateRecord as never, retainShopifyProduct,
    });

    assert.equal(result.success, false);
    assert.equal(result.retryable, true);
    assert.match(String(written(updateRecord)[0]['Shopify Close Result']), /HTTP 503/);
  });

  it('fails without a retry when the record has no Shopify product id', async () => {
    const { updateRecord, retainShopifyProduct } = setup(retained);
    const result = await retainShopifyProductWhenSoldOnEbay('rec-1', {}, { updateRecord: updateRecord as never, retainShopifyProduct });

    assert.equal(result.success, false);
    assert.equal(result.retryable, false);
    assert.equal(retainShopifyProduct.mock.callCount(), 0);
    assert.match(String(written(updateRecord)[0]['Shopify Close Result']), /Missing Shopify REST Product ID/);
  });

  it('does not let a failed Airtable write hide the retention result', async () => {
    const retainShopifyProduct = mock.fn(async () => retained);
    const updateRecord = mock.fn(async () => { throw new Error('Airtable down'); });
    const result = await retainShopifyProductWhenSoldOnEbay('rec-1', { 'Shopify REST Product ID': '123' }, {
      updateRecord: updateRecord as never, retainShopifyProduct,
    });

    assert.equal(result.success, true);
  });
});

describe('retainShopifyProductWhenSoldOnShopify', () => {
  it('prefers the sold order product id and passes soldOn shopify', async () => {
    const { updateRecord, retainShopifyProduct } = setup(retained);
    await retainShopifyProductWhenSoldOnShopify('rec-1', { 'Shopify REST Product ID': '111' }, {
      updateRecord: updateRecord as never, retainShopifyProduct, productIdHint: '222',
    });
    assert.deepEqual(inputOf(retainShopifyProduct), { productId: 222, soldOn: 'shopify' });
  });

  it('falls back to the record product id when the order has none', async () => {
    const { updateRecord, retainShopifyProduct } = setup(retained);
    await retainShopifyProductWhenSoldOnShopify('rec-1', { 'Shopify REST Product ID': '111' }, {
      updateRecord: updateRecord as never, retainShopifyProduct,
    });
    assert.equal(inputOf(retainShopifyProduct).productId, 111);
  });
});

describe('closeEbayListingWhenSoldOnShopify retry safety', () => {
  it('does not withdraw again when an earlier attempt already withdrew the offer', async () => {
    const updateRecord = mock.fn(async () => ({}));
    const result = await closeEbayListingWhenSoldOnShopify('rec-1', {
      'eBay Offer ID': 'offer-1',
      'eBay Listing ID': 'listing-1',
      'eBay Closed At': '2026-10-16T12:00:00.000Z',
      'eBay Close Result': 'eBay offer withdrawn',
    }, { updateRecord: updateRecord as never });

    assert.equal(result.success, true);
    assert.match(result.message, /already closed/);
    assert.equal(updateRecord.mock.callCount(), 0);
  });

  it('still withdraws a relisted offer: an older withdrawal does not count after a newer publish', async () => {
    const originalFetch = globalThis.fetch;
    const saved = { id: process.env.EBAY_CLIENT_ID, secret: process.env.EBAY_CLIENT_SECRET, token: process.env.EBAY_REFRESH_TOKEN, env: process.env.EBAY_ENV };
    process.env.EBAY_ENV = 'production';
    process.env.EBAY_CLIENT_ID = 'id';
    process.env.EBAY_CLIENT_SECRET = 'secret';
    process.env.EBAY_REFRESH_TOKEN = 'refresh';
    const fetchMock = mock.fn(async (input: string | URL | Request) => (String(input).endsWith('/oauth2/token') ? Response.json({ access_token: 't' }) : new Response('', { status: 200 })));
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const result = await closeEbayListingWhenSoldOnShopify('rec-1', {
        'eBay Offer ID': 'offer-2', 'eBay Listing ID': 'listing-2',
        'eBay Closed At': '2026-09-01T12:00:00.000Z', 'eBay Close Result': 'eBay offer withdrawn',
        'eBay Published At': '2026-10-10T12:00:00.000Z',
      }, { updateRecord: mock.fn(async () => ({})) as never });
      assert.equal(result.success, true);
      assert.equal(fetchMock.mock.callCount(), 2);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of [['EBAY_CLIENT_ID', saved.id], ['EBAY_CLIENT_SECRET', saved.secret], ['EBAY_REFRESH_TOKEN', saved.token], ['EBAY_ENV', saved.env]] as const) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('still tries to withdraw when the previous attempt failed (no closed date)', async () => {
    const originalFetch = globalThis.fetch;
    const saved = { id: process.env.EBAY_CLIENT_ID, secret: process.env.EBAY_CLIENT_SECRET, token: process.env.EBAY_REFRESH_TOKEN, env: process.env.EBAY_ENV };
    process.env.EBAY_ENV = 'production';
    process.env.EBAY_CLIENT_ID = 'id';
    process.env.EBAY_CLIENT_SECRET = 'secret';
    process.env.EBAY_REFRESH_TOKEN = 'refresh';
    const fetchMock = mock.fn(async (input: string | URL | Request) => (String(input).endsWith('/oauth2/token') ? Response.json({ access_token: 't' }) : new Response('', { status: 200 })));
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const result = await closeEbayListingWhenSoldOnShopify('rec-1', {
        'eBay Offer ID': 'offer-1', 'eBay Listing ID': 'listing-1', 'eBay Close Result': 'eBay withdraw error: HTTP 503',
      }, { updateRecord: mock.fn(async () => ({})) as never });
      assert.equal(result.success, true);
      assert.equal(fetchMock.mock.callCount(), 2);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of [['EBAY_CLIENT_ID', saved.id], ['EBAY_CLIENT_SECRET', saved.secret], ['EBAY_REFRESH_TOKEN', saved.token], ['EBAY_ENV', saved.env]] as const) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('classifies a server-side eBay failure as retryable and a client error as permanent', async () => {
    const originalFetch = globalThis.fetch;
    const saved = { id: process.env.EBAY_CLIENT_ID, secret: process.env.EBAY_CLIENT_SECRET, token: process.env.EBAY_REFRESH_TOKEN, env: process.env.EBAY_ENV };
    process.env.EBAY_ENV = 'production';
    process.env.EBAY_CLIENT_ID = 'id';
    process.env.EBAY_CLIENT_SECRET = 'secret';
    process.env.EBAY_REFRESH_TOKEN = 'refresh';
    let withdrawStatus = 503;
    globalThis.fetch = (async (input: string | URL | Request) => (String(input).endsWith('/oauth2/token')
      ? Response.json({ access_token: 't' })
      : new Response('failure', { status: withdrawStatus }))) as typeof fetch;
    try {
      const fields = { 'eBay Offer ID': 'offer-1', 'eBay Listing ID': 'listing-1' };
      const serverError = await closeEbayListingWhenSoldOnShopify('rec-1', fields, { updateRecord: mock.fn(async () => ({})) as never });
      assert.equal(serverError.success, false);
      assert.equal(serverError.retryable, true);

      withdrawStatus = 400;
      const clientError = await closeEbayListingWhenSoldOnShopify('rec-1', fields, { updateRecord: mock.fn(async () => ({})) as never });
      assert.equal(clientError.success, false);
      assert.equal(clientError.retryable, false);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of [['EBAY_CLIENT_ID', saved.id], ['EBAY_CLIENT_SECRET', saved.secret], ['EBAY_REFRESH_TOKEN', saved.token], ['EBAY_ENV', saved.env]] as const) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('treats missing eBay identifiers as a permanent failure', async () => {
    const result = await closeEbayListingWhenSoldOnShopify('rec-1', {}, { updateRecord: mock.fn(async () => ({})) as never });
    assert.equal(result.success, false);
    assert.equal(result.retryable, false);
  });
});
