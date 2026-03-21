/**
 * Tests the Image Lab AI pipeline end-to-end using GitHub Models (GPT-4o Vision).
 * Downloads a test JPEG and sends it as base64 (required — GitHub Models cannot
 * fetch external URLs). Run with: nvm use 20 && node tests/test-imagelab.mjs
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf-8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('=').map((p, i) => (i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim())))
);

const GITHUB_TOKEN = env['VITE_GITHUB_TOKEN'] || '';
const OPENAI_KEY   = env['VITE_OPENAI_API_KEY'] || '';
const GITHUB_MODELS_ENDPOINT = env['VITE_GITHUB_MODELS_ENDPOINT'] || 'https://models.inference.ai.azure.com/chat/completions';
const OPENAI_CHAT_ENDPOINT = env['VITE_OPENAI_CHAT_ENDPOINT'] || 'https://api.openai.com/v1/chat/completions';
const TEST_IMAGE_URL = env['VITE_TEST_IMAGE_URL'] || 'https://picsum.photos/800/600';

const token    = GITHUB_TOKEN || OPENAI_KEY;
const useGitHub = !!GITHUB_TOKEN;
const endpoint  = useGitHub
  ? GITHUB_MODELS_ENDPOINT
  : OPENAI_CHAT_ENDPOINT;

if (!token) {
  console.error('ERROR: No API key found in .env.local');
  process.exit(1);
}

console.log(`Provider : ${useGitHub ? 'GitHub Models (Copilot)' : 'OpenAI'}`);
console.log(`Endpoint : ${endpoint}`);
console.log('');

const SYSTEM_PROMPT = `You are an expert authenticator and cataloguer of high-end audiophile / home theater equipment for Resolution AV, a luxury used HiFi dealership in New York City.

Analyze the provided image and identify the stereo/audio equipment shown. Respond ONLY with valid JSON — no markdown, no code fences, no extra text.

Use this exact schema:
{
  "equipment_type": "string",
  "brand": "string",
  "model": "string",
  "year_range": "string",
  "description": "string — 2 sentence product listing description",
  "condition_notes": "string",
  "suggested_sku": "string",
  "suggested_tags": ["array of lowercase tags"],
  "shopify_product_type": "string"
}`;

// Download a real JPEG to /tmp if not already cached
const IMG_PATH = '/tmp/test-hifi-equipment.jpg';
if (!existsSync(IMG_PATH)) {
  console.log('Downloading test image...');
  execSync(`curl -sLo "${IMG_PATH}" "${TEST_IMAGE_URL}" --max-time 20`);
}
const imgBytes  = readFileSync(IMG_PATH);
const base64Img = imgBytes.toString('base64');
const dataUrl   = `data:image/jpeg;base64,${base64Img}`;

console.log(`Test image : ${IMG_PATH} (${(imgBytes.length / 1024).toFixed(1)} KB → base64)`);
console.log('Sending to AI...\n');

const start = Date.now();

try {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 900,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high',
              },
            },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        },
      ],
    }),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`HTTP status : ${res.status} (${elapsed}s)`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('API Error:', JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const data = await res.json();
  const raw  = data.choices?.[0]?.message?.content ?? '';
  const usage = data.usage ?? {};

  console.log(`Tokens     : ${usage.prompt_tokens ?? '?'} in / ${usage.completion_tokens ?? '?'} out\n`);
  console.log('─── Raw AI response ─────────────────────────────────────');
  console.log(raw);
  console.log('─────────────────────────────────────────────────────────\n');

  // Parse JSON
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match   = jsonStr.match(/\{[\s\S]*\}/);

  if (!match) {
    console.error('Could not extract JSON from response');
    process.exit(1);
  }

  const result = JSON.parse(match[0]);

  console.log('─── Parsed Equipment Details ────────────────────────────');
  console.log(`Type        : ${result.equipment_type}`);
  console.log(`Brand       : ${result.brand}`);
  console.log(`Model       : ${result.model}`);
  console.log(`Year Range  : ${result.year_range}`);
  console.log(`SKU         : ${result.suggested_sku}`);
  console.log(`Shopify Type: ${result.shopify_product_type}`);
  console.log(`Tags        : ${result.suggested_tags?.join(', ')}`);
  console.log(`\nDescription:\n  ${result.description}`);
  console.log(`\nCondition Notes:\n  ${result.condition_notes}`);
  console.log('─────────────────────────────────────────────────────────');
  console.log('\n✅ Image Lab AI pipeline working correctly');
} catch (err) {
  console.error('Fatal error:', err.message);
  process.exit(1);
}
