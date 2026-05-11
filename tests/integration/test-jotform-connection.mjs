import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: `${__dirname}/.env.local` });
dotenv.config({ path: `${__dirname}/.env` });

const key = process.env.VITE_JOTFORM_API_KEY;
const jotformApiBase = process.env.VITE_JOTFORM_API_BASE || 'https://api.jotform.com';
if (!key) {
  console.error('❌ VITE_JOTFORM_API_KEY not set in .env.local');
  process.exit(1);
}

async function apiFetch(path, params = {}) {
  const qs = new URLSearchParams({ apiKey: key, ...params });
  const url = `${jotformApiBase}${path}?${qs}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.responseCode !== 200) {
    throw new Error(`JotForm ${json.responseCode}: ${json.message}`);
  }
  return { content: json.content, resultSet: json.resultSet };
}

// 1. Get all forms
console.log('=== JotForm Connection Test ===\n');
const { content: forms } = await apiFetch('/user/forms', { limit: 20, orderby: 'created_at', direction: 'DESC' });
console.log(`✅ Connected — ${forms.length} form(s) found:\n`);

for (const form of forms) {
  console.log(`  Form: "${form.title}"`);
  console.log(`  ID: ${form.id} | Status: ${form.status} | Total: ${form.count} | New: ${form.new}`);
  if (form.last_submission) {
    console.log(`  Last submission: ${form.last_submission}`);
  }
  console.log();
}

// 2. Pull recent submissions from the first enabled form with submissions
const target = forms.find(f => f.status === 'ENABLED' && f.count > 0);
if (!target) {
  console.log('No forms with submissions found.');
  process.exit(0);
}

console.log(`=== Recent submissions from "${target.title}" (ID: ${target.id}) ===\n`);
const { content: subs, resultSet } = await apiFetch(`/form/${target.id}/submissions`, {
  limit: 5,
  offset: 0,
  orderby: 'created_at',
  direction: 'DESC',
});

console.log(`Showing ${subs.length} of ${resultSet?.count ?? '?'} total submissions\n`);

for (const [i, sub] of subs.entries()) {
  console.log(`--- Submission ${i + 1} (ID: ${sub.id}) ---`);
  console.log(`Created: ${sub.created_at} | New: ${sub.new === '1' ? 'Yes' : 'No'} | Status: ${sub.status}`);

  const answers = Object.values(sub.answers)
    .filter(a => a.answer !== undefined && a.answer !== null && a.answer !== '')
    .sort((a, b) => Number(a.order) - Number(b.order));

  for (const a of answers) {
    let val;
    if (typeof a.answer === 'string') {
      val = a.answer;
    } else if (Array.isArray(a.answer)) {
      val = a.answer.filter(Boolean).join(', ');
    } else if (typeof a.answer === 'object') {
      val = Object.values(a.answer).filter(Boolean).join(' ');
    }
    if (val) console.log(`  ${a.text || a.name}: ${val}`);
  }
  console.log();
}
