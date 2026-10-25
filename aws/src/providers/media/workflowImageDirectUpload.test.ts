import assert from 'node:assert/strict';
import test from 'node:test';
import type { MediaStore } from './mediaStore.js';
import { finalizeWorkflowImageUpload, presignWorkflowImageUpload } from './workflowImageDirectUpload.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function fakeMedia(objects: Record<string, Buffer> = {}): MediaStore {
  return {
    async put() {},
    async header(key) { return objects[key] ?? null; },
    async signedPutUrl(key, type) { return `https://put.test/${key}?type=${type}`; },
    async signedUrl() { return 'signed'; },
    publicUrl(key) { return `https://api.test/api/media/${key}`; },
  };
}

test('presign issues keys matching the server-side archive and rejects bad input', async () => {
  const media = fakeMedia();
  const uploads = await presignWorkflowImageUpload({
    recordKey: 'rec1', stage: 'photos',
    files: [
      { variant: 'processed', filename: 'Front View.jpg', contentType: 'image/jpeg', size: 1000 },
      { variant: 'original', filename: 'Front View.jpg', contentType: 'image/jpeg', size: 5000 },
    ],
  }, media);
  assert.equal(uploads[0].key, 'used-gear-workflow/rec1/photos/photos--Front-View.jpg');
  assert.equal(uploads[1].key, 'used-gear-workflow/rec1/photos/photos--Front-View--original.jpg');
  const base = { recordKey: 'rec1', stage: 'photos' };
  await assert.rejects(presignWorkflowImageUpload({ ...base, files: [] }, media));
  await assert.rejects(presignWorkflowImageUpload({ ...base, stage: 'x', files: [{ variant: 'processed', filename: 'a.jpg', contentType: 'image/jpeg', size: 1 }] }, media));
  await assert.rejects(presignWorkflowImageUpload({ ...base, files: [{ variant: 'processed', filename: 'a.html', contentType: 'text/html', size: 1 }] }, media));
  await assert.rejects(presignWorkflowImageUpload({ ...base, files: [{ variant: 'processed', filename: 'a.jpg', contentType: 'image/jpeg', size: 99 * 1024 * 1024 }] }, media));
});

test('finalize checks the objects are images under the record prefix', async () => {
  const key = 'used-gear-workflow/rec1/photos/photos--a.png';
  const media = fakeMedia({ [key]: PNG, 'used-gear-workflow/rec1/photos/photos--b.png': Buffer.from('<html>') });
  const result = await finalizeWorkflowImageUpload({ recordKey: 'rec1', stage: 'photos', processedKey: key }, media);
  assert.equal(result.processed.url, `https://api.test/api/media/${key}`);
  assert.equal(result.original.id, key);
  assert.equal(result.folderId, 'used-gear-workflow/rec1');
  await assert.rejects(finalizeWorkflowImageUpload({ recordKey: 'rec1', stage: 'photos', processedKey: 'used-gear-workflow/rec1/photos/photos--b.png' }, media));
  await assert.rejects(finalizeWorkflowImageUpload({ recordKey: 'rec1', stage: 'photos', processedKey: 'used-gear-workflow/rec2/photos/photos--a.png' }, media));
  await assert.rejects(finalizeWorkflowImageUpload({ recordKey: 'rec1', stage: 'photos', processedKey: 'used-gear-workflow/rec1/photos/missing.png' }, media));
});
