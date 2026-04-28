import test from 'node:test';
import assert from 'node:assert/strict';
import { getRuntimeConfig } from './client.js';

function withEnv(overrides: Record<string, string | undefined>, run: () => void): void {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('getRuntimeConfig returns normalized production runtime config when required publish settings exist', () => {
  withEnv(
    {
      EBAY_ENV: 'production',
      EBAY_LISTING_API: ' trading-verify ',
      EBAY_LOCATION_KEY: ' warehouse-1 ',
      EBAY_LOCATION_NAME: ' Main Warehouse ',
      EBAY_LOCATION_COUNTRY: ' us ',
      EBAY_LOCATION_POSTAL_CODE: ' 10001 ',
      EBAY_LOCATION_CITY: ' New York ',
      EBAY_LOCATION_STATE: ' NY ',
      EBAY_FULFILLMENT_POLICY_ID: ' fulfil-1 ',
      EBAY_PAYMENT_POLICY_ID: ' payment-1 ',
      EBAY_RETURN_POLICY_ID: ' return-1 ',
    },
    () => {
      const config = getRuntimeConfig();

      assert.equal(config.authMode, 'server');
      assert.equal(config.environment, 'production');
      assert.equal(config.defaultListingApiMode, 'trading-verify');
      assert.equal(config.hasRequiredPublishSetup, true);
      assert.deepEqual(config.missingLocationFields, []);
      assert.deepEqual(config.missingPolicyFields, []);
      assert.deepEqual(config.publishSetup, {
        locationConfig: {
          key: 'warehouse-1',
          name: 'Main Warehouse',
          country: 'US',
          postalCode: '10001',
          city: 'New York',
          stateOrProvince: 'NY',
        },
        policyConfig: {
          fulfillmentPolicyId: 'fulfil-1',
          paymentPolicyId: 'payment-1',
          returnPolicyId: 'return-1',
        },
      });
    },
  );
});

test('getRuntimeConfig falls back to sandbox inventory mode and reports missing publish settings', () => {
  withEnv(
    {
      EBAY_ENV: 'sandbox',
      EBAY_LISTING_API: 'unsupported-mode',
      EBAY_LOCATION_KEY: ' ',
      EBAY_LOCATION_NAME: undefined,
      EBAY_LOCATION_COUNTRY: ' ',
      EBAY_LOCATION_POSTAL_CODE: ' ',
      EBAY_LOCATION_CITY: ' Seattle ',
      EBAY_LOCATION_STATE: ' ',
      EBAY_FULFILLMENT_POLICY_ID: ' ',
      EBAY_PAYMENT_POLICY_ID: undefined,
      EBAY_RETURN_POLICY_ID: ' ',
    },
    () => {
      const config = getRuntimeConfig();

      assert.equal(config.environment, 'sandbox');
      assert.equal(config.defaultListingApiMode, 'inventory');
      assert.equal(config.hasRequiredPublishSetup, false);
      assert.deepEqual(config.missingLocationFields, [
        'location key',
        'country',
        'postal code or city/state',
      ]);
      assert.deepEqual(config.missingPolicyFields, [
        'fulfillment policy',
        'payment policy',
        'return policy',
      ]);
    },
  );
});