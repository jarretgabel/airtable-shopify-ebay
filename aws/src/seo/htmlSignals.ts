export type PageType = 'home' | 'product' | 'collection' | 'blog' | 'page' | 'other';

export interface PageSignals {
  title: string | null;
  metaDescription: string | null;
  h1s: string[];
  h2Count: number;
  questionHeadings: number;
  canonical: string | null;
  noindex: boolean;
  lang: string | null;
  hasViewport: boolean;
  ogTitle: boolean;
  ogImage: boolean;
  wordCount: number;
  imageCount: number;
  imagesWithAlt: number;
  internalLinks: number;
  hasListOrTable: boolean;
  schemaTypes: string[];
  productSchema: { hasOffer: boolean; hasPrice: boolean; hasAvailability: boolean; hasBrand: boolean } | null;
  dateModified: string | null;
}

export function classifyUrl(url: string): PageType {
  let path = '/';
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (path === '/' || path === '') return 'home';
  if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?products\//i.test(path)) return 'product';
  if (/\/collections\//i.test(path)) return 'collection';
  if (/\/blogs\//i.test(path)) return 'blog';
  if (/\/pages\//i.test(path)) return 'page';
  return 'other';
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    const lower = code.toLowerCase();
    if (ENTITIES[lower]) return ENTITIES[lower];
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16) || 32);
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10) || 32);
    return match;
  });
}

const clean = (value: string | undefined | null): string | null => {
  const text = decodeEntities((value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return text || null;
};

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? decodeEntities(match[2] ?? match[3] ?? match[4] ?? '') : null;
}

function metaContent(html: string, key: 'name' | 'property', value: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attr(tag, key)?.toLowerCase() === value) return clean(attr(tag, 'content'));
  }
  return null;
}

function collectSchemaTypes(node: unknown, types: Set<string>, products: Array<Record<string, unknown>>): void {
  if (Array.isArray(node)) {
    node.forEach((child) => collectSchemaTypes(child, types, products));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const rawType = record['@type'];
  const list = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];
  for (const type of list) {
    if (typeof type === 'string') {
      types.add(type);
      if (type === 'Product') products.push(record);
    }
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') collectSchemaTypes(value, types, products);
  }
}

function findDateModified(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findDateModified(child);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const record = node as Record<string, unknown>;
  if (typeof record.dateModified === 'string') return record.dateModified;
  for (const value of Object.values(record)) {
    const found = findDateModified(value);
    if (found) return found;
  }
  return null;
}

/** Pulls the SEO and AI-search signals out of one HTML document without a DOM library. */
export function extractSignals(html: string, pageUrl: string): PageSignals {
  const origin = (() => {
    try {
      return new URL(pageUrl).origin;
    } catch {
      return '';
    }
  })();

  const types = new Set<string>();
  const products: Array<Record<string, unknown>> = [];
  let dateModified: string | null = null;
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data: unknown = JSON.parse(match[1].trim());
      collectSchemaTypes(data, types, products);
      dateModified ??= findDateModified(data);
    } catch {
      // Invalid JSON-LD is itself an SEO finding, but it just yields no types here.
    }
  }

  const body = (/<body\b[\s\S]*<\/body>/i.exec(html)?.[0] ?? html)
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const main = /<main\b[\s\S]*?<\/main>/i.exec(body)?.[0]
    ?? body.replace(/<(header|footer|nav)\b[\s\S]*?<\/\1>/gi, ' ');
  const text = clean(main) ?? '';

  const headings = (level: number) => [...main.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi'))].map((m) => clean(m[1]) ?? '');
  const h1s = headings(1).filter(Boolean);
  const allHeadings = [1, 2, 3, 4].flatMap(headings);

  const images = main.match(/<img\b[^>]*>/gi) ?? [];
  const imagesWithAlt = images.filter((tag) => (attr(tag, 'alt') ?? '').trim() !== '').length;

  let internalLinks = 0;
  for (const tag of main.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attr(tag, 'href');
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    if (href.startsWith('/') || (origin && href.startsWith(origin))) internalLinks += 1;
  }

  const robots = metaContent(html, 'name', 'robots') ?? '';
  const canonicalTag = (html.match(/<link\b[^>]*>/gi) ?? []).find((tag) => attr(tag, 'rel')?.toLowerCase() === 'canonical');
  const product = products[0];
  const offers = product ? ([] as unknown[]).concat(product.offers ?? []) as Array<Record<string, unknown>> : [];

  return {
    title: clean(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]),
    metaDescription: metaContent(html, 'name', 'description'),
    h1s,
    h2Count: headings(2).length,
    questionHeadings: allHeadings.filter((heading) => heading.endsWith('?')).length,
    canonical: canonicalTag ? attr(canonicalTag, 'href') : null,
    noindex: /noindex/i.test(robots),
    lang: attr(/<html\b[^>]*>/i.exec(html)?.[0] ?? '', 'lang'),
    hasViewport: metaContent(html, 'name', 'viewport') !== null,
    ogTitle: metaContent(html, 'property', 'og:title') !== null,
    ogImage: metaContent(html, 'property', 'og:image') !== null,
    wordCount: text ? text.split(' ').length : 0,
    imageCount: images.length,
    imagesWithAlt,
    internalLinks,
    hasListOrTable: /<(table|dl)\b/i.test(main) || (main.match(/<li\b/gi) ?? []).length >= 6,
    schemaTypes: [...types].sort(),
    productSchema: product
      ? {
          hasOffer: offers.length > 0,
          hasPrice: offers.some((offer) => offer.price !== undefined || offer.lowPrice !== undefined),
          hasAvailability: offers.some((offer) => typeof offer.availability === 'string'),
          hasBrand: product.brand !== undefined,
        }
      : null,
    dateModified,
  };
}
