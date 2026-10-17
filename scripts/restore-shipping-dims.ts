import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { getConfiguredRecords, updateConfiguredRecord } from '../aws/src/providers/airtable/sources.js';
import { planShippingRestore, type ShippingOriginal } from '../aws/src/shared/contracts/shippingDimsCleanup.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('VITE_AIRTABLE_') && !process.env[key.replace('VITE_', '')]) process.env[key.replace('VITE_', '')] = value;
}

// Usage: npm run airtable:restore-shipping-dims -- <backup.json> [--apply]
// Without --apply it only reports. A record is restored only if it still holds exactly what the cleanup wrote;
// records edited since are left alone and listed.
const SOURCE = 'used-gear-workflow';
const WRITE_DELAY_MS = 250;
const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const apply = process.argv.includes('--apply');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  if (!file) throw new Error('Usage: npm run airtable:restore-shipping-dims -- <backup.json> [--apply]');
  const originals = JSON.parse(readFileSync(file, 'utf8')) as Array<ShippingOriginal & { id: string }>;
  const wanted = new Set(originals.map((original) => original.id));
  const current = new Map((await getConfiguredRecords(SOURCE, { fields: ['Weight', 'Shipping Weight', 'Shipping Dims'] }))
    .filter((record) => wanted.has(record.id))
    .map((record) => [record.id, record.fields]));

  const counts = { restore: 0, 'already-original': 0, 'changed-since-cleanup': 0, missing: 0 };
  const changed: string[] = [];
  let restored = 0;

  for (const original of originals) {
    const fields = current.get(original.id);
    if (!fields) { counts.missing += 1; continue; }
    const plan = planShippingRestore(original, fields);
    if (plan.kind === 'skip') {
      counts[plan.reason] += 1;
      if (plan.reason === 'changed-since-cleanup') changed.push(original.id);
      continue;
    }

    counts.restore += 1;
    if (!apply) continue;
    const saved = await updateConfiguredRecord(SOURCE, original.id, plan.fields);
    for (const [name, value] of Object.entries(plan.fields)) {
      if (String(saved.fields[name] ?? '') !== value) throw new Error(`Verification failed on ${original.id}: ${name} did not match after restore.`);
    }
    restored += 1;
    await sleep(WRITE_DELAY_MS);
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'report', backupRecords: originals.length, ...counts, restoredAndVerified: restored }, null, 2));
  if (changed.length > 0) console.log(`Edited since the cleanup (left alone): ${changed.join(', ')}`);
  if (!apply) console.log('Report only: nothing was written. Add --apply to restore.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
