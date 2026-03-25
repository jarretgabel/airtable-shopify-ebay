import { parseKeyFeatureEntries } from './shopifyBodyHtml';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceTemplateToken(templateHtml: string, token: string, replacement: string): string {
  const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'gi');
  return templateHtml.replace(pattern, replacement);
}

function applyKeyFeatureRows(templateHtml: string, keyFeaturesRaw: string): string {
  const tablePattern = /(<table\b[^>]*\bid=(['"])key-features\2[^>]*>[\s\S]*?<tbody\b[^>]*>)([\s\S]*?)(<\/tbody>[\s\S]*?<\/table>)/i;
  const tableMatch = templateHtml.match(tablePattern);
  if (!tableMatch) {
    return templateHtml
      .replace(/\{\{\s*key\s*\}\}/gi, '')
      .replace(/\{\{\s*value\s*\}\}/gi, '');
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
  const entries = parseKeyFeatureEntries(keyFeaturesRaw);
  const renderedRows = entries.map((entry) => {
    const withKey = replaceTemplateToken(templateRow, 'key', entry.feature);
    return replaceTemplateToken(withKey, 'value', entry.value);
  }).join('\n');

  const nextBody = tableBodyHtml.replace(rowPattern, renderedRows);
  return templateHtml.replace(tablePattern, `${tablePrefix}${nextBody}${tableSuffix}`);
}

export function buildEbayBodyHtmlFromTemplate(
  templateHtml: string,
  title: string,
  description: string,
  keyFeaturesRaw: string,
): string {
  const withTitle = replaceTemplateToken(templateHtml, 'title', title);
  const withDescription = replaceTemplateToken(withTitle, 'description', description);
  return applyKeyFeatureRows(withDescription, keyFeaturesRaw).trim();
}
