import test from 'node:test';
import assert from 'node:assert/strict';
import { airtableSourceDependencies, getConfiguredRecordsSummary } from './sources.js';

function buildRecord(fields: Record<string, unknown>) {
  return {
    id: 'rec123',
    createdTime: new Date().toISOString(),
    fields,
  };
}

test('getConfiguredRecordsSummary counts eBay approvals using alternate approved field names', async () => {
  const original = airtableSourceDependencies.getRecords;

  airtableSourceDependencies.getRecords = async () => [
    buildRecord({ 'eBay Approved': true }),
    buildRecord({ Approved: 'yes' }),
    buildRecord({ 'Shopify Approved': false }),
  ];

  try {
    const summary = await getConfiguredRecordsSummary('approval-ebay');
    assert.deepEqual(summary, { total: 3, approved: 2, pending: 1 });
  } finally {
    airtableSourceDependencies.getRecords = original;
  }
});

test('getConfiguredRecordsSummary counts Shopify approvals using Shopify Approved before fallback', async () => {
  const original = airtableSourceDependencies.getRecords;

  airtableSourceDependencies.getRecords = async () => [
    buildRecord({ 'Shopify Approved': 'Approved' }),
    buildRecord({ 'Shopify Approved': 'Pending' }),
    buildRecord({ Approved: true }),
  ];

  try {
    const summary = await getConfiguredRecordsSummary('approval-shopify');
    assert.deepEqual(summary, { total: 3, approved: 2, pending: 1 });
  } finally {
    airtableSourceDependencies.getRecords = original;
  }
});