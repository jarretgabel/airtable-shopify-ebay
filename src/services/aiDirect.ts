import type { EquipmentIdentification } from '@/services/equipmentAI';

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

export interface AIProviderStatus {
  provider: 'github' | 'openai' | 'none';
  key: string;
}

export function getDirectAIProvider(): AIProviderStatus {
  const githubToken = (import.meta.env.VITE_GITHUB_TOKEN as string | undefined)?.trim() ?? '';
  const openaiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim() ?? '';

  if (githubToken) return { provider: 'github', key: githubToken };
  if (openaiKey) return { provider: 'openai', key: openaiKey };
  return { provider: 'none', key: '' };
}

export async function identifyEquipmentDirect(
  base64: string,
  mimeType = 'image/jpeg',
): Promise<EquipmentIdentification> {
  const { provider, key } = getDirectAIProvider();

  if (!key) {
    throw new Error(
      'No AI key found. Add VITE_GITHUB_TOKEN (free with Copilot) or VITE_OPENAI_API_KEY to .env.local and restart the dev server.',
    );
  }

  const url = provider === 'github'
    ? '/github-models-proxy/chat/completions'
    : '/openai-proxy/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
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
    throw new Error(
      `${providerLabel} API error ${response.status}: ${(body as { error?: { message?: string } }).error?.message ?? JSON.stringify(body)}`,
    );
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = jsonStr.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Could not parse AI response:\n${raw}`);

  return JSON.parse(match[0]) as EquipmentIdentification;
}