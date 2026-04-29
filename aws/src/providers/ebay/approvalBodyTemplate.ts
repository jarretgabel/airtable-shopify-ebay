import type { ApprovalEbayBodyPreviewInput as EbayBodyPreviewInput } from '../../shared/contracts/approval.js';
import { parseDelimitedCells, parseKeyFeatureEntries } from './approvalShared.js';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceTemplateToken(templateHtml: string, token: string, replacement: string): string {
  const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`, 'gi');
  return templateHtml.replace(pattern, replacement);
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

export function buildEbayBodyHtmlFromTemplate(input: EbayBodyPreviewInput): string {
  const withTitle = replaceTemplateToken(input.templateHtml, 'title', input.title);
  const withDescription = replaceTemplateToken(withTitle, 'description', input.description);
  const withKeyFeatures = applyTableRows(withDescription, {
    tableId: 'key-features',
    rawValue: input.keyFeatures,
  });

  return applyTableRows(withKeyFeatures, {
    tableId: 'testing-notes',
    rawValue: input.testingNotes ?? '',
  }).trim();
}