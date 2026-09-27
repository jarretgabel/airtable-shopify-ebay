import { parseKeyFeatureEntries } from './shopifyBodyHtml';

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
  'make',
  'model',
  'component type',
  'condition',
  'audiogon rating',
  'cosmetic notes',
  'testing notes',
  'serial number',
  'voltage',
  'original box',
  'original manual',
  'manual',
  'remote',
  'power cable',
  'additional items',
  'shipping method',
  'shipping weight',
  'shipping dimensions',
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
  const parsedKeyFeatures = parseKeyFeatureEntries(keyFeaturesRaw);
  const parsedTestingEntries = parseKeyFeatureEntries(normalizeTestingNotesForTemplate(testingNotesRaw));
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
      ...(ratingValue !== null && ratingValue <= 7
        ? includeWhenFilled('Cosmetic Notes', supplementalFields.cosmeticNotes)
        : []),
      ...includeWhenFilled('Testing Notes', testingNotes),
      { feature: 'Serial Number', value: supplementalFields.serialNumber?.trim() ?? '' },
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
  const entries = parseKeyFeatureEntries(rawValue);
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

export function buildEbayBodyHtmlFromTemplate(
  templateHtml: string,
  title: string,
  description: string,
  keyFeaturesRaw: string,
  testingNotesRaw = '',
  _makeValue = '',
  _modelValue = '',
  supplementalFields: EbaySupplementalBodyFields = {},
  aboutText = DEFAULT_HEAA_ABOUT_TEXT,
  templateCopy = '',
): string {
  const withTitle = replaceTemplateToken(templateHtml, 'title', title);
  const withTemplateCopy = applyTemplateCopy(withTitle, templateCopy);
  const withDescription = replaceTemplateToken(withTemplateCopy, 'description', description);
  const withAbout = replaceTemplateToken(withDescription, 'about', aboutText || DEFAULT_HEAA_ABOUT_TEXT);

  const detailEntries = buildOrderedDetailEntries(keyFeaturesRaw, testingNotesRaw, supplementalFields);
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
