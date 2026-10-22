// Phase 0 throwaway: READ-ONLY Airtable snapshot (schema, records, counts). GET requests only.
// Usage: AIRTABLE_READ_TOKEN=pat... node scripts/phase0-airtable-snapshot.mjs [baseId ...]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const token = process.env.AIRTABLE_READ_TOKEN;
if (!token) throw new Error('Set AIRTABLE_READ_TOKEN (a read-only PAT).');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) { await sleep(30_000); continue; }
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${await res.text()}`);
    await sleep(250);
    return res.json();
  }
  throw new Error(`GET ${url} rate limited repeatedly`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join('backups', `airtable-${stamp}`);
await mkdir(outDir, { recursive: true });

let baseIds = process.argv.slice(2);
if (baseIds.length === 0) {
  const { bases } = await get('https://api.airtable.com/v0/meta/bases');
  baseIds = bases.map((b) => b.id);
}

const summary = [];
for (const baseId of baseIds) {
  const { tables } = await get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`);
  await mkdir(path.join(outDir, baseId), { recursive: true });
  await writeFile(path.join(outDir, baseId, '_schema.json'), JSON.stringify(tables, null, 2));

  for (const table of tables) {
    const records = [];
    let offset;
    do {
      const qs = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'false' });
      if (offset) qs.set('offset', offset);
      const page = await get(`https://api.airtable.com/v0/${baseId}/${table.id}?${qs}`);
      records.push(...page.records);
      offset = page.offset;
    } while (offset);

    await writeFile(path.join(outDir, baseId, `${table.id}.json`), JSON.stringify(records, null, 2));
    const types = {};
    for (const f of table.fields) types[f.type] = (types[f.type] ?? 0) + 1;
    summary.push({ baseId, tableId: table.id, table: table.name, views: table.views?.length ?? 0, fields: table.fields.length, records: records.length, fieldTypes: types });
    console.log(`${baseId} ${table.id} ${table.name}: ${records.length} records, ${table.fields.length} fields`);
  }
}
await writeFile(path.join(outDir, '_summary.json'), JSON.stringify(summary, null, 2));
console.log(`Wrote ${outDir}`);
