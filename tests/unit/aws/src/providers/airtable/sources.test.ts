import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../../../../../aws/src/shared/errors.js';
import {
  airtableSourceDependencies,
  getConfiguredRecords,
  getConfiguredRecordsSummary,
  uploadConfiguredAttachment,
} from '../../../../../../aws/src/providers/airtable/sources.js';

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

test('getConfiguredRecords resolves inventory-directory through the combined listings source', async () => {
  const original = airtableSourceDependencies.getRecords;
  const originalInventoryReference = process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF;
  const originalInventoryTableName = process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME;
  const originalBaseId = process.env.AIRTABLE_BASE_ID;
  const calls: Array<{ baseId: string; tableName: string; viewId?: string; fields?: string[] }> = [];

  process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF = 'apprsAm2FOohEmL2u/tbl0K0nFQL64jQMx8/viwZdrQSBohX1m35D';
  process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = 'tbl0K0nFQL64jQMx8';
  process.env.AIRTABLE_BASE_ID = 'appLocalBase';
  airtableSourceDependencies.getRecords = async (baseId, tableName, viewId, options) => {
    calls.push({ baseId, tableName, viewId, fields: options?.fields });
    return [];
  };

  try {
    await getConfiguredRecords('inventory-directory', { fields: ['SKU', 'Status'] });

    assert.deepEqual(calls, [{
      baseId: 'apprsAm2FOohEmL2u',
      tableName: 'tbl0K0nFQL64jQMx8',
      viewId: 'viwZdrQSBohX1m35D',
      fields: ['SKU', 'Status'],
    }]);
  } finally {
    airtableSourceDependencies.getRecords = original;
    process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF = originalInventoryReference;
    process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = originalInventoryTableName;
    process.env.AIRTABLE_BASE_ID = originalBaseId;
  }
});

test('getConfiguredRecords drops unknown requested fields and retries', async () => {
  const original = airtableSourceDependencies.getRecords;
  const calls: string[][] = [];

  airtableSourceDependencies.getRecords = async (_baseId, _tableName, _viewId, options) => {
    const fields = options?.fields ?? [];
    calls.push(fields);

    if (fields.includes('Approved')) {
      throw new HttpError(422, 'Unknown field name: "Approved"', {
        service: 'airtable',
        code: 'AIRTABLE_HTTP_ERROR',
      });
    }

    return [buildRecord({ 'Workflow Status': 'Pending' })];
  };

  try {
    const records = await getConfiguredRecords('approval-combined', {
      fields: ['Workflow Status', 'Approved', 'eBay Offer Status'],
    });

    assert.equal(records.length, 1);
    assert.deepEqual(calls, [
      ['Workflow Status', 'Approved', 'eBay Offer Status'],
      ['Workflow Status', 'eBay Offer Status'],
    ]);
  } finally {
    airtableSourceDependencies.getRecords = original;
  }
});

test('getConfiguredRecords drops multiple unknown fields from plural Airtable errors', async () => {
  const original = airtableSourceDependencies.getRecords;
  const calls: string[][] = [];

  airtableSourceDependencies.getRecords = async (_baseId, _tableName, _viewId, options) => {
    const fields = options?.fields ?? [];
    calls.push(fields);

    if (fields.includes('Approved') || fields.includes('Shopify Approved')) {
      throw new HttpError(422, 'Unknown field names: Approved, Shopify Approved', {
        service: 'airtable',
        code: 'AIRTABLE_HTTP_ERROR',
      });
    }

    return [buildRecord({ 'Workflow Status': 'Pending' })];
  };

  try {
    const records = await getConfiguredRecords('approval-combined', {
      fields: ['Workflow Status', 'Approved', 'Shopify Approved', 'eBay Offer Status'],
    });

    assert.equal(records.length, 1);
    assert.deepEqual(calls, [
      ['Workflow Status', 'Approved', 'Shopify Approved', 'eBay Offer Status'],
      ['Workflow Status', 'eBay Offer Status'],
    ]);
  } finally {
    airtableSourceDependencies.getRecords = original;
  }
});

test('getConfiguredRecords caches unknown field names to skip repeat retry calls', async () => {
  const original = airtableSourceDependencies.getRecords;
  const calls: string[][] = [];

  airtableSourceDependencies.getRecords = async (_baseId, _tableName, _viewId, options) => {
    const fields = options?.fields ?? [];
    calls.push(fields);

    if (fields.includes('Approved')) {
      throw new HttpError(422, 'Unknown field name: "Approved"', {
        service: 'airtable',
        code: 'AIRTABLE_HTTP_ERROR',
      });
    }

    return [buildRecord({ 'Workflow Status': 'Pending' })];
  };

  try {
    const request = {
      fields: ['Workflow Status', 'Approved', 'eBay Offer Status'],
    };

    const firstRecords = await getConfiguredRecords('approval-combined', request);
    const secondRecords = await getConfiguredRecords('approval-combined', request);

    assert.equal(firstRecords.length, 1);
    assert.equal(secondRecords.length, 1);
    assert.deepEqual(calls, [
      ['Workflow Status', 'Approved', 'eBay Offer Status'],
      ['Workflow Status', 'eBay Offer Status'],
      ['Workflow Status', 'eBay Offer Status'],
    ]);
  } finally {
    airtableSourceDependencies.getRecords = original;
  }
});

test('getConfiguredRecords applies ready-for-publishing subset filter for approval-combined', async () => {
  const original = airtableSourceDependencies.getRecords;
  const calls: Array<{ fields?: string[]; filterByFormula?: string }> = [];

  airtableSourceDependencies.getRecords = async (_baseId, _tableName, _viewId, options) => {
    calls.push({
      fields: options?.fields,
      filterByFormula: options?.filterByFormula,
    });
    return [buildRecord({ 'Workflow Status': 'Approved for Publish', Title: 'Amp' })];
  };

  try {
    const records = await getConfiguredRecords('approval-combined', {
      fields: ['Workflow Status', 'Title'],
      subset: 'ready-for-publishing',
    });

    assert.equal(records.length, 1);
    assert.deepEqual(calls, [{
      fields: ['Workflow Status', 'Title'],
      filterByFormula: "{Workflow Status}='Approved for Publish'",
    }]);
  } finally {
    airtableSourceDependencies.getRecords = original;
  }
});