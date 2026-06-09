import test from 'node:test';
import assert from 'node:assert/strict';
import { createIngestJotFormSubmissionWorkflow } from '../../../../../../aws/src/providers/jotform/workflowIngest.js';
import type { JotFormSubmission } from '../../../../../../aws/src/providers/jotform/client.js';

function buildSubmission(overrides: Partial<JotFormSubmission> = {}): JotFormSubmission {
  return {
    id: 'sub-123',
    form_id: 'form-abc',
    ip: '127.0.0.1',
    created_at: '2026-05-28 12:00:00',
    status: 'ACTIVE',
    new: '1',
    flag: '0',
    notes: '',
    answers: {
      // Shared fields — filled once per submission
      '3': {
        name: 'name',
        order: '3',
        text: 'Name',
        type: 'control_fullname',
        answer: 'Pat Seller',
        prettyFormat: 'Pat Seller',
      },
      // Slot 1 item fields (order range 40-49)
      '243': {
        name: 'brand243',
        order: '40',
        text: 'Brand',
        type: 'control_textbox',
        answer: 'McIntosh',
      },
      '244': {
        name: 'model244',
        order: '41',
        text: 'Model',
        type: 'control_textbox',
        answer: 'MC275',
      },
      '247': {
        name: 'cosmeticCondition247',
        order: '44',
        text: 'Cosmetic Condition',
        type: 'control_dropdown',
        answer: 'Excellent condition',
      },
      '249': {
        name: 'pictures249',
        order: '46',
        text: 'Pictures',
        type: 'control_fileupload',
        answer: ['https://files.example.com/front.jpg', 'https://files.example.com/rear.jpg'],
      },
      '250': {
        name: 'anyIssues250',
        order: '47',
        text: 'Any issues? Anything else included?',
        type: 'control_textarea',
        answer: 'Minor cosmetic scratches',
      },
    },
    ...overrides,
  };
}

function buildRecord(id: string, fields: Record<string, unknown>) {
  return {
    id,
    createdTime: '2026-05-28T12:00:00.000Z',
    fields,
  };
}

test('workflowIngest creates a workflow row and persists archived intake metadata for a new submission', async () => {
  const createCalls: Array<Record<string, unknown>> = [];
  const updateCalls: Array<{ recordId: string; fields: Record<string, unknown> }> = [];
  const archiveCalls: Array<{ recordId: string; imageUrls: string[] }> = [];

  const ingest = createIngestJotFormSubmissionWorkflow({
    getSubmission: async () => buildSubmission(),
    getConfiguredRecords: async () => [],
    createConfiguredRecord: async (_source, fields) => {
      createCalls.push(fields);
      return buildRecord('rec-new-1', fields);
    },
    updateConfiguredRecord: async (_source, recordId, fields) => {
      updateCalls.push({ recordId, fields });
      return buildRecord(recordId, fields);
    },
    archiveIntakeImagesForRecord: async (recordId, imageUrls) => {
      archiveCalls.push({ recordId, imageUrls });
      return [
        { id: 'drive-1', url: 'https://drive.google.com/uc?export=view&id=drive-1', filename: 'front.jpg' },
        { id: 'drive-2', url: 'https://drive.google.com/uc?export=view&id=drive-2', filename: 'rear.jpg' },
      ];
    },
  });

  const result = await ingest('form-abc', 'sub-123');

  assert.equal(createCalls.length, 1);
  assert.equal(updateCalls.length, 2);
  assert.equal(archiveCalls.length, 1);
  assert.equal(archiveCalls[0]?.recordId, 'rec-new-1');
  assert.deepEqual(archiveCalls[0]?.imageUrls, ['https://files.example.com/front.jpg', 'https://files.example.com/rear.jpg']);
  assert.equal(createCalls[0]?.['Workflow Source'], 'JotForm');
  assert.equal(createCalls[0]?.['Workflow Status'], 'Pending Review');
  assert.equal(createCalls[0]?.['JotForm Submission ID'], 'sub-123-slot1');
  assert.equal(createCalls[0]?.['Pick Up ID'], 'sub-123');
  assert.equal(createCalls[0]?.['Item Title'], 'McIntosh MC275');
  assert.equal(updateCalls[0]?.fields['Item Title'], 'McIntosh MC275 - new-1');
  const metadataPayload = String(updateCalls[1]?.fields['Workflow Image Metadata JSON'] || '');
  const metadata = JSON.parse(metadataPayload) as Array<Record<string, unknown>>;
  assert.equal(metadata.length, 2);
  assert.equal(metadata[0]?.sourceStage, 'intake');
  assert.equal(metadata[0]?.includedInListing, false);
  assert.deepEqual(result, {
    formId: 'form-abc',
    submissionId: 'sub-123',
    items: [{ recordId: 'rec-new-1', submissionId: 'sub-123-slot1', action: 'created', imageCount: 2 }],
  });
});

