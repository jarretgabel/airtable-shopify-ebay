import { HttpError } from '../../shared/errors.js';
import { getOptionalSecret } from '../../shared/secrets.js';
import { DESCRIPTION_SYSTEM_PROMPT } from './brandVoice.js';

const SYSTEM_PROMPT = `You are an expert authenticator and cataloguer of high-end audiophile / home theater equipment for Resolution AV, a luxury used HiFi dealership in New York City.

Analyze the provided image and identify the stereo/audio equipment shown. Respond ONLY with valid JSON — no markdown, no code fences, no extra text.

Use this exact schema:
{
  "equipment_type": "string — e.g. Integrated Amplifier, Preamplifier, Monoblock Power Amplifier, Stereo Power Amplifier, DAC, CD Player/Transport, Turntable, Phono Stage, Speakers, Subwoofer, Network Streamer, Headphone Amplifier, Cables, Rack/Accessories",
  "brand": "string — manufacturer name, e.g. McIntosh, Pass Labs, Naim, dCS, Chord, Wilson Audio",
  "model": "string — model number/name, e.g. MA8900, XA60.8, NAP 250 DR",
  "year_range": "string — approximate production years e.g. 2018–2022, or Unknown",
  "description": "string — 2–3 sentence product description written for a Shopify product listing. Highlight the unit's sonic character, key specs, and collectability.",
  "condition_notes": "string — honest, visible condition observations from the image (cosmetic blemishes, rack wear, faceplate condition, etc.). One or two sentences.",
  "suggested_sku": "string — uppercase SKU in format BRAND-MODEL with hyphens only, e.g. MCINTOSH-MA8900",
  "suggested_tags": ["array of lowercase tags for Shopify, e.g. amplifier, mcintosh, tube, class-a"],
  "shopify_product_type": "string — one of: Amplifier | DAC | CD Player | Turntable | Speakers | Streamer | Phono Stage | Headphone Amp | Cables | Accessories",
  "specifications": {
    "object — include every key technical spec you know for this exact model. Common fields (use whichever apply):
    Power Output, Frequency Response, THD+N, Signal-to-Noise Ratio, Input Impedance, Output Impedance,
    Gain, Inputs, Outputs, Supported Formats, DAC Chip, Tube Complement, Bias Class, Dimensions, Weight.
    Keys should be human-readable strings, values should include units. Omit specs you are not confident about."
  },
  "msrp_original": "string — original retail price when new, e.g. '$6,500 USD (2019)'. Use 'Unknown' if unsure.",
  "price_range_sold": "string — typical recent used/sold market price range based on your training data, e.g. '$2,800–$3,800 USD'. Note if the market is strong or soft. Use 'Unknown' if unsure."
}

If no audio equipment is visible or the image is unclear, still return valid JSON with your best guess and note the uncertainty in condition_notes. For specifications, msrp_original, and price_range_sold return empty object / 'Unknown' if the model cannot be determined.`;

interface EquipmentIdentification {
  equipment_type: string;
  brand: string;
  model: string;
  year_range: string;
  description: string;
  condition_notes: string;
  suggested_sku: string;
  suggested_tags: string[];
  shopify_product_type: string;
  specifications: Record<string, string>;
  msrp_original: string;
  price_range_sold: string;
}

interface ProviderConfig {
  provider: 'github' | 'openai';
  apiKey: string;
  url: string;
}

function getProviderConfig(): ProviderConfig {
  const githubToken = getOptionalSecret('GITHUB_TOKEN');
  const openaiKey = getOptionalSecret('OPENAI_API_KEY');

  if (githubToken) {
    return {
      provider: 'github',
      apiKey: githubToken,
      url: 'https://models.inference.ai.azure.com/chat/completions',
    };
  }

  if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      url: 'https://api.openai.com/v1/chat/completions',
    };
  }

  throw new HttpError(500, 'Missing AI provider credentials', {
    service: 'ai',
    code: 'AI_PROVIDER_NOT_CONFIGURED',
    retryable: false,
  });
}

export async function identifyEquipment(
  base64: string,
  mimeType = 'image/jpeg',
): Promise<EquipmentIdentification> {
  const { provider, apiKey, url } = getProviderConfig();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1600,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: SYSTEM_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const providerLabel = provider === 'github' ? 'GitHub Models' : 'OpenAI';
    throw new HttpError(response.status, `${providerLabel} API error ${response.status}: ${(body as { error?: { message?: string } }).error?.message ?? JSON.stringify(body)}`, {
      service: 'ai',
      code: 'AI_PROVIDER_ERROR',
      retryable: response.status >= 500,
    });
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = jsonStr.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new HttpError(502, `Could not parse AI response: ${raw}`, {
      service: 'ai',
      code: 'AI_INVALID_RESPONSE',
      retryable: true,
    });
  }

  return JSON.parse(match[0]) as EquipmentIdentification;
}

const MAX_DESCRIPTION_FIELDS = 60;
const MAX_FIELD_VALUE_LENGTH = 1500;

const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-5';

async function requestAnthropicText(apiKey: string, system: string, userContent: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: getOptionalSecret('ANTHROPIC_MODEL') ?? ANTHROPIC_DEFAULT_MODEL,
      max_tokens: 900,
      temperature: 0.5,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new HttpError(response.status, `Anthropic API error ${response.status}: ${(body as { error?: { message?: string } }).error?.message ?? JSON.stringify(body)}`, {
      service: 'ai',
      code: 'AI_PROVIDER_ERROR',
      retryable: response.status >= 500 || response.status === 429,
    });
  }

  const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  return (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}

async function requestOpenAiCompatibleText(system: string, userContent: string): Promise<string> {
  const { provider, apiKey, url } = getProviderConfig();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 900,
      temperature: 0.5,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const providerLabel = provider === 'github' ? 'GitHub Models' : 'OpenAI';
    throw new HttpError(response.status, `${providerLabel} API error ${response.status}: ${(body as { error?: { message?: string } }).error?.message ?? JSON.stringify(body)}`, {
      service: 'ai',
      code: 'AI_PROVIDER_ERROR',
      retryable: response.status >= 500,
    });
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

export function sanitizeDescriptionOutput(raw: string): string {
  return raw
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[ \t]*[*•][ \t]+/gm, '')
    .replace(/!/g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function generateDescription(
  fields: Record<string, string>,
  existingDescription = '',
): Promise<string> {
  const details = Object.entries(fields)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .slice(0, MAX_DESCRIPTION_FIELDS)
    .map(([name, value]) => `${name}: ${value.trim().slice(0, MAX_FIELD_VALUE_LENGTH)}`)
    .join('\n');

  const userContent = [
    'Listing details (the only facts you may use):',
    details,
    existingDescription.trim()
      ? `\nExisting description (rewrite it in the RAV voice, keeping only facts also supported above):\n${existingDescription.trim().slice(0, 4000)}`
      : '',
  ].join('\n');

  const anthropicKey = getOptionalSecret('ANTHROPIC_API_KEY');
  const raw = anthropicKey
    ? await requestAnthropicText(anthropicKey, DESCRIPTION_SYSTEM_PROMPT, userContent)
    : await requestOpenAiCompatibleText(DESCRIPTION_SYSTEM_PROMPT, userContent);
  const text = sanitizeDescriptionOutput(raw);

  if (!text) {
    throw new HttpError(502, 'AI returned an empty description', {
      service: 'ai',
      code: 'AI_INVALID_RESPONSE',
      retryable: true,
    });
  }

  return text;
}
