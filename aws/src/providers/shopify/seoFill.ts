import { generateSeoDescription, generateSeoTitle } from '../ai/client.js';

export const SEO_TITLE_RANGE = { min: 30, max: 60 } as const;
export const SEO_DESCRIPTION_RANGE = { min: 70, max: 160 } as const;

const TITLE_FIELDS = ['Shopify Extra SEO Title', 'Shopify GraphQL SEO Title'];
const DESCRIPTION_FIELDS = ['Shopify Extra SEO Description', 'Shopify GraphQL SEO Description'];

type Generator = (fields: Record<string, string>, existing?: string) => Promise<string>;

export interface SeoFillResult {
  seoTitle?: string;
  seoDescription?: string;
  warnings: string[];
}

function readField(fields: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = fields[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function inRange(value: string, range: { min: number; max: number }): boolean {
  return value.length >= range.min && value.length <= range.max;
}

function listingFacts(fields: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter(([name, value]) => (
      typeof value === 'string'
      && value.trim().length > 0
      && value.length <= 1500
      && !/json|html|image|photo|url|^id$|record|seo/i.test(name)
    )),
  ) as Record<string, string>;
}

// Returns replacement SEO values only when the current ones are blank or outside the SEO length range.
export async function fillSeoFieldsForPublish(
  fields: Record<string, unknown>,
  generators: { title: Generator; description: Generator } = { title: generateSeoTitle, description: generateSeoDescription },
): Promise<SeoFillResult> {
  const result: SeoFillResult = { warnings: [] };
  const facts = listingFacts(fields);
  if (Object.keys(facts).length === 0) return result;

  const currentTitle = readField(fields, TITLE_FIELDS);
  const currentDescription = readField(fields, DESCRIPTION_FIELDS);

  const run = async (
    label: string,
    current: string,
    range: { min: number; max: number },
    generate: Generator,
  ): Promise<string | undefined> => {
    if (inRange(current, range)) return undefined;
    try {
      const generated = (await generate(facts, current)).trim();
      if (generated && (inRange(generated, range) || !current)) return generated;
    } catch {
      result.warnings.push(`Could not generate an SEO ${label}; published without changing it.`);
    }
    return undefined;
  };

  [result.seoTitle, result.seoDescription] = await Promise.all([
    run('title', currentTitle, SEO_TITLE_RANGE, generators.title),
    run('description', currentDescription, SEO_DESCRIPTION_RANGE, generators.description),
  ]);
  return result;
}
