/** Compares the assistant's field whitelist with the fields actually populated in the workflow data. Run: npm run assistant:check-fields */
import { getConfiguredRecords } from '../aws/src/store/index.js';
import { BASE_FIELDS, FINANCE_FIELDS, LISTING_FIELDS, POST_PUBLISH_FIELDS, SELLER_FIELDS } from '../aws/src/providers/ai/assistant/scope.js';

const whitelist = [...new Set([...BASE_FIELDS, ...LISTING_FIELDS, ...POST_PUBLISH_FIELDS, ...FINANCE_FIELDS, ...SELLER_FIELDS])];
const records = await getConfiguredRecords('used-gear-workflow');
const populated = new Map<string, number>();
for (const record of records) {
  for (const [name, value] of Object.entries(record.fields)) {
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    populated.set(name, (populated.get(name) ?? 0) + 1);
  }
}

console.log(`Records scanned: ${records.length}`);
console.log('\nWhitelisted but never populated (wrong name, or just unused):');
for (const name of whitelist.filter((field) => !populated.has(field))) console.log(`  - ${name}`);
console.log('\nPopulated but not whitelisted (assistant cannot see these):');
for (const [name, count] of [...populated].filter(([field]) => !whitelist.includes(field)).sort((a, b) => b[1] - a[1])) console.log(`  - ${name} (${count})`);
process.exit(0);
