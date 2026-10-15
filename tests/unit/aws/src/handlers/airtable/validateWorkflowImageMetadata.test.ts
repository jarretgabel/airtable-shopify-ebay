import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectConfiguredWorkflowImageMetadata,
  validateConfiguredWorkflowImageMetadata,
  validateWorkflowImageMetadataRecords,
} from '../../../../../../aws/src/providers/airtable/workflowImageMetadataValidation.js';

test('validateWorkflowImageMetadataRecords retains supported image bytes and drops invalid formats', async () => {
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const result = await validateWorkflowImageMetadataRecords(
    [
      { url: 'https://drive.google.com/file/d/valid-image/view', filename: 'valid.jpg' },
      { url: 'https://drive.google.com/file/d/html-file/view', filename: 'invalid.jpg' },
      { url: 'https://example.com/not-a-drive-image.jpg', filename: 'external.jpg' },
    ],
    async (fileId) => ({
      bytes: fileId === 'valid-image' || fileId === 'attachment-image'
        ? jpegBytes
        : Buffer.from('<html>not an image</html>'),
      contentType: 'image/jpeg',
    }),
    ['https://drive.google.com/uc?export=view&id=attachment-image'],
  );

  assert.equal(result.removedCount, 2);
  assert.deepEqual(result.validImageUrls, [
    'https://drive.google.com/file/d/valid-image/view',
    'https://drive.google.com/uc?export=view&id=attachment-image',
  ]);
  assert.deepEqual(JSON.parse(result.metadataJson), [
    { url: 'https://drive.google.com/file/d/valid-image/view', filename: 'valid.jpg' },
  ]);
});

test('validateWorkflowImageMetadataRecords propagates Drive access failures without removing metadata', async () => {
  await assert.rejects(
    validateWorkflowImageMetadataRecords(
      [{ url: 'https://drive.google.com/file/d/private-image/view', filename: 'private.jpg' }],
      async () => {
        throw new Error('Drive access unavailable');
      },
    ),
    /Drive access unavailable/,
  );
});

const mixedMetadata = [
  { url: 'https://drive.google.com/file/d/valid-image/view', annotation: 'keep' },
  { url: 'https://drive.google.com/file/d/invalid-image/view', includedInListing: true },
  { url: 'https://example.com/external.jpg' },
];

const getRecord = async () => ({
  id: 'rec-images',
  createdTime: '',
  fields: { 'Workflow Image Metadata JSON': JSON.stringify(mixedMetadata) },
});

const downloadFileHeader = async (fileId: string) => ({
  bytes: fileId === 'valid-image'
    ? Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    : Buffer.from('<html>not an image</html>'),
  contentType: 'image/jpeg',
});

test('inspection reports unsupported sources without writing or returning replacement metadata', async () => {
  let writes = 0;
  const result = await inspectConfiguredWorkflowImageMetadata('rec-images', {
    getRecord,
    downloadFileHeader,
    updateRecord: async () => {
      writes += 1;
      throw new Error('Inspection must never write');
    },
  });

  assert.deepEqual(result, {
    validImageUrls: [mixedMetadata[0].url],
    invalidImageUrls: [mixedMetadata[1].url, mixedMetadata[2].url],
  });
  assert.equal(writes, 0);
});

test('legacy validation still performs its explicit cleanup write', async () => {
  const writes: unknown[] = [];
  const result = await validateConfiguredWorkflowImageMetadata('rec-images', {
    getRecord,
    downloadFileHeader,
    updateRecord: async (_source, _id, fields) => {
      writes.push(fields);
      return { id: 'rec-images', fields, createdTime: '' };
    },
  });
  assert.equal(result.removedCount, 2);
  assert.deepEqual(writes, [{ 'Workflow Image Metadata JSON': JSON.stringify([mixedMetadata[0]]) }]);
});

test('inspection propagates access errors and malformed metadata without writing', async () => {
  const updateRecord = async () => {
    assert.fail('Inspection must never write');
  };
  await assert.rejects(inspectConfiguredWorkflowImageMetadata('rec-images', {
    getRecord,
    updateRecord,
    downloadFileHeader: async () => { throw new Error('Drive temporarily unavailable'); },
  }), /Drive temporarily unavailable/);
  await assert.rejects(inspectConfiguredWorkflowImageMetadata('rec-images', {
    getRecord: async () => ({ id: 'rec-images', createdTime: '', fields: { 'Workflow Image Metadata JSON': '{' } }),
    updateRecord,
  }), /not valid JSON/);
});
