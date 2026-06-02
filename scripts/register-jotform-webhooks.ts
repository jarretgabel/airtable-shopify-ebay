import dotenv from 'dotenv';
import { registerFormWebhook } from '../aws/src/providers/jotform/client.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.JOTFORM_API_KEY = process.env.JOTFORM_API_KEY
  || process.env.VITE_JOTFORM_API_KEY
  || '';
process.env.JOTFORM_FORM_ID = process.env.JOTFORM_FORM_ID
  || process.env.VITE_JOTFORM_FORM_ID
  || '';
process.env.JOTFORM_WEBHOOK_BASE_URL = process.env.JOTFORM_WEBHOOK_BASE_URL
  || process.env.VITE_JOTFORM_WEBHOOK_BASE_URL
  || '';
process.env.JOTFORM_WEBHOOK_SECRET = process.env.JOTFORM_WEBHOOK_SECRET
  || process.env.VITE_JOTFORM_WEBHOOK_SECRET
  || '';

function buildWebhookUrl(): string {
  const formId = process.env.JOTFORM_FORM_ID.trim();
  const baseUrl = process.env.JOTFORM_WEBHOOK_BASE_URL.trim().replace(/\/$/, '');
  const secret = process.env.JOTFORM_WEBHOOK_SECRET.trim();

  if (!formId) {
    throw new Error('JOTFORM_FORM_ID is required.');
  }

  if (!baseUrl) {
    throw new Error('JOTFORM_WEBHOOK_BASE_URL is required.');
  }

  const url = new URL(`${baseUrl}/api/hooks/jotform/submissions/${formId}`);
  if (secret) {
    url.searchParams.set('token', secret);
  }

  return url.toString();
}

async function main(): Promise<void> {
  const formId = process.env.JOTFORM_FORM_ID.trim();
  const webhookUrl = buildWebhookUrl();
  const result = await registerFormWebhook({ formId, webhookUrl });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});