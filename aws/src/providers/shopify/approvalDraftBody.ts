import {
  coerceStructuredToString,
  getField,
  getFieldPreservingStructuredValues,
  hasAnyField,
} from './approvalDraftFieldUtils.js';
import type { ApprovalFieldMap } from './approvalDraftTypes.js';
import {
  SHOPIFY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES,
  SHOPIFY_DEFAULT_VENDOR,
  SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES,
  type ShopifyBodyDynamicTokenSpec,
} from './approvalDraftTypes.js';

function parseDelimitedCells(line: string, delimiter: ',' | '\t'): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function parseKeyFeatureEntries(raw: string): Array<{ feature: string; value: string }> {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const feature = typeof record.feature === 'string' ? record.feature : typeof record.name === 'string' ? record.name : '';
        const value = typeof record.value === 'string' ? record.value : '';
        if (!feature.trim() && !value.trim()) return null;
        return { feature, value };
      }).filter((entry): entry is { feature: string; value: string } => entry !== null);
    }
  } catch {
    // Fall through.
  }
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const delimiter: ',' | '\t' | null = raw.includes('\t') ? '\t' : raw.includes(',') ? ',' : null;
  if (delimiter && lines.length > 0) {
    const rows = lines.map((line) => parseDelimitedCells(line, delimiter)).map((cells) => ({ feature: cells[0] ?? '', value: cells.slice(1).join(delimiter) })).filter((entry) => entry.feature.trim() || entry.value.trim());
    if (rows.length > 0) {
      const [first, ...rest] = rows;
      const hasHeader = ['key', 'feature'].includes(first.feature.trim().toLowerCase()) && ['value', 'pair'].includes(first.value.trim().toLowerCase());
      return hasHeader ? rest : rows;
    }
  }
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [feature, ...rest] = line.split(':');
    return { feature: feature?.trim() ?? '', value: rest.join(':').trim() };
  }).filter((entry) => entry.feature || entry.value);
}

function formatKeyFeatureHtml(raw: string): string {
  const entries = parseKeyFeatureEntries(raw);
  if (entries.length === 0) return '';
  return `<ul>${entries.map((entry) => entry.feature && entry.value ? `<li><strong>${entry.feature}:</strong> ${entry.value}</li>` : `<li>${entry.feature || entry.value}</li>`).join('')}</ul>`;
}

function formatDescriptionHtml(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return '<br>';
  const paragraphs = trimmed.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => paragraph.replace(/\r?\n/g, '<br />'));
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n');
}

