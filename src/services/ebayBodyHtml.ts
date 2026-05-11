import { parseKeyFeatureEntries } from './shopifyBodyHtml';

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
  if (trimmed.startsWith('[') || trimmed.includes('\t') || trimmed.includes(',') || trimmed.includes(':')) {
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
): string {
  const withTitle = replaceTemplateToken(templateHtml, 'title', title);
  const withDescription = replaceTemplateToken(withTitle, 'description', description);
  const withKeyFeatures = applyTableRows(withDescription, {
    tableId: 'key-features',
    rawValue: keyFeaturesRaw,
  });

  return applyTableRows(withKeyFeatures, {
    tableId: 'testing-notes',
    rawValue: normalizeTestingNotesForTemplate(testingNotesRaw),
  }).trim();
}
