import test from 'node:test';
import assert from 'node:assert/strict';
import { airtableSourceDependencies, getConfiguredRecordsSummary, uploadConfiguredAttachment } from '../../../../../../aws/src/providers/airtable/sources.js';

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

test('uploadConfiguredAttachment supports used-gear-workflow sources', async () => {
  const original = airtableSourceDependencies.uploadAttachment;
  const originalWorkflowReference = process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF;
  const originalWorkflowTableName = process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME;
  const originalBaseId = process.env.AIRTABLE_BASE_ID;
  const calls: Array<{ baseId: string; recordId: string; fieldId: string }> = [];

  process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF = 'appWorkflow/tblWorkflow';
  process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = 'Workflow Table';
  process.env.AIRTABLE_BASE_ID = '';
  airtableSourceDependencies.uploadAttachment = async (baseId, recordId, fieldId) => {
    calls.push({ baseId, recordId, fieldId });
  };

  try {
    await uploadConfiguredAttachment('used-gear-workflow', 'recWorkflow1', 'fldMXp0EaUHGglU8M', {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      file: 'abc123',
    });

    assert.deepEqual(calls, [{
      baseId: 'appWorkflow',
      recordId: 'recWorkflow1',
      fieldId: 'fldMXp0EaUHGglU8M',
    }]);
  } finally {
    airtableSourceDependencies.uploadAttachment = original;
    process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF = originalWorkflowReference;
    process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = originalWorkflowTableName;
    process.env.AIRTABLE_BASE_ID = originalBaseId;
  }
});