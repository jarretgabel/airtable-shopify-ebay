import dotenv from 'dotenv';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { getConfiguredRecords, updateConfiguredRecord } from '../aws/src/providers/airtable/sources.js';
import { planShippingRecord } from '../aws/src/shared/contracts/shippingDimsCleanup.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('VITE_AIRTABLE_') && !process.env[key.replace('VITE_', '')]) process.env[key.replace('VITE_', '')] = value;
}

// Usage (default is a read-only report):
//   npm run airtable:clean-shipping-dims                          report only, writes tmp/shipping-dims-report-*.csv
//   npm run airtable:clean-shipping-dims -- --apply --limit 5     canary: write the first 5 planned updates
//   npm run airtable:clean-shipping-dims -- --apply               write all planned updates
//   npm run airtable:restore-shipping-dims -- <backup> [--apply]  undo (report-only unless --apply)
const SOURCE = 'used-gear-workflow';
const FIELDS = ['Weight', 'Shipping Weight', 'Shipping Dims'];
const WRITE_DELAY_MS = 250;
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Original = { id: string; Weight: string | null; 'Shipping Weight': string | null; 'Shipping Dims': string | null };

async function write(id: string, fields: Record<string, string | null>, expected: Record<string, string>): Promise<void> {
  const saved = await updateConfiguredRecord(SOURCE, id, fields);
  for (const [name, value] of Object.entries(expected)) {
    const actual = String(saved.fields[name] ?? '');
    if (actual !== value) throw new Error(`Verification failed on ${id}: ${name} is "${actual}", expected "${value}".`);
  }
}

async function main(): Promise<void> {
  const records = await getConfiguredRecords(SOURCE, { fields: FIELDS });
  const counts: Record<string, number> = {};
  const rows: string[] = ['recordId,action,reason,originalDims,existingWeight,existingShippingWeight,newWeight,newDims'];
  const updates: Array<{ id: string; fields: Record<string, string>; original: Original }> = [];
  const reviewSamples: string[] = [];

  const freeTextWeights: string[] = [];
  for (const record of records) {
    const f = record.fields;
    const plan = planShippingRecord(f);
    const hasUpdate = Object.keys(plan.fields).length > 0;
    const key = hasUpdate
      ? (plan.dims.kind === 'update' ? 'update:split-dimensions' : 'update:weight-format-only')
      : plan.dims.kind === 'review' ? `review:${plan.dims.reason}` : `skip:${plan.dims.kind === 'skip' ? plan.dims.reason : 'none'}`;
    counts[key] = (counts[key] ?? 0) + 1;
    const original: Original = {
      id: record.id,
      Weight: typeof f.Weight === 'string' ? f.Weight : null,
      'Shipping Weight': typeof f['Shipping Weight'] === 'string' ? f['Shipping Weight'] : null,
      'Shipping Dims': typeof f['Shipping Dims'] === 'string' ? f['Shipping Dims'] : null,
    };
    if (hasUpdate) updates.push({ id: record.id, fields: plan.fields, original });
    if (plan.dims.kind === 'review' && reviewSamples.length < 25) reviewSamples.push(`${plan.dims.reason.padEnd(18)} ${JSON.stringify(original['Shipping Dims'])}`);
    plan.weightFreeText.forEach((name) => freeTextWeights.push(`${record.id} ${name}: ${JSON.stringify(f[name])}`));
    if (hasUpdate || plan.dims.kind === 'review') {
      rows.push([record.id, hasUpdate ? 'update' : 'review', plan.dims.kind === 'review' ? plan.dims.reason : '', original['Shipping Dims'], original.Weight, original['Shipping Weight'],
        plan.fields.Weight ?? '', plan.fields['Shipping Dims'] ?? ''].map(csv).join(','));
    }
  }
  counts['weights-left-as-free-text'] = freeTextWeights.length;

  mkdirSync('tmp', { recursive: true });
  const reportPath = `tmp/shipping-dims-report-${stamp}.csv`;
  writeFileSync(reportPath, `${rows.join('\n')}\n`);
  console.log(JSON.stringify({ records: records.length, ...counts }, null, 2));
  console.log(`Report: ${reportPath}`);
  console.log('Left for a person (sample):');
  reviewSamples.forEach((line) => console.log(`  ${line}`));
  console.log('Weight values that are free text (Shopify cannot read these; fix by hand):');
  freeTextWeights.forEach((line) => console.log(`  ${line}`));

  if (!flag('--apply')) {
    console.log('\nDry run: nothing was written. Re-run with --apply (optionally --limit N) to write.');
    return;
  }

  const limit = Number(option('--limit') ?? updates.length);
  const batch = updates.slice(0, Number.isFinite(limit) && limit > 0 ? limit : updates.length);
  const backupPath = `tmp/shipping-dims-backup-${stamp}.json`;
  writeFileSync(backupPath, JSON.stringify(batch.map((update) => update.original), null, 1));
  console.log(`\nBackup of the originals: ${backupPath}`);

  let written = 0;
  try {
    for (const update of batch) {
      await write(update.id, update.fields, update.fields);
      written += 1;
      await sleep(WRITE_DELAY_MS);
    }
  } finally {
    console.log(`Wrote and verified ${written} of ${batch.length} records. Undo with: npm run airtable:restore-shipping-dims -- ${backupPath} --apply`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
