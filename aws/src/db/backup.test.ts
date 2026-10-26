import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { exportBackup, restoreBackup, type BackupStore } from './backup.js';

const url = process.env.POSTGRES_TEST_URL;

function memoryStore(): BackupStore & { keys: () => string[] } {
  const map = new Map<string, Buffer>();
  return {
    async put(key, body) { map.set(key, body); },
    async get(key) { const v = map.get(key); if (!v) throw new Error(`missing ${key}`); return v; },
    keys: () => [...map.keys()],
  };
}

test('backup: export then restore into a fresh schema reproduces rows, generated columns and sequences', { skip: !url }, async () => {
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  const schema = `bk_${randomBytes(4).toString('hex')}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    const ddl = `CREATE TABLE records (id text PRIMARY KEY, fields jsonb NOT NULL, sku text GENERATED ALWAYS AS (fields->>'SKU') STORED);
                 CREATE TABLE audit_log (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), note text);
                 CREATE TABLE a_child (id int PRIMARY KEY, rec text NOT NULL REFERENCES records(id))`;
    await client.query(ddl);
    await client.query(`INSERT INTO records VALUES ('a', '{"SKU":"1","x":"it''s"}'), ('b', '{"n":[1,2]}')`);
    await client.query(`INSERT INTO audit_log (note) VALUES ('one'), ('two')`);
    await client.query(`INSERT INTO a_child VALUES (1, 'a')`);

    const view = { query: ((text: string, values?: unknown[]) => client.query(text, values as never)) as never };
    const store = memoryStore();
    const manifest = await exportBackup(view, store, 'postgres/test/');
    assert.deepEqual(manifest.tables, { a_child: 1, audit_log: 2, records: 2 });
    assert.ok(store.keys().includes('postgres/test/manifest.json'));

    await client.query(`DROP TABLE a_child; DROP TABLE records; DROP TABLE audit_log;`);
    await client.query(ddl);
    await restoreBackup(view, store, 'postgres/test/');

    const restored = await client.query(`SELECT id, sku, fields FROM records ORDER BY id`);
    assert.deepEqual(restored.rows.map((r) => [r.id, r.sku]), [['a', '1'], ['b', null]]);
    assert.equal(restored.rows[0].fields.x, "it's");
    const next = await client.query(`INSERT INTO audit_log (note) VALUES ('three') RETURNING id`);
    assert.equal(Number(next.rows[0].id), 3);

    await assert.rejects(restoreBackup(view, store, 'postgres/test/'), /not empty/);
  } finally {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    client.release();
    await pool.end();
  }
});
