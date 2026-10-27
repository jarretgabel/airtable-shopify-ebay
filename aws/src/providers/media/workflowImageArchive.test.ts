import { downloadWorkflowImageHeader, getWorkflowImageId } from './workflowImageArchive.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveWorkflowImagesToS3 } from './workflowImageArchive.js';
import type { MediaStore } from './mediaStore.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function fakeMedia() {
  const puts = new Map<string, { size: number; contentType: string }>();
  const media: MediaStore = {
    async put(key, body, contentType) { puts.set(key, { size: body.length, contentType }); },
    async header(key) { return key.endsWith('.png') ? Buffer.from(PNG, 'base64') : Buffer.from('<html>'); },
    async signedUrl() { return 'signed'; },
    async get(key) { return null; },
    async copy() {},
    async signedPutUrl(key) { return `https://put.example/${key}`; },
    publicUrl(key) { return `https://api.test/api/media/${key}`; },
  };
  return { media, puts };
}

test('archives original and processed to stable S3 keys', async () => {
  const { media, puts } = fakeMedia();
  const result = await archiveWorkflowImagesToS3({
    folderKey: 'rec123',
    stage: 'photos',
    original: { filename: 'My Photo (1).png', contentType: 'image/png', file: PNG },
    processed: { filename: 'My Photo (1).png', contentType: 'image/png', file: PNG },
  }, media);

  assert.equal(result.folderId, 'used-gear-workflow/rec123');
  assert.equal(result.processed.id, 'used-gear-workflow/rec123/photos/photos--My-Photo-1.png');
  assert.equal(result.original.filename, 'photos--My-Photo-1--original.png');
  assert.equal(result.processed.url, 'https://api.test/api/media/used-gear-workflow/rec123/photos/photos--My-Photo-1.png');
  assert.deepEqual([...puts.values()].map((p) => p.contentType), ['image/png', 'image/png']);

  await archiveWorkflowImagesToS3({
    folderKey: 'rec123', stage: 'photos',
    original: { filename: 'My Photo (1).png', contentType: 'image/png', file: PNG },
    processed: { filename: 'My Photo (1).png', contentType: 'image/png', file: PNG },
  }, media);
  assert.equal(puts.size, 2, 're-upload replaces the same keys');
});

test('rejects files that are not images', async () => {
  const { media, puts } = fakeMedia();
  await assert.rejects(
    archiveWorkflowImagesToS3({
      folderKey: 'rec123', stage: 'intake',
      original: { filename: 'a.jpg', contentType: 'image/jpeg', file: Buffer.from('<html>').toString('base64') },
      processed: { filename: 'a.jpg', contentType: 'image/jpeg', file: Buffer.from('<html>').toString('base64') },
    }, media),
    /not a supported image/,
  );
  assert.equal(puts.size, 0);
});

test('hosted workflow image ids resolve and header-check via the media store', async () => {
  const { media } = fakeMedia();
  const key = 'used-gear-workflow/rec1/photos/photos--a.png';
  assert.equal(getWorkflowImageId(`https://api.test/api/media/${key}`), key);
  assert.equal(getWorkflowImageId('https://example.com/x.png'), '');
  const ok = await downloadWorkflowImageHeader(key, media);
  assert.ok(ok.bytes.length > 0);
  const bad = await downloadWorkflowImageHeader('used-gear-workflow/rec1/photos/photos--a.jpg', media);
  assert.ok(bad.bytes.toString().startsWith('<html'));
});
