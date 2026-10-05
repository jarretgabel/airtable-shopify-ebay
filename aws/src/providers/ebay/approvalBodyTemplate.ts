import type { ApprovalEbayBodyPreviewInput as EbayBodyPreviewInput } from '../../shared/contracts/approval.js';
import { parseDelimitedCells, parseKeyFeatureEntries } from './approvalShared.js';

interface EbayTemplateEntry {
  feature: string;
  value: string;
}

interface EbaySupplementalBodyFields {
  componentType?: string;
  serialNumber?: string;
  cosmeticNotes?: string;
  originalBox?: string;
  powerCable?: string;
  manual?: string;
  voltage?: string;
  additionalItems?: string;
  shippingMethod?: string;
  shippingWeight?: string;
  shippingDimensions?: string;
  audiogonRating?: string;
}

const DEFAULT_HEAA_ABOUT_TEXT = 'High-End Audio Auctions has been THE trusted source for high-end, classic and vintage audio components on eBay since 2000. Our unique products, unparalleled service and bombproof packaging keeps customers coming back again and again. We are experts at worldwide selling and shipping, with items ranging from $5 to $50,000.';

function normalizeTemplateFeatureName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

const RESERVED_DETAILS_FEATURES = new Set([
  'make', 'model', 'component type', 'condition', 'audiogon rating', 'cosmetic notes',
  'testing notes', 'serial number', 'voltage', 'original box', 'original manual',
  'manual', 'remote', 'power cable', 'additional items', 'shipping method',
  'shipping weight', 'shipping dimensions',
]);

function parseAudiogonRating(raw: string): number | null {
  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function includeWhenFilled(feature: string, value: string | undefined): EbayTemplateEntry[] {
  const trimmed = value?.trim() ?? '';
  return trimmed ? [{ feature, value: trimmed }] : [];
}

function buildOrderedDetailEntries(
  keyFeaturesRaw: string,
  testingNotesRaw: string,
  supplementalFields: EbaySupplementalBodyFields,
): { main: EbayTemplateEntry[]; trailing: EbayTemplateEntry[] } {
  const parsedKeyFeatures = parseTemplateKeyFeatureEntries(keyFeaturesRaw);
  const parsedTestingEntries = parseTemplateKeyFeatureEntries(normalizeTestingNotesForTemplate(testingNotesRaw));
  const testingNotes = parsedTestingEntries
    .filter((entry) => normalizeTemplateFeatureName(entry.feature) === 'testing notes')
    .map((entry) => entry.value.trim())
    .filter(Boolean)
    .join('<br />');
  const otherFeatures = [...parsedKeyFeatures, ...parsedTestingEntries]
    .filter((entry) => !RESERVED_DETAILS_FEATURES.has(normalizeTemplateFeatureName(entry.feature)))
    .filter((entry) => entry.feature.trim() || entry.value.trim());
  const audiogonRating = supplementalFields.audiogonRating?.trim() ?? '';
  const ratingValue = parseAudiogonRating(audiogonRating);
  const powerCableApplies = !/\b(?:cables?|speakers?|subwoofers?|monitors?)\b/i.test(supplementalFields.componentType ?? '');

  return {
    main: [
      ...includeWhenFilled('Audiogon Rating', audiogonRating),
      ...(ratingValue !== null && ratingValue <= 7 ? includeWhenFilled('Cosmetic Notes', supplementalFields.cosmeticNotes) : []),
      ...includeWhenFilled('Testing Notes', testingNotes),
      ...includeWhenFilled('Serial Number', supplementalFields.serialNumber),
      ...includeWhenFilled('Voltage', supplementalFields.voltage),
      ...otherFeatures,
    ],
    trailing: [
      ...includeWhenFilled('Original Box', supplementalFields.originalBox),
      ...includeWhenFilled('Original Manual', supplementalFields.manual),
      ...(powerCableApplies ? includeWhenFilled('Power Cable', supplementalFields.powerCable) : []),
      ...includeWhenFilled('Additional Items', supplementalFields.additionalItems),
      ...includeWhenFilled('Shipping Method', supplementalFields.shippingMethod),
      ...includeWhenFilled('Shipping Weight', supplementalFields.shippingWeight),
      ...includeWhenFilled('Shipping Dimensions', supplementalFields.shippingDimensions),
    ],
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceTemplateToken(templateHtml: string, token: string, replacement: string): string {
  const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'gi');
  return templateHtml.replace(pattern, replacement);
}

function applyTemplateCopy(templateHtml: string, templateCopy: string): string {
  const normalizedTemplateCopy = templateCopy.trim();
  const hasTemplateCopyToken = /\{\{\s*template_copy\s*\}\}/i.test(templateHtml);

  if (hasTemplateCopyToken) {
    return replaceTemplateToken(templateHtml, 'template_copy', normalizedTemplateCopy);
  }

  if (!normalizedTemplateCopy) {
    return templateHtml;
  }

  if (/\{\{\s*description\s*\}\}/i.test(templateHtml)) {
    return templateHtml.replace(/(\{\{\s*description\s*\}\})/i, `${normalizedTemplateCopy}$1`);
  }

  return `${normalizedTemplateCopy}${templateHtml}`;
}

function parseTemplateKeyFeatureEntries(raw: string): Array<{ feature: string; value: string }> {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          const feature = typeof record.feature === 'string'
            ? record.feature
            : typeof record.name === 'string'
              ? record.name
              : '';
          const value = typeof record.value === 'string' ? record.value : '';
          if (!feature.trim() && !value.trim()) return null;
          return { feature, value };
        })
        .filter((entry): entry is { feature: string; value: string } => entry !== null);
    }
  } catch {
    // Fall through.
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const delimiter: ',' | '\t' | null = raw.includes('\t') ? '\t' : raw.includes(',') ? ',' : null;
  if (delimiter && lines.length > 0) {
    return lines
      .map((line) => parseDelimitedCells(line, delimiter))
      .map((cells) => ({
        feature: cells[0] ?? '',
        value: cells.slice(1).join(delimiter),
      }))
      .filter((entry) => entry.feature.trim() || entry.value.trim());
  }

  return parseKeyFeatureEntries(raw);
}

