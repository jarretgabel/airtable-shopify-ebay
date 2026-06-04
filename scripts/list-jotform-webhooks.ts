import dotenv from 'dotenv';
import { listFormWebhooks } from '../aws/src/providers/jotform/client.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.JOTFORM_API_KEY = process.env.JOTFORM_API_KEY
  || process.env.VITE_JOTFORM_API_KEY
  || '';
process.env.JOTFORM_FORM_ID = process.env.JOTFORM_FORM_ID
  || process.env.VITE_JOTFORM_FORM_ID
  || '';

async function main(): Promise<void> {
  const formId = process.env.JOTFORM_FORM_ID.trim();

  if (!formId) {
    throw new Error('JOTFORM_FORM_ID is required.');
  }

  const webhooks = await listFormWebhooks(formId);

  console.log(JSON.stringify(webhooks, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
