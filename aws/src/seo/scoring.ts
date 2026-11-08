import type { PageSignals, PageType } from './htmlSignals.js';

export interface AuditIssue {
  id: string;
  kind: 'seo' | 'aio';
  label: string;
  /** Points lost on this check (0 to its weight). */
  lost: number;
  detail?: string;
}

export interface PageScores {
  seoScore: number;
  aioScore: number;
  issues: AuditIssue[];
}

export interface PageContext {
  statusCode: number;
  /** Last modified date from the sitemap or the page's own schema. */
  lastModified: string | null;
  now?: Date;
}

interface Check {
  id: string;
  label: string;
  weight: number;
  /** 0 to 1, how much of the weight is earned. */
  earned: number;
  detail?: string;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const within = (length: number, min: number, max: number) => length >= min && length <= max;

function minWords(type: PageType): number {
  if (type === 'blog') return 300;
  if (type === 'collection' || type === 'home') return 80;
  return 150;
}

function seoChecks(s: PageSignals, type: PageType, ctx: PageContext): Check[] {
  const titleLength = s.title?.length ?? 0;
  const descriptionLength = s.metaDescription?.length ?? 0;
  const needed = minWords(type);
  return [
    { id: 'indexable', label: 'Page is indexable (HTTP 200, no noindex)', weight: 10, earned: ctx.statusCode === 200 && !s.noindex ? 1 : 0, detail: ctx.statusCode !== 200 ? `HTTP ${ctx.statusCode}` : s.noindex ? 'noindex is set' : undefined },
    { id: 'title-present', label: 'Has a title tag', weight: 6, earned: titleLength > 0 ? 1 : 0 },
    { id: 'title-length', label: 'Title is 30-60 characters', weight: 4, earned: titleLength === 0 ? 0 : within(titleLength, 30, 60) ? 1 : 0.4, detail: titleLength ? `${titleLength} characters` : undefined },
    { id: 'description-present', label: 'Has a meta description', weight: 10, earned: descriptionLength > 0 ? 1 : 0 },
    { id: 'description-length', label: 'Meta description is 70-160 characters', weight: 5, earned: descriptionLength === 0 ? 0 : within(descriptionLength, 70, 160) ? 1 : 0.4, detail: descriptionLength ? `${descriptionLength} characters` : undefined },
    { id: 'single-h1', label: 'Has exactly one H1', weight: 10, earned: s.h1s.length === 1 ? 1 : s.h1s.length > 1 ? 0.5 : 0, detail: `${s.h1s.length} H1 headings` },
    { id: 'canonical', label: 'Has a canonical URL', weight: 5, earned: s.canonical ? 1 : 0 },
    { id: 'content-length', label: `Has at least ${needed} words of content`, weight: 10, earned: clamp(s.wordCount / needed), detail: `${s.wordCount} words` },
    { id: 'image-alt', label: 'Images have alt text', weight: 10, earned: s.imageCount === 0 ? 1 : clamp(s.imagesWithAlt / s.imageCount), detail: s.imageCount ? `${s.imagesWithAlt} of ${s.imageCount} images` : undefined },
    { id: 'open-graph', label: 'Has Open Graph title and image', weight: 5, earned: (Number(s.ogTitle) + Number(s.ogImage)) / 2 },
    { id: 'internal-links', label: 'Links to at least 3 other pages', weight: 5, earned: clamp(s.internalLinks / 3), detail: `${s.internalLinks} internal links` },
    { id: 'viewport', label: 'Mobile viewport is set', weight: 5, earned: s.hasViewport ? 1 : 0 },
    { id: 'lang', label: 'Page language is set', weight: 5, earned: s.lang ? 1 : 0 },
    { id: 'structured-data', label: 'Has structured data (JSON-LD)', weight: 10, earned: s.schemaTypes.length > 0 ? 1 : 0 },
  ];
}

function schemaCheck(s: PageSignals, type: PageType): Check {
  const has = (...names: string[]) => names.some((name) => s.schemaTypes.includes(name));
  if (type === 'product') {
    const product = s.productSchema;
    const parts = product ? [true, product.hasOffer && product.hasPrice, product.hasAvailability, product.hasBrand] : [false, false, false, false];
    const missing = ['Product schema', 'price offer', 'availability', 'brand'].filter((_, index) => !parts[index]);
    return { id: 'aio-schema', label: 'Product schema with price, availability and brand', weight: 25, earned: parts.filter(Boolean).length / 4, detail: missing.length ? `Missing: ${missing.join(', ')}` : undefined };
  }
  if (type === 'blog') return { id: 'aio-schema', label: 'Article or BlogPosting schema', weight: 25, earned: has('Article', 'BlogPosting', 'NewsArticle') ? 1 : s.schemaTypes.length ? 0.3 : 0 };
  if (type === 'collection') return { id: 'aio-schema', label: 'Collection, ItemList or breadcrumb schema', weight: 25, earned: has('CollectionPage', 'ItemList', 'OfferCatalog') ? 1 : s.schemaTypes.length ? 0.4 : 0 };
  return { id: 'aio-schema', label: 'Organization, WebSite or page schema', weight: 25, earned: has('Organization', 'LocalBusiness', 'Store', 'WebSite', 'WebPage', 'FAQPage') ? 1 : s.schemaTypes.length ? 0.4 : 0 };
}

function aioChecks(s: PageSignals, type: PageType, ctx: PageContext): Check[] {
  const needed = minWords(type);
  const modified = s.dateModified ?? ctx.lastModified;
  const ageDays = modified ? ((ctx.now ?? new Date()).getTime() - new Date(modified).getTime()) / 86_400_000 : null;
  return [
    schemaCheck(s, type),
    { id: 'aio-breadcrumbs', label: 'Breadcrumb schema', weight: 5, earned: s.schemaTypes.includes('BreadcrumbList') ? 1 : 0 },
    { id: 'aio-answer-text', label: 'Enough descriptive text for an AI to quote', weight: 15, earned: clamp(s.wordCount / (needed * 1.5)), detail: `${s.wordCount} words` },
    { id: 'aio-summary', label: 'Clear summary (meta description)', weight: 10, earned: s.metaDescription ? (within(s.metaDescription.length, 70, 200) ? 1 : 0.5) : 0 },
    { id: 'aio-headings', label: 'Clear heading structure (an H1 and 2+ H2s)', weight: 15, earned: (s.h1s.length > 0 ? 0.35 : 0) + clamp(s.h2Count / 2) * 0.65 },
    { id: 'aio-specs', label: 'Specs or details in lists or tables', weight: 10, earned: s.hasListOrTable ? 1 : 0 },
    { id: 'aio-questions', label: 'Answers questions (FAQ schema or question headings)', weight: 10, earned: s.schemaTypes.includes('FAQPage') || s.questionHeadings > 0 ? 1 : 0 },
    { id: 'aio-freshness', label: 'Updated within the last year', weight: 5, earned: ageDays === null ? 0.4 : ageDays <= 365 ? 1 : ageDays <= 730 ? 0.5 : 0, detail: modified ? `Last modified ${modified.slice(0, 10)}` : 'No modified date found' },
    { id: 'aio-alt', label: 'Image alt text for AI image understanding', weight: 5, earned: s.imageCount === 0 ? 1 : clamp(s.imagesWithAlt / s.imageCount) },
  ];
}

function totalOf(checks: Check[]): number {
  const weight = checks.reduce((sum, check) => sum + check.weight, 0);
  return Math.round((checks.reduce((sum, check) => sum + check.weight * clamp(check.earned), 0) / weight) * 100);
}

const toIssues = (kind: 'seo' | 'aio', checks: Check[]): AuditIssue[] =>
  checks
    .filter((check) => check.earned < 1)
    .map((check) => ({ id: check.id, kind, label: check.label, lost: Math.round(check.weight * (1 - clamp(check.earned)) * 10) / 10, ...(check.detail ? { detail: check.detail } : {}) }));

export function scorePage(signals: PageSignals, type: PageType, ctx: PageContext): PageScores {
  const seo = seoChecks(signals, type, ctx);
  const aio = aioChecks(signals, type, ctx);
  const issues = [...toIssues('seo', seo), ...toIssues('aio', aio)].sort((a, b) => b.lost - a.lost);
  return { seoScore: totalOf(seo), aioScore: totalOf(aio), issues };
}

/** A page that could not be fetched or is not HTML scores zero with a single clear issue. */
export function failedPageScores(statusCode: number, reason: string): PageScores {
  return { seoScore: 0, aioScore: 0, issues: [{ id: 'fetch-failed', kind: 'seo', label: 'Page could not be audited', lost: 100, detail: reason || `HTTP ${statusCode}` }] };
}
