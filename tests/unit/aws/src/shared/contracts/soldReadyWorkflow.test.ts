import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSoldReadyFields } from '../../../../../../aws/src/shared/contracts/soldReadyWorkflow.js';

describe('buildSoldReadyFields', () => {
  it('advances listed and stale rows', () => {
    assert.deepEqual(buildSoldReadyFields({ 'Workflow Status': 'Listed, eBay' }, '2026-01-01T00:00:00Z'), {
      'Workflow Status': 'Sold - Ready to Ship',
      'Sold Ready To Ship At': '2026-01-01T00:00:00Z',
    });
    assert.equal(buildSoldReadyFields({ 'Workflow Status': 'Stale Listing, Shopify' }, 'x')['Workflow Status'], 'Sold - Ready to Ship');
  });

  it('keeps an existing sold timestamp', () => {
    const fields = buildSoldReadyFields({ 'Workflow Status': 'Listed, Shopify', 'Sold Ready To Ship At': 'earlier' }, 'later');
    assert.equal(fields['Sold Ready To Ship At'], 'earlier');
  });

  it('does nothing for other statuses', () => {
    for (const status of ['Sold - Ready to Ship', 'Shipped', 'Ready for Publish', '']) {
      assert.deepEqual(buildSoldReadyFields({ 'Workflow Status': status }, 'x'), {});
    }
  });
});