test('workflowIngest updates an existing pending-review row and replaces intake metadata', async () => {
  const updateCalls: Array<{ recordId: string; fields: Record<string, unknown> }> = [];
  const existingMetadata = JSON.stringify([
    {
      attachmentId: 'old-intake',
      url: 'https://drive.google.com/uc?export=view&id=old-intake',
      filename: 'old-intake.jpg',
      alt: '',
      sortOrder: 1,
      sourceStage: 'intake',
      includedInListing: false,
    },
    {
      attachmentId: 'testing-1',
      url: 'https://drive.google.com/uc?export=view&id=testing-1',
      filename: 'testing.jpg',
      alt: '',
      sortOrder: 2,
      sourceStage: 'testing',
      includedInListing: true,
    },
  ]);

  const ingest = createIngestJotFormSubmissionWorkflow({
    getSubmission: async () => buildSubmission(),
    getConfiguredRecords: async () => [buildRecord('rec-existing-1', {
      'JotForm Submission ID': 'sub-123-slot1',
      'Workflow Status': 'Pending Review',
      'Workflow Image Metadata JSON': existingMetadata,
    })],
    createConfiguredRecord: async () => {
      throw new Error('createConfiguredRecord should not be called for existing rows');
    },
    updateConfiguredRecord: async (_source, recordId, fields) => {
      updateCalls.push({ recordId, fields });
      return buildRecord(recordId, fields);
    },
    archiveIntakeImagesForRecord: async () => [
      { id: 'drive-new', url: 'https://drive.google.com/uc?export=view&id=drive-new', filename: 'new-intake.jpg' },
    ],
  });

  const result = await ingest('form-abc', 'sub-123');

  assert.equal(updateCalls.length, 2);
  assert.equal(updateCalls[0]?.recordId, 'rec-existing-1');
  assert.equal(updateCalls[0]?.fields['Workflow Status'], 'Pending Review');
  assert.equal(updateCalls[0]?.fields['Item Title'], 'McIntosh MC275 - existing-1');
  const metadataPayload = String(updateCalls[1]?.fields['Workflow Image Metadata JSON'] || '');
  const metadata = JSON.parse(metadataPayload) as Array<Record<string, unknown>>;
  assert.equal(metadata.length, 2);
  assert.equal(metadata[0]?.attachmentId, 'drive-new');
  assert.equal(metadata[0]?.sourceStage, 'intake');
  assert.equal(metadata[1]?.attachmentId, 'testing-1');
  assert.equal(metadata[1]?.sourceStage, 'testing');
  assert.deepEqual(result, {
    formId: 'form-abc',
    submissionId: 'sub-123',
    items: [{ recordId: 'rec-existing-1', submissionId: 'sub-123-slot1', action: 'updated', imageCount: 2 }],
  });
});

test('workflowIngest skips rows that have already advanced beyond pending review', async () => {
  let archiveCalled = false;
  let createCalled = false;
  let updateCalled = false;

  const ingest = createIngestJotFormSubmissionWorkflow({
    getSubmission: async () => buildSubmission(),
    getConfiguredRecords: async () => [buildRecord('rec-existing-2', {
      'JotForm Submission ID': 'sub-123-slot1',
      'Workflow Status': 'Testing In Progress',
    })],
    createConfiguredRecord: async () => {
      createCalled = true;
      return buildRecord('rec-unexpected', {});
    },
    updateConfiguredRecord: async () => {
      updateCalled = true;
      return buildRecord('rec-unexpected', {});
    },
    archiveIntakeImagesForRecord: async () => {
      archiveCalled = true;
      return [];
    },
  });

  const result = await ingest('form-abc', 'sub-123');

  assert.equal(createCalled, false);
  assert.equal(updateCalled, false);
  assert.equal(archiveCalled, false);
  assert.deepEqual(result, {
    formId: 'form-abc',
    submissionId: 'sub-123',
    items: [{ recordId: 'rec-existing-2', submissionId: 'sub-123-slot1', action: 'skipped', imageCount: 2 }],
  });
});