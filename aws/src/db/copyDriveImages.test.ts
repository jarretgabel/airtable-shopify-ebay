import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { copyDriveImages, isHeic } from './copyDriveImages.js';

const url = process.env.POSTGRES_TEST_URL;

test('isHeic detects by content type, extension or ftyp brand', () => {
  assert.equal(isHeic(Buffer.alloc(4), 'image/heif', 'a.jpg'), true);
  assert.equal(isHeic(Buffer.alloc(4), null, 'IMG_1.HEIC'), true);
  assert.equal(isHeic(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic')]), null, 'x'), true);
  assert.equal(isHeic(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'image/jpeg', 'a.jpg'), false);
});

test('copyDriveImages: copies, converts HEIC, skips html, repoints metadata, is idempotent', { skip: !url }, async () => {
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  const schema = `cdi_${randomBytes(4).toString('hex')}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE records (base_id text, table_id text, record_id text, fields jsonb NOT NULL, deleted_at timestamptz)`);
    await client.query(`CREATE TABLE workflow_images (LIKE public.workflow_images INCLUDING DEFAULTS)`);
    const drive = (id: string) => `https://drive.google.com/uc?export=view&id=${id}`;
    const entries = [
      { url: drive('fileaaaaaaaa1'), filename: 'front.jpg', sourceStage: 'photos', sortOrder: 0, includedInListing: true },
      { url: drive('filebbbbbbbb2'), filename: 'IMG_1.HEIC', sourceStage: 'intake', sortOrder: 1 },
      { url: drive('filecccccccc3'), filename: 'note--original', sourceStage: 'photos', sortOrder: 2 },
    ];
    await client.query(`INSERT INTO records VALUES ('b', 't', 'rec1', $1::jsonb)`, [JSON.stringify({ SKU: '9', 'Workflow Image Metadata JSON': JSON.stringify(entries) })]);
    await client.query(`INSERT INTO workflow_images (base_id, record_id, url, stage) VALUES ('b', 'rec1', $1, 'photos'), ('b', 'rec1', $2, 'intake'), ('b', 'rec1', $3, 'photos')`, entries.map((e) => e.url));

    const puts = new Map<string, string>();
    const media = {
      put: async (key: string, _body: Buffer, type: string) => { puts.set(key, type); },
      publicUrl: (key: string) => `https://api.test/api/media/${key}`,
    } as never;
    const files: Record<string, Buffer> = {
      fileaaaaaaaa1: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      filebbbbbbbb2: Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic')]),
      filecccccccc3: Buffer.from('<html>placeholder</html>'),
    };
    const run = (apply: boolean) => copyDriveImages({
      client: client as never, baseId: 'b', media, apply,
      download: async (id) => ({ bytes: files[id], contentType: null }),
      convertHeic: async () => Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
    });

    const dry = await run(false);
    assert.deepEqual([dry.records, dry.images, dry.copied, puts.size], [1, 3, 0, 0]);

    const done = await run(true);
    assert.deepEqual([done.copied, done.converted, done.skipped, done.failed], [2, 1, 1, 0]);
    assert.deepEqual([...puts.keys()].sort(), [
      'used-gear-workflow/rec1/intake/filebbbbbbbb2-IMG_1.HEIC',
      'used-gear-workflow/rec1/intake/filebbbbbbbb2-IMG_1.jpg',
      'used-gear-workflow/rec1/photos/fileaaaaaaaa1-front.jpg',
    ]);

    const row = await client.query(`SELECT fields FROM records`);
    const next = JSON.parse(row.rows[0].fields['Workflow Image Metadata JSON']) as Array<Record<string, string>>;
    assert.equal(next[0].url, 'https://api.test/api/media/used-gear-workflow/rec1/photos/fileaaaaaaaa1-front.jpg');
    assert.equal(next[0].legacyUrl, drive('fileaaaaaaaa1'));
    assert.equal(next[1].filename, 'IMG_1.jpg');
    assert.equal(next[2].url, drive('filecccccccc3'));
    assert.equal(row.rows[0].fields.SKU, '9');
    const table = await client.query(`SELECT url, s3_key, legacy_url FROM workflow_images ORDER BY sort_order`);
    assert.equal(table.rows[0].s3_key, 'used-gear-workflow/rec1/photos/fileaaaaaaaa1-front.jpg');
    assert.equal(table.rows[0].legacy_url, drive('fileaaaaaaaa1'));

    puts.clear();
    const again = await run(true);
    assert.deepEqual([again.images, again.copied], [1, 0]);
    assert.equal(puts.size, 0);
  } finally {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    client.release();
    await pool.end();
  }
});
