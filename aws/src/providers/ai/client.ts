import { HttpError } from '../../shared/errors.js';
import { getOptionalSecret } from '../../shared/secrets.js';
import { CATEGORY_PICK_SYSTEM_PROMPT, COLLECTIONS_PICK_SYSTEM_PROMPT, TAGS_PICK_SYSTEM_PROMPT, CATEGORY_QUERIES_SYSTEM_PROMPT, DESCRIPTION_SYSTEM_PROMPT, KEY_FEATURES_SYSTEM_PROMPT, KEY_FEATURES_WEB_SEARCH_ADDENDUM, SEO_DESCRIPTION_SYSTEM_PROMPT, SEO_TITLE_SYSTEM_PROMPT, TITLE_SYSTEM_PROMPT } from './brandVoice.js';

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

async function requestAnthropicText(
  apiKey: string,
  system: string,
  userContent: string,
  options: { webSearch?: boolean } = {},
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: getOptionalSecret('ANTHROPIC_MODEL') ?? ANTHROPIC_DEFAULT_MODEL,
      max_tokens: options.webSearch ? 1800 : 900,
      temperature: 0.5,
      system,
      messages: [{ role: 'user', content: userContent }],
      ...(options.webSearch ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }] } : {}),
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
    // Key features live in their own section, so drop any "Label: value" spec lines the model adds.
    .replace(/^[ \t]*[A-Za-z][A-Za-z0-9 /&()'-]{0,38}:[ \t]+\S.*$/gm, '')
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

const MAX_TITLE_LENGTH = 80;

export function sanitizeTitleOutput(raw: string): string {
  const singleLine = raw
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';

  const cleaned = singleLine
    .replace(/^(title|listing title)\s*:\s*/i, '')
    .replace(/["“”*#`~|]/g, '')
    .replace(/!/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= MAX_TITLE_LENGTH) {
    return cleaned;
  }

  const cut = cleaned.slice(0, MAX_TITLE_LENGTH + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut.slice(0, MAX_TITLE_LENGTH)).replace(/[\s,;:-]+$/, '');
}

export async function generateTitle(
  fields: Record<string, string>,
  existingTitle = '',
): Promise<string> {
  const details = Object.entries(fields)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .slice(0, MAX_DESCRIPTION_FIELDS)
    .map(([name, value]) => `${name}: ${value.trim().slice(0, 300)}`)
    .join('\n');

  const userContent = [
    'Listing details (the only facts you may use):',
    details,
    existingTitle.trim()
      ? `\nExisting title (improve it, keeping only facts also supported above):\n${existingTitle.trim().slice(0, 300)}`
      : '',
  ].join('\n');

  const anthropicKey = getOptionalSecret('ANTHROPIC_API_KEY');
  const raw = anthropicKey
    ? await requestAnthropicText(anthropicKey, TITLE_SYSTEM_PROMPT, userContent)
    : await requestOpenAiCompatibleText(TITLE_SYSTEM_PROMPT, userContent);
  const text = sanitizeTitleOutput(raw);

  if (!text) {
    throw new HttpError(502, 'AI returned an empty title', {
      service: 'ai',
      code: 'AI_INVALID_RESPONSE',
      retryable: true,
    });
  }

  return text;
}

const MAX_SEO_TITLE_LENGTH = 60;
const MAX_SEO_DESCRIPTION_LENGTH = 160;

export function sanitizeSingleLineOutput(raw: string, maxLength: number): string {
  const cleaned = (raw
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '')
    .replace(/^(seo title|seo description|meta title|meta description|title|description)\s*:\s*/i, '')
    .replace(/["“”*#`~]/g, '')
    .replace(/!/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxLength) return cleaned;

  const cut = cleaned.slice(0, maxLength + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut.slice(0, maxLength)).replace(/[\s,;:|-]+$/, '');
}

async function generateSeoText(
  systemPrompt: string,
  maxLength: number,
  label: string,
  fields: Record<string, string>,
  existing: string,
): Promise<string> {
  const details = Object.entries(fields)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .slice(0, MAX_DESCRIPTION_FIELDS)
    .map(([name, value]) => `${name}: ${value.trim().slice(0, 600)}`)
    .join('\n');

  const userContent = [
    'Listing details (the only facts you may use):',
    details,
    existing.trim()
      ? `\nExisting ${label} (improve it, keeping only facts also supported above):\n${existing.trim().slice(0, 400)}`
      : '',
  ].join('\n');

  const anthropicKey = getOptionalSecret('ANTHROPIC_API_KEY');
  const request = (content: string) => (anthropicKey
    ? requestAnthropicText(anthropicKey, systemPrompt, content)
    : requestOpenAiCompatibleText(systemPrompt, content));

  let text = sanitizeSingleLineOutput(await request(userContent), Number.MAX_SAFE_INTEGER);
  if (text.length > maxLength) {
    // Ask for a rewrite instead of cutting the text off mid-sentence.
    const retried = sanitizeSingleLineOutput(await request([
      userContent,
      `\nYour previous ${label} was ${text.length} characters, which is too long:\n${text}`,
      `\nRewrite it as a complete, shorter ${label} of at most ${maxLength} characters. Do not cut it off.`,
    ].join('\n')), Number.MAX_SAFE_INTEGER);
    text = retried || text;
  }
  text = trimToSentence(text, maxLength);

  if (!text) {
    throw new HttpError(502, `AI returned an empty ${label}`, {
      service: 'ai',
      code: 'AI_INVALID_RESPONSE',
      retryable: true,
    });
  }

  return text;
}

// Last resort when a rewrite is still too long: prefer ending on a full sentence, then a word boundary.
export function trimToSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const window = text.slice(0, maxLength + 1);
  const sentenceEnd = Array.from(window.matchAll(/[.?](?=\s|$)/g)).pop()?.index ?? -1;
  if (sentenceEnd > maxLength / 2) return window.slice(0, sentenceEnd + 1).trim();
  return sanitizeSingleLineOutput(text, maxLength);
}

export function generateSeoTitle(fields: Record<string, string>, existing = ''): Promise<string> {
  return generateSeoText(SEO_TITLE_SYSTEM_PROMPT, MAX_SEO_TITLE_LENGTH, 'SEO title', fields, existing);
}

export function generateSeoDescription(fields: Record<string, string>, existing = ''): Promise<string> {
  return generateSeoText(SEO_DESCRIPTION_SYSTEM_PROMPT, MAX_SEO_DESCRIPTION_LENGTH, 'SEO description', fields, existing);
}

export interface CategoryCandidate {
  id: string;
  label: string;
}

function formatListingDetails(fields: Record<string, string>, maxValueLength = 300): string {
  return Object.entries(fields)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .slice(0, MAX_DESCRIPTION_FIELDS)
    .map(([name, value]) => `${name}: ${value.trim().slice(0, maxValueLength)}`)
    .join('\n');
}

async function requestAiText(systemPrompt: string, userContent: string): Promise<string> {
  const anthropicKey = getOptionalSecret('ANTHROPIC_API_KEY');
  return anthropicKey
    ? requestAnthropicText(anthropicKey, systemPrompt, userContent)
    : requestOpenAiCompatibleText(systemPrompt, userContent);
}

export function parseCategoryQueriesOutput(raw: string): string[] {
  const jsonText = raw.match(/\[[\s\S]*\]/)?.[0];
  if (!jsonText) return [];
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(
      parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, 80))
        .filter(Boolean),
    )).slice(0, 3);
  } catch {
    return [];
  }
}

export async function generateCategoryQueries(target: 'shopify' | 'ebay', fields: Record<string, string>): Promise<string[]> {
  const raw = await requestAiText(
    CATEGORY_QUERIES_SYSTEM_PROMPT,
    `Marketplace: ${target === 'ebay' ? 'eBay' : 'Shopify product taxonomy'}\nListing details:\n${formatListingDetails(fields)}`,
  );
  return parseCategoryQueriesOutput(raw);
}

// Models often drop the "gid://shopify/..." prefix, so also match on the trailing id segment.
function matchCandidateId(id: string, candidates: CategoryCandidate[]): string | null {
  const match = candidates.find((candidate) => candidate.id === id)
    ?? candidates.find((candidate) => id.length > 0 && candidate.id.endsWith(`/${id}`));
  return match?.id ?? null;
}

export function parseCollectionsPickOutput(raw: string, candidates: CategoryCandidate[]): string[] {
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return [];
  try {
    const ids = (JSON.parse(jsonText) as { ids?: unknown }).ids;
    if (!Array.isArray(ids)) return [];
    const matched = ids
      .map((id) => (typeof id === 'string' || typeof id === 'number' ? matchCandidateId(String(id).trim(), candidates) : null))
      .filter((id): id is string => id !== null);
    return Array.from(new Set(matched)).slice(0, 3);
  } catch {
    return [];
  }
}

export async function pickCollections(fields: Record<string, string>, candidates: CategoryCandidate[]): Promise<string[]> {
  const limited = candidates.slice(0, 150);
  if (limited.length === 0) return [];

  const raw = await requestAiText(
    COLLECTIONS_PICK_SYSTEM_PROMPT,
    [
      'Listing details:',
      formatListingDetails(fields),
      '\nCollections (id: title):',
      ...limited.map((candidate) => `${candidate.id}: ${candidate.label}`),
    ].join('\n'),
  );
  return parseCollectionsPickOutput(raw, limited);
}

export interface TagSuggestions {
  tags: string[];
  newTags: string[];
}

export function parseTagsPickOutput(raw: string, vocabulary: string[]): TagSuggestions {
  const empty: TagSuggestions = { tags: [], newTags: [] };
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return empty;
  try {
    const parsed = JSON.parse(jsonText) as { tags?: unknown; newTags?: unknown };
    const byLower = new Map(vocabulary.map((tag) => [tag.toLowerCase(), tag]));
    const toStrings = (value: unknown) => (Array.isArray(value)
      ? value.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
      : []);

    const existing = new Set<string>();
    const newTags = new Map<string, string>();
    // The model sometimes puts an existing tag in the wrong list, so sort both by the vocabulary.
    [...toStrings(parsed.tags), ...toStrings(parsed.newTags)].forEach((tag) => {
      const known = byLower.get(tag.toLowerCase());
      if (known) {
        existing.add(known);
        return;
      }
      if (tag.length <= 30 && !/[,\n]/.test(tag)) newTags.set(tag.toLowerCase(), tag);
    });

    return {
      tags: Array.from(existing).slice(0, 8),
      newTags: Array.from(newTags.values()).slice(0, 3),
    };
  } catch {
    return empty;
  }
}

export async function pickTags(
  fields: Record<string, string>,
  collectionTags: string[],
  storeTags: string[] = [],
): Promise<TagSuggestions> {
  const collectionSet = new Set(collectionTags.map((tag) => tag.toLowerCase()));
  const otherStoreTags = storeTags.filter((tag) => !collectionSet.has(tag.toLowerCase())).slice(0, 600);
  const limitedCollectionTags = collectionTags.slice(0, 400);
  if (limitedCollectionTags.length === 0 && otherStoreTags.length === 0) return { tags: [], newTags: [] };

  const raw = await requestAiText(
    TAGS_PICK_SYSTEM_PROMPT,
    [
      'Listing details:',
      formatListingDetails(fields),
      '\nCOLLECTION TAGS:',
      ...limitedCollectionTags,
      '\nSTORE TAGS:',
      ...otherStoreTags,
    ].join('\n'),
  );
  return parseTagsPickOutput(raw, [...limitedCollectionTags, ...otherStoreTags]);
}

export function parseCategoryPickOutput(raw: string, candidates: CategoryCandidate[]): string | null {
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;
  try {
    const id = (JSON.parse(jsonText) as { id?: unknown }).id;
    const normalized = typeof id === 'string' || typeof id === 'number' ? String(id).trim() : '';
    return matchCandidateId(normalized, candidates);
  } catch {
    return null;
  }
}

export async function pickCategory(
  target: 'shopify' | 'ebay',
  fields: Record<string, string>,
  candidates: CategoryCandidate[],
): Promise<string | null> {
  const limited = candidates.slice(0, 30);
  if (limited.length === 0) return null;

  const raw = await requestAiText(
    CATEGORY_PICK_SYSTEM_PROMPT,
    [
      `Marketplace: ${target === 'ebay' ? 'eBay' : 'Shopify product taxonomy'}`,
      'Listing details:',
      formatListingDetails(fields),
      '\nCandidates (id: category path):',
      ...limited.map((candidate) => `${candidate.id}: ${candidate.label}`),
    ].join('\n'),
  );
  return parseCategoryPickOutput(raw, limited);
}

export interface GeneratedKeyFeature {
  feature: string;
  value: string;
}

const MAX_KEY_FEATURES = 10;
// eBay rejects item specifics longer than this, so generated values must fit without being cut off.
export const KEY_FEATURE_VALUE_MAX_LENGTH = 65;

// Rows the listing record already supplies automatically. Matched by word so variants such as
// "Includes Original Box" or "Product Weight" are caught too.
const AUTO_MAPPED_FEATURE_WORDS = new Set([
  'make', 'brand', 'model', 'serial', 'condition', 'cosmetic', 'include', 'includes', 'included', 'including',
  'box', 'packaging', 'package', 'packing', 'carton', 'accessories', 'manual', 'remote', 'voltage', 'weight', 'dimension', 'dimensions', 'audiogon', 'sku', 'tested', 'testing',
]);

function isAutoMappedFeature(normalizedName: string, value: string): boolean {
  const words = normalizedName.split(' ');
  return words.some((word) => AUTO_MAPPED_FEATURE_WORDS.has(word))
    || normalizedName.includes('power cable')
    || normalizedName.includes('component type')
    || /^(yes|no|true|false|n\/a)$/i.test(value.trim())
    || /^(included|includes|comes with)\b/i.test(value.trim());
}

export function parseKeyFeaturesOutput(raw: string, excludedFeatureNames: string[] = []): GeneratedKeyFeature[] {
  const fenced = raw.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  const jsonText = fenced?.[1] ?? raw.match(/\[\s*\{[\s\S]*\}\s*\]|\[\s*\]/)?.[0];
  if (!jsonText) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const seen = new Set(excludedFeatureNames.map(normalize));
  const result: GeneratedKeyFeature[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const { feature, value } = item as { feature?: unknown; value?: unknown };
    if (typeof feature !== 'string' || typeof value !== 'string') continue;

    const stripCites = (text: string) => text.replace(/<\/?cite[^>]*>/gi, '');
    const cleanFeature = stripCites(feature).replace(/[<>"*#`|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const cleanValue = stripCites(value).replace(/[<>*#`|]/g, '').replace(/!/g, '.').replace(/\s+/g, ' ').trim();
    const key = normalize(cleanFeature);
    if (cleanValue.length > KEY_FEATURE_VALUE_MAX_LENGTH) continue;
    if (!key || !cleanValue || seen.has(key) || isAutoMappedFeature(key, cleanValue)) continue;

    seen.add(key);
    result.push({ feature: cleanFeature, value: cleanValue });
    if (result.length >= MAX_KEY_FEATURES) break;
  }

  return result;
}

export async function generateKeyFeatures(
  fields: Record<string, string>,
  existingFeatureNames: string[] = [],
  excludedFeatureNames: string[] = [],
): Promise<GeneratedKeyFeature[]> {
  const details = Object.entries(fields)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .slice(0, MAX_DESCRIPTION_FIELDS)
    .map(([name, value]) => `${name}: ${value.trim().slice(0, MAX_FIELD_VALUE_LENGTH)}`)
    .join('\n');

  const userContent = [
    'Listing details (the only facts you may use):',
    details,
    existingFeatureNames.length > 0
      ? `\nFeatures already in the list (do not repeat): ${existingFeatureNames.join(', ')}`
      : '',
  ].join('\n');

  const anthropicKey = getOptionalSecret('ANTHROPIC_API_KEY');
  const webSearch = getOptionalSecret('ANTHROPIC_WEB_SEARCH') !== 'false';
  const raw = anthropicKey
    ? await requestAnthropicText(
      anthropicKey,
      webSearch ? KEY_FEATURES_SYSTEM_PROMPT + KEY_FEATURES_WEB_SEARCH_ADDENDUM : KEY_FEATURES_SYSTEM_PROMPT,
      userContent,
      { webSearch },
    )
    : await requestOpenAiCompatibleText(KEY_FEATURES_SYSTEM_PROMPT, userContent);

  return parseKeyFeaturesOutput(raw, [...existingFeatureNames, ...excludedFeatureNames]);
}
