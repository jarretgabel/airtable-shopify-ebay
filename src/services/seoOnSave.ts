import { generateListingSeoText } from '@/services/app-api/ai';

export const SEO_TITLE_FIELD = 'Shopify Extra SEO Title';
export const SEO_DESCRIPTION_FIELD = 'Shopify Extra SEO Description';
const TITLE_RANGE = { min: 30, max: 60 };
const DESCRIPTION_RANGE = { min: 70, max: 160 };
const MIN_FACTS = 3;

type Generate = typeof generateListingSeoText;

const inRange = (value: string, range: { min: number; max: number }) => value.length >= range.min && value.length <= range.max;

function collectFacts(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([name, value]) => (
      name !== SEO_TITLE_FIELD
      && name !== SEO_DESCRIPTION_FIELD
      && typeof value === 'string'
      && value.trim().length > 0
      && value.length <= 1500
      && !/json|html|image|photo|url|^id$|record/i.test(name)
    )),
  );
}

// Fills only blank or out-of-range SEO fields so saved listings carry SEO text without hand entry.
export async function fillSeoValuesOnSave(
  values: Record<string, string>,
  generate: Generate = generateListingSeoText,
): Promise<Record<string, string>> {
  const facts = collectFacts(values);
  if (Object.keys(facts).length < MIN_FACTS) return {};

  const updates: Record<string, string> = {};
  const jobs: Array<[typeof SEO_TITLE_FIELD | typeof SEO_DESCRIPTION_FIELD, 'seoTitle' | 'seoDescription', { min: number; max: number }]> = [
    [SEO_TITLE_FIELD, 'seoTitle', TITLE_RANGE],
    [SEO_DESCRIPTION_FIELD, 'seoDescription', DESCRIPTION_RANGE],
  ];
  await Promise.all(jobs.map(async ([fieldName, kind, range]) => {
    const current = (values[fieldName] ?? '').trim();
    if (inRange(current, range)) return;
    try {
      const generated = (await generate(kind, facts, current)).trim();
      if (generated && (inRange(generated, range) || !current)) updates[fieldName] = generated;
    } catch {
      // Saving must not fail because the AI service is unavailable.
    }
  }));
  return updates;
}
