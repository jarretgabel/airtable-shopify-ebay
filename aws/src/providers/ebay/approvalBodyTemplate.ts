import type { ApprovalEbayBodyPreviewInput as EbayBodyPreviewInput } from '../../shared/contracts/approval.js';
import { parseDelimitedCells, parseKeyFeatureEntries } from './approvalShared.js';

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

  const parsedEntries = parseTemplateKeyFeatureEntries(rawValue);
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

function mergeTemplateTestingEntries(rawValue: string, supplementalFields: EbaySupplementalBodyFields = {}): string {
  return mergeTemplateEntries(normalizeTestingNotesForTemplate(rawValue), buildSupplementalTemplateEntries([
    { feature: 'Voltage', value: supplementalFields.voltage ?? '' },
    { feature: 'Audiogon Rating', value: supplementalFields.audiogonRating ?? '' },
  ]), { supplementalFirst: false });
}

export function buildEbayBodyHtmlFromTemplate(input: EbayBodyPreviewInput): string {
  const withTitle = replaceTemplateToken(input.templateHtml, 'title', input.title);
  const withDescription = replaceTemplateToken(withTitle, 'description', input.description);
  const withKeyFeatures = applyTableRows(withDescription, {
    tableId: 'key-features',
    rawValue: mergeTemplateKeyFeatureEntries(input.keyFeatures, input.make ?? '', input.model ?? '', {
      componentType: input.componentType,
      serialNumber: input.serialNumber,
      condition: input.condition,
      originalBox: input.originalBox,
      remote: input.remote,
      powerCable: input.powerCable,
      manual: input.manual,
      voltage: input.voltage,
      audiogonRating: input.audiogonRating,
    }),
  });

  return applyTableRows(withKeyFeatures, {
    tableId: 'testing-notes',
    rawValue: mergeTemplateTestingEntries(input.testingNotes ?? '', {
      originalBox: input.originalBox,
      remote: input.remote,
      powerCable: input.powerCable,
      manual: input.manual,
      voltage: input.voltage,
      audiogonRating: input.audiogonRating,
    }),
  }).trim();
}