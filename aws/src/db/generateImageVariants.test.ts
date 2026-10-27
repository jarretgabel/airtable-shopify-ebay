import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { generateImageVariants } from './generateImageVariants.js';
import type { MediaStore } from '../providers/media/mediaStore.js';

test('creates only the missing variants and leaves existing ones alone', async () => {
  const objects = new Map<string, Buffer>([
    ['used-gear-workflow/r1/photos/photos--a.jpg', Buffer.from('big')],
    ['variants/w400/used-gear-workflow/r1/photos/photos--a.jpg', Buffer.from('old')],
  ]);
  const media = {
    async put(key: string, body: Buffer) { objects.set(key, body); },
    async header(key: string) { return objects.get(key) ?? null; },
    async get(key: string) { return objects.get(key) ?? null; },
  } as unknown as MediaStore;
  const client = { query: async () => ({ rows: [{ s3_key: 'used-gear-workflow/r1/photos/photos--a.jpg' }] }) } as unknown as Pick<Pool, 'query'>;
  const resize = async (_: Buffer, width: number) => Buffer.from(`w${width}`);

  const dry = await generateImageVariants({ client, baseId: 'b', media, resize, apply: false });
  assert.deepEqual([dry.created, dry.skipped], [1, 1]);
  assert.equal(objects.has('variants/w800/used-gear-workflow/r1/photos/photos--a.jpg'), false);

  const real = await generateImageVariants({ client, baseId: 'b', media, resize, apply: true });
  assert.deepEqual([real.created, real.skipped, real.failed], [1, 1, 0]);
  assert.equal(objects.get('variants/w800/used-gear-workflow/r1/photos/photos--a.jpg')?.toString(), 'w800');
  assert.equal(objects.get('variants/w400/used-gear-workflow/r1/photos/photos--a.jpg')?.toString(), 'old');
});
