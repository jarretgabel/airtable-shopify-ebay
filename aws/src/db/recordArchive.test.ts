import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { archiveRecords, restoreArchivedRecords } from './recordArchive.js';
import { syncWorkflowImages } from './workflowImages.js';

const url = process.env.POSTGRES_TEST_URL;

test('archive: moves only old untouched Shipped rows, keeps SKU/images consistent, restore reverses it', { skip: !url }, async () => {
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  const schema = `arc_${randomBytes(4).toString('hex')}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE records (base_id text, table_id text, record_id text, fields jsonb NOT NULL, airtable_created_at timestamptz,
      synced_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, airtable_record_id text,
      workflow_status text GENERATED ALWAYS AS (fields->>'Workflow Status') STORED, sku text GENERATED ALWAYS AS (fields->>'SKU') STORED)`);
    await client.query(`CREATE TABLE audit_log (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), base_id text, table_id text, record_id text)`);
    await client.query(`CREATE TABLE write_outbox (id bigserial PRIMARY KEY, base_id text, table_id text, record_id text, status text)`);
    await client.query(`CREATE TABLE workflow_images (LIKE public.workflow_images INCLUDING DEFAULTS)`);
    const migration = (await import('node:fs')).readFileSync(new URL('../../db/migrations/0012_fk_and_archive.sql', import.meta.url), 'utf8');
    await client.query(migration);

    const old = "now() - interval '400 days'";
    const meta = JSON.stringify([{ url: 'https://x/api/media/used-gear-workflow/old/a.jpg', filename: 'a.jpg', sourceStage: 'photos' }]);
    const add = (id: string, status: string, sku: string, synced = old) => client.query(
      `INSERT INTO records (base_id, table_id, record_id, fields, synced_at) VALUES ('b','t',$1,$2::jsonb,${synced})`,
      [id, JSON.stringify({ 'Workflow Status': status, SKU: sku, 'Workflow Image Metadata JSON': meta })]);
    await add('old', 'Shipped', '1');
    await add('recent', 'Shipped', '2', 'now()');
    await add('touched', 'Shipped', '3');
    await add('listed', 'Listed, Shopify', '4');
    await add('queued', 'Shipped', '5');
    await client.query(`INSERT INTO audit_log (base_id, table_id, record_id) VALUES ('b','t','touched')`);
    await client.query(`INSERT INTO write_outbox (base_id, table_id, record_id, status) VALUES ('b','t','queued','pending')`);
    await syncWorkflowImages(client, 'b', 'old', meta);

    // The foreign key rejects images for a record that does not exist.
    await assert.rejects(syncWorkflowImages(client, 'b', 'ghost', meta), /workflow_images_record_fk/);

    const opts = { baseId: 'b', tableId: 't', days: 365 };
    assert.deepEqual(await archiveRecords(client, { ...opts, apply: false }), { eligible: 1, moved: 0 });
    assert.deepEqual(await archiveRecords(client, { ...opts, apply: true }), { eligible: 1, moved: 1 });

    const live = await client.query(`SELECT record_id FROM records ORDER BY 1`);
    assert.deepEqual(live.rows.map((r) => r.record_id), ['listed', 'queued', 'recent', 'touched']);
    const archived = await client.query(`SELECT record_id, sku, fields->>'Workflow Status' s FROM records_archive`);
    assert.deepEqual(archived.rows, [{ record_id: 'old', sku: '1', s: 'Shipped' }]);
    assert.equal((await client.query(`SELECT 1 FROM workflow_images WHERE record_id = 'old'`)).rowCount, 0);

    assert.equal(await restoreArchivedRecords(client, { baseId: 'b', tableId: 't' }, syncWorkflowImages as never), 1);
    assert.equal((await client.query(`SELECT 1 FROM records_archive`)).rowCount, 0);
    const back = await client.query(`SELECT sku, workflow_status FROM records WHERE record_id = 'old'`);
    assert.deepEqual(back.rows, [{ sku: '1', workflow_status: 'Shipped' }]);
    assert.equal((await client.query(`SELECT 1 FROM workflow_images WHERE record_id = 'old'`)).rowCount, 1);
  } finally {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    client.release();
    await pool.end();
  }
});