function applyTableRows(templateHtml: string, options: {
  tableId: string;
  rawValue: string;
  keyToken?: string;
  valueToken?: string;
}): string {
  const {
    tableId,
    rawValue,
    keyToken = 'key',
    valueToken = 'value',
  } = options;
  const tablePattern = new RegExp(`(<table\\b[^>]*\\bid=(['"])${escapeRegExp(tableId)}\\2[^>]*>[\\s\\S]*?<tbody\\b[^>]*>)([\\s\\S]*?)(<\\/tbody>[\\s\\S]*?<\\/table>)`, 'i');
  const tableMatch = templateHtml.match(tablePattern);
  if (!tableMatch) {
    return templateHtml;
  }

  const tablePrefix = tableMatch[1] ?? '';
  const tableBodyHtml = tableMatch[3] ?? '';
  const tableSuffix = tableMatch[4] ?? '';
  const rowPattern = /<tr\b[\s\S]*?<\/tr>/i;
  const rowMatch = tableBodyHtml.match(rowPattern);
  if (!rowMatch) {
    return templateHtml.replace(tablePattern, `${tablePrefix}${tableBodyHtml}${tableSuffix}`);
  }

  const templateRow = rowMatch[0];
  const entries = parseTemplateKeyFeatureEntries(rawValue);
  const renderedRows = entries.map((entry) => {
    const withKey = replaceTemplateToken(templateRow, keyToken, entry.feature);
    return replaceTemplateToken(withKey, valueToken, entry.value);
  }).join('\n');

  const nextBody = tableBodyHtml.replace(rowPattern, renderedRows);
  return templateHtml.replace(tablePattern, `${tablePrefix}${nextBody}${tableSuffix}`);
}

function normalizeTestingNotesForTemplate(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return rawValue;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  return JSON.stringify([{ feature: 'Testing Notes', value: lines.join('<br />') }]);
}

export function buildEbayBodyHtmlFromTemplate(input: EbayBodyPreviewInput): string {
  const withTitle = replaceTemplateToken(input.templateHtml, 'title', input.title);
  const withTemplateCopy = applyTemplateCopy(withTitle, input.templateCopy ?? '');
  const withDescription = replaceTemplateToken(withTemplateCopy, 'description', input.description);
  const withAbout = replaceTemplateToken(withDescription, 'about', (input.about ?? '').trim() || DEFAULT_HEAA_ABOUT_TEXT);
  const detailEntries = buildOrderedDetailEntries(input.keyFeatures, input.testingNotes ?? '', {
    componentType: input.componentType,
    serialNumber: input.serialNumber,
    cosmeticNotes: input.cosmeticNotes,
    originalBox: input.originalBox,
    powerCable: input.powerCable,
    manual: input.manual,
    voltage: input.voltage,
    additionalItems: input.additionalItems,
    shippingMethod: input.shippingMethod,
    shippingWeight: input.shippingWeight,
    shippingDimensions: input.shippingDimensions,
    audiogonRating: input.audiogonRating,
  });
  const hasKeyFeaturesTable = /<table\b[^>]*\bid=(['"])key-features\1/i.test(withAbout);
  const hasTestingNotesTable = /<table\b[^>]*\bid=(['"])testing-notes\1/i.test(withAbout);
  const keyFeatureEntries = hasKeyFeaturesTable && !hasTestingNotesTable
    ? [...detailEntries.main, ...detailEntries.trailing]
    : detailEntries.main;
  const testingEntries = hasTestingNotesTable && !hasKeyFeaturesTable
    ? [...detailEntries.main, ...detailEntries.trailing]
    : detailEntries.trailing;
  const withKeyFeatures = applyTableRows(withAbout, {
    tableId: 'key-features',
    rawValue: JSON.stringify(keyFeatureEntries),
  });

  return applyTableRows(withKeyFeatures, {
    tableId: 'testing-notes',
    rawValue: JSON.stringify(testingEntries),
  }).trim();
}