function normalizeTemplateHtml(html: string): string {
  return html.replace(/\s(?:dir|role)=("[^"]*"|'[^']*')/gi, '').replace(/<(b|strong|em|i)\b[^>]*>\s*<\/\1>/gi, '').trim();
}

function hasTemplateTokens(html: string): boolean {
  return /\{\{\s*[a-z0-9_]+\s*\}\}/i.test(html);
}

function ensureListWrapped(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  if (/^<(ul|ol)\b/i.test(trimmed)) return trimmed;
  if (/^<li\b/i.test(trimmed)) return `<ul>${trimmed}</ul>`;
  return `<ul><li>${trimmed}</li></ul>`;
}

function extractKeyFeaturesHeading(html: string): string {
  const match = html.match(/<(h[1-6])\b[^>]*>\s*key features\s*<\/\1>/i);
  return match ? match[0].trim() : '';
}

function replaceFirstParagraph(html: string, replacement: string): string {
  const paragraphPattern = /<p\b[^>]*>[\s\S]*?<\/p>/i;
  if (paragraphPattern.test(html)) {
    return html.replace(paragraphPattern, replacement);
  }
  return replacement ? `${replacement}${html}` : html;
}

function replaceFirstList(html: string, replacement: string): string {
  const listPattern = /<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>/i;
  if (listPattern.test(html)) {
    return replacement ? html.replace(listPattern, replacement) : html.replace(listPattern, '');
  }
  if (!replacement) return html;
  const paragraphPattern = /<p\b[^>]*>[\s\S]*?<\/p>/i;
  const paragraphMatch = html.match(paragraphPattern);
  if (paragraphMatch && paragraphMatch.index !== undefined) {
    const insertAt = paragraphMatch.index + paragraphMatch[0].length;
    return `${html.slice(0, insertAt)}${replacement}${html.slice(insertAt)}`;
  }
  return `${html}${replacement}`;
}

export function buildShopifyBodyHtml(description: string, keyFeaturesRaw: string, templateHtml = ''): string {
  const descriptionHtml = formatDescriptionHtml(description);
  const keyFeaturesHtml = ensureListWrapped(formatKeyFeatureHtml(keyFeaturesRaw));
  const baseTemplate = normalizeTemplateHtml(templateHtml);
  if (!baseTemplate) {
    const parts = [descriptionHtml, keyFeaturesHtml].filter(Boolean);
    return parts.join('\n').trim();
  }
  if (!hasTemplateTokens(baseTemplate)) {
    const parts = [descriptionHtml];
    if (keyFeaturesHtml) {
      const heading = extractKeyFeaturesHeading(baseTemplate);
      if (heading) parts.push(heading);
      parts.push(keyFeaturesHtml);
    }
    return parts.join('\n').trim();
  }
  return replaceFirstList(replaceFirstParagraph(baseTemplate, descriptionHtml), keyFeaturesHtml).trim();
}

function formatBulletList(value: string): string {
  if (/<\/?(ul|ol|li)\b/i.test(value)) return value;
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  return `<ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>`;
}

const SHOPIFY_BODY_DYNAMIC_TOKEN_SPECS: ShopifyBodyDynamicTokenSpec[] = [
  { token: 'title', candidates: ['Shopify REST Title', 'Shopify Title', 'Item Title', 'Title', 'Name'] },
  { token: 'vendor', candidates: ['Shopify REST Vendor', 'Shopify Vendor', 'Vendor', 'Brand', 'Manufacturer'] },
  { token: 'product_type', candidates: [...SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES] },
  { token: 'condition', candidates: ['__Condition__', 'Item Condition', 'Condition', 'Shopify Condition', 'Shopify REST Condition'] },
  { token: 'price', candidates: ['Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'Price'] },
  { token: 'sku', candidates: ['Shopify REST Variant 1 SKU', 'SKU', 'shopify_rest_variant_1_sku'] },
  { token: 'body_description', candidates: ['Shopify Body Description', 'Shopify REST Body Description', 'Item Description', 'Description', 'shopify_body_description', 'shopify_rest_body_description'] },
  {
    token: 'body_key_features',
    candidates: [
      'Shopify Body Key Features JSON',
      'Shopify REST Body Key Features JSON',
      'Shopify Body Key Features',
      'Shopify REST Body Key Features',
      'Key Features JSON',
      'Key Features',
      'Features JSON',
      'Features',
      'shopify_body_key_features_json',
      'shopify_rest_body_key_features_json',
      'shopify_body_key_features',
      'shopify_rest_body_key_features',
    ],
    formatter: formatKeyFeatureHtml,
  },
  { token: 'body_intro', candidates: ['Shopify Body Intro', 'Shopify REST Body Intro', 'shopify_body_intro', 'shopify_rest_body_intro'] },
  { token: 'body_highlights', candidates: ['Shopify Body Highlights', 'Shopify REST Body Highlights', 'shopify_body_highlights', 'shopify_rest_body_highlights'], formatter: formatBulletList },
  { token: 'body_whats_included', candidates: ["Shopify Body What's Included", "Shopify REST Body What's Included", 'shopify_body_whats_included', 'shopify_rest_body_whats_included'] },
  { token: 'body_condition_notes', candidates: ['Shopify Body Condition Notes', 'Shopify REST Body Condition Notes', 'shopify_body_condition_notes', 'shopify_rest_body_condition_notes'] },
  { token: 'body_shipping_notes', candidates: ['Shopify Body Shipping Notes', 'Shopify REST Body Shipping Notes', 'shopify_body_shipping_notes', 'shopify_rest_body_shipping_notes'] },
];

export function getHandleField(fields: ApprovalFieldMap): string {
  const explicit = getField(fields, ['Shopify REST Handle', 'Shopify Handle', 'Shopify GraphQL Handle', 'shopify_rest_handle', 'shopify_handle', 'Handle', 'handle']);
  if (explicit.length > 0) return explicit;
  const fuzzy = Object.entries(fields).find(([key, value]) => key.toLowerCase().replace(/[^a-z0-9]/g, '').includes('handle') && coerceStructuredToString(value).length > 0);
  return fuzzy ? coerceStructuredToString(fuzzy[1]) : '';
}

function getBodyHtmlField(fields: ApprovalFieldMap): string {
  const explicit = getField(fields, ['Shopify REST Body HTML', 'Shopify Body HTML', 'Shopify GraphQL Description HTML', 'Body (HTML)', 'Body HTML', 'body_html', 'shopify_rest_body_html', 'Item Description', 'Description']);
  if (explicit.length > 0) return explicit;
  const fuzzy = Object.entries(fields).find(([key, value]) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (normalized.includes('bodyhtml') || normalized.includes('descriptionhtml')) && coerceStructuredToString(value).length > 0;
  });
  return fuzzy ? coerceStructuredToString(fuzzy[1]) : '';
}

export function resolveShopifyBodyHtml(fields: ApprovalFieldMap): string {
  const explicitTemplate = getField(fields, [...SHOPIFY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES]);
  const fallbackBodyHtml = getBodyHtmlField(fields);
  const template = explicitTemplate || '<p>{{body_description}}</p>{{body_key_features}}';
  if (!template) return '';
  const bodyDescriptionCandidates = SHOPIFY_BODY_DYNAMIC_TOKEN_SPECS.find((spec) => spec.token === 'body_description')?.candidates ?? [];
  const bodyKeyFeaturesCandidates = SHOPIFY_BODY_DYNAMIC_TOKEN_SPECS.find((spec) => spec.token === 'body_key_features')?.candidates ?? [];
  const rawKeyFeatures = getFieldPreservingStructuredValues(fields, ['Shopify Body Key Features JSON', 'Shopify REST Body Key Features JSON', 'Shopify Body Key Features', 'Shopify REST Body Key Features', 'Key Features JSON', 'Key Features', 'Features JSON', 'Features', 'shopify_body_key_features_json', 'shopify_rest_body_key_features_json', 'shopify_body_key_features', 'shopify_rest_body_key_features']);
  const tokenValues = new Map<string, string>();
  SHOPIFY_BODY_DYNAMIC_TOKEN_SPECS.forEach((spec) => {
    const rawValue = spec.token === 'vendor'
      ? SHOPIFY_DEFAULT_VENDOR
      : spec.token === 'body_key_features'
        ? getFieldPreservingStructuredValues(fields, spec.candidates)
        : getField(fields, spec.candidates);
    tokenValues.set(spec.token, spec.formatter ? spec.formatter(rawValue) : rawValue);
  });
  const bodyDescription = tokenValues.get('body_description') ?? '';
  const bodyKeyFeatures = tokenValues.get('body_key_features') ?? '';
  const hasEditableBodyFields = hasAnyField(fields, bodyDescriptionCandidates) || hasAnyField(fields, bodyKeyFeaturesCandidates);
  if (!explicitTemplate) {
    if (!hasEditableBodyFields) return fallbackBodyHtml;
    return buildShopifyBodyHtml(bodyDescription, rawKeyFeatures, fallbackBodyHtml);
  }
  if (bodyDescription || bodyKeyFeatures) {
    return buildShopifyBodyHtml(bodyDescription, rawKeyFeatures, explicitTemplate);
  }
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, tokenName: string) => tokenValues.get(tokenName.toLowerCase()) ?? '');
}