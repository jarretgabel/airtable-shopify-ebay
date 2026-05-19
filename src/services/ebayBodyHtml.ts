import { parseKeyFeatureEntries } from './shopifyBodyHtml';

interface EbayTemplateEntry {
  feature: string;
  value: string;
}

interface EbaySupplementalBodyFields {
  componentType?: string;
  serialNumber?: string;
  condition?: string;
  originalBox?: string;
  remote?: string;
  powerCable?: string;
  manual?: string;
  voltage?: string;
  audiogonRating?: string;
}

function normalizeTemplateFeatureName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function buildMakeModelTemplateEntries(makeValue: string, modelValue: string): EbayTemplateEntry[] {
  const entries: EbayTemplateEntry[] = [];

  if (makeValue.trim()) {
    entries.push({ feature: 'Make', value: makeValue.trim() });
  }

  if (modelValue.trim()) {
    entries.push({ feature: 'Model', value: modelValue.trim() });
  }

  return entries;
}

function buildSupplementalTemplateEntries(entries: ReadonlyArray<EbayTemplateEntry>): EbayTemplateEntry[] {
  return entries
    .filter((entry) => entry.value.trim())
    .map((entry) => ({ feature: entry.feature, value: entry.value.trim() }));
}

function mergeTemplateEntries(rawValue: string, supplementalEntries: ReadonlyArray<EbayTemplateEntry>, options: {
  supplementalFirst?: boolean;
} = {}): string {
  if (supplementalEntries.length === 0) return rawValue;

  const parsedEntries = parseKeyFeatureEntries(rawValue);
  const blockedFeatureNames = new Set(supplementalEntries.map((entry) => normalizeTemplateFeatureName(entry.feature)));
  const overridingEntriesByName = new Map(
    parsedEntries
      .filter((entry) => blockedFeatureNames.has(normalizeTemplateFeatureName(entry.feature)))
      .map((entry) => [normalizeTemplateFeatureName(entry.feature), entry] as const),
  );
  const filteredEntries = parsedEntries.filter((entry) => !blockedFeatureNames.has(normalizeTemplateFeatureName(entry.feature)));
  const orderedSupplementalEntries = supplementalEntries.map((entry) => {
    const overrideEntry = overridingEntriesByName.get(normalizeTemplateFeatureName(entry.feature));
    return overrideEntry ? { feature: entry.feature, value: overrideEntry.value } : entry;
  });

  return JSON.stringify(options.supplementalFirst === false
    ? [...filteredEntries, ...orderedSupplementalEntries]
    : [...orderedSupplementalEntries, ...filteredEntries]);
}

function mergeTemplateKeyFeatureEntries(
  rawValue: string,
  makeValue: string,
  modelValue: string,
  supplementalFields: EbaySupplementalBodyFields = {},
): string {
  return mergeTemplateEntries(rawValue, buildSupplementalTemplateEntries([
    ...buildMakeModelTemplateEntries(makeValue, modelValue),
    { feature: 'Component Type', value: supplementalFields.componentType ?? '' },
    { feature: 'Serial Number', value: supplementalFields.serialNumber ?? '' },
    { feature: 'Condition', value: supplementalFields.condition ?? '' },
    { feature: 'Original Box', value: supplementalFields.originalBox ?? '' },
    { feature: 'Remote', value: supplementalFields.remote ?? '' },
    { feature: 'Power Cable', value: supplementalFields.powerCable ?? '' },
    { feature: 'Manual', value: supplementalFields.manual ?? '' },
  ]));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceTemplateToken(templateHtml: string, token: string, replacement: string): string {
  const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'gi');
  return templateHtml.replace(pattern, replacement);
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

function mergeTemplateTestingEntries(rawValue: string, supplementalFields: EbaySupplementalBodyFields = {}): string {
  const mergedEntries = parseKeyFeatureEntries(mergeTemplateEntries(normalizeTestingNotesForTemplate(rawValue), buildSupplementalTemplateEntries([
    { feature: 'Voltage', value: supplementalFields.voltage ?? '' },
    { feature: 'Audiogon Rating', value: supplementalFields.audiogonRating ?? '' },
  ]), { supplementalFirst: false }));
  const normalizedTestingNotesFeature = normalizeTemplateFeatureName('Testing Notes');
  const testingNotesEntries = mergedEntries.filter((entry) => normalizeTemplateFeatureName(entry.feature) === normalizedTestingNotesFeature);
  const otherEntries = mergedEntries.filter((entry) => normalizeTemplateFeatureName(entry.feature) !== normalizedTestingNotesFeature);

  return JSON.stringify([...otherEntries, ...testingNotesEntries]);
}

export function buildEbayBodyHtmlFromTemplate(
  templateHtml: string,
  title: string,
  description: string,
  keyFeaturesRaw: string,
  testingNotesRaw = '',
  makeValue = '',
  modelValue = '',
  supplementalFields: EbaySupplementalBodyFields = {},
): string {
  const withTitle = replaceTemplateToken(templateHtml, 'title', title);
  const withDescription = replaceTemplateToken(withTitle, 'description', description);
  const withKeyFeatures = applyTableRows(withDescription, {
    tableId: 'key-features',
    rawValue: mergeTemplateKeyFeatureEntries(keyFeaturesRaw, makeValue, modelValue, supplementalFields),
  });

  return applyTableRows(withKeyFeatures, {
    tableId: 'testing-notes',
    rawValue: mergeTemplateTestingEntries(testingNotesRaw, supplementalFields),
  }).trim();
}
