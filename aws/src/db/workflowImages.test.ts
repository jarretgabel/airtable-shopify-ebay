import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleWorkflowImageMetadata, parseWorkflowImageRows } from './workflowImages.js';

const entry = {
  attachmentId: 'a1',
  url: 'https://api.test/api/media/used-gear-workflow/rec1/photos/photos--a.jpg',
  filename: 'a.jpg',
  alt: 'Front',
  imageRole: 'front',
  sortOrder: 2,
  sourceStage: 'photos',
  includedInListing: true,
  ebayHostedImageCache: { url: 'https://i.ebayimg.com/x.jpg', sha256: 'abc' },
  legacyUrl: 'https://drive.google.com/uc?export=view&id=1',
};

test('metadata JSON round-trips through rows, sorted by sortOrder', () => {
  const second = { ...entry, url: 'https://drive.google.com/uc?export=view&id=2', sortOrder: 1, attachmentId: undefined, ebayHostedImageCache: undefined, legacyUrl: undefined };
  const rows = parseWorkflowImageRows(JSON.stringify([entry, second]));
  assert.equal(rows[0].s3Key, 'used-gear-workflow/rec1/photos/photos--a.jpg');
  assert.equal(rows[1].s3Key, null);
  const out = JSON.parse(assembleWorkflowImageMetadata(rows));
  assert.deepEqual(out.map((o: { url: string }) => o.url), [second.url, entry.url]);
  assert.deepEqual(out[1], entry);
});

test('drops entries without url and duplicates, defaults bad stage', () => {
  const rows = parseWorkflowImageRows([{ filename: 'x' }, { url: 'u', sourceStage: 'weird' }, { url: 'u' }, 'junk']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stage, 'photos');
  assert.deepEqual(parseWorkflowImageRows('not json'), []);
});
