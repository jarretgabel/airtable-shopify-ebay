import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflowImageMetadataRecords } from '../../../../../../aws/src/providers/airtable/workflowImageMetadataValidation.js';

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
