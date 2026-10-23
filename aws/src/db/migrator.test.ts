import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyMigrations, checksumOf, loadMigrations, type MigrationClient } from './migrator.js';

async function makeDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'migrations-'));
  for (const [name, sql] of Object.entries(files)) await writeFile(path.join(dir, name), sql);
  return dir;
}

function fakeClient(recorded: Array<{ version: string; checksum: string }> = []) {
  const calls: string[] = [];
  const client: MigrationClient = {
    async query(text) {
      calls.push(text.trim().split(/\s+/).slice(0, 2).join(' '));
      if (text.includes('FROM schema_migrations')) return { rows: recorded };
      return { rows: [] };
    },
  };
  return { client, calls };
}

test('loadMigrations sorts by version and computes checksums', async () => {
  const dir = await makeDir({ '0002_b.sql': 'select 2', '0001_a.sql': 'select 1' });
  const migrations = await loadMigrations(dir);
  assert.deepEqual(migrations.map((m) => m.version), ['0001', '0002']);
  assert.equal(migrations[0].checksum, checksumOf('select 1'));
});

test('loadMigrations rejects badly named files', async () => {
  const dir = await makeDir({ 'init.sql': 'select 1' });
  await assert.rejects(loadMigrations(dir), /Invalid migration file name/);
});

test('applyMigrations skips applied versions and applies new ones in a transaction', async () => {
  const dir = await makeDir({ '0001_a.sql': 'select 1', '0002_b.sql': 'select 2' });
  const migrations = await loadMigrations(dir);
  const { client, calls } = fakeClient([{ version: '0001', checksum: migrations[0].checksum }]);
  const result = await applyMigrations(client, migrations);
  assert.deepEqual(result, { applied: ['0002'], skipped: ['0001'] });
  assert.ok(calls.includes('BEGIN') && calls.includes('COMMIT'));
});

test('applyMigrations refuses a migration edited after it was applied', async () => {
  const dir = await makeDir({ '0001_a.sql': 'select 1' });
  const migrations = await loadMigrations(dir);
  const { client } = fakeClient([{ version: '0001', checksum: 'different' }]);
  await assert.rejects(applyMigrations(client, migrations), /changed after it was applied/);
});
