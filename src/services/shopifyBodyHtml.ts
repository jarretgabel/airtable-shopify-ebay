interface KeyFeatureEntry {
  feature: string;
  value: string;
}

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
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvOrTsvKeyFeatureEntries(raw: string): KeyFeatureEntry[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter: ',' | '\t' | null = raw.includes('\t')
    ? '\t'
    : raw.includes(',')
      ? ','
      : null;

  if (!delimiter) return [];

  if (lines.length === 1 && !lines[0].includes(':')) {
    const flatCells = parseDelimitedCells(lines[0], delimiter).filter((cell) => cell.length > 0);
    if (flatCells.length >= 2) {
      if (flatCells.length === 2) {
        return [{ feature: flatCells[0], value: flatCells[1] }];
      }

      const entries: KeyFeatureEntry[] = [];
      for (let index = 0; index < flatCells.length; index += 2) {
        const feature = flatCells[index] ?? '';
        const value = flatCells[index + 1] ?? '';
        if (feature || value) entries.push({ feature, value });
      }
      return entries;
    }
  }

  const rows = lines
    .map((line) => parseDelimitedCells(line, delimiter))
    .map((cells) => ({
      feature: cells[0] ?? '',
      value: cells.slice(1).join(delimiter).trim(),
    }))
    .filter((entry) => entry.feature || entry.value);

  if (rows.length === 0) return [];

  const [first, ...rest] = rows;
  const firstFeature = first.feature.toLowerCase();
  const firstValue = first.value.toLowerCase();
  const hasHeader = (firstFeature === 'key' || firstFeature === 'feature') && (firstValue === 'value' || firstValue === 'pair');
  return hasHeader ? rest : rows;
}

export function parseKeyFeatureEntries(raw: string): KeyFeatureEntry[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          const feature = typeof record.feature === 'string'
            ? record.feature.trim()
            : typeof record.name === 'string'
              ? record.name.trim()
              : '';
          const value = typeof record.value === 'string' ? record.value.trim() : '';
          if (!feature && !value) return null;
          return { feature, value };
        })
        .filter((entry): entry is KeyFeatureEntry => entry !== null);
    }
  } catch {
    // fall through to plain text parsing
  }

  const csvOrTsvEntries = parseCsvOrTsvKeyFeatureEntries(trimmed);
  if (csvOrTsvEntries.length > 0) {
    return csvOrTsvEntries
      .map((entry) => ({ feature: entry.feature.trim(), value: entry.value.trim() }))
      .filter((entry) => entry.feature || entry.value);
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [feature, ...rest] = line.split(':');
      return {
        feature: feature?.trim() ?? '',
        value: rest.join(':').trim(),
      };
    })
    .filter((entry) => entry.feature || entry.value);
}

export function formatKeyFeatureHtml(raw: string): string {
  const entries = parseKeyFeatureEntries(raw);
  if (entries.length === 0) return '';

  return `<ul>${entries.map((entry) => {
    if (entry.feature && entry.value) {
      return `<li><strong>${entry.feature}:</strong> ${entry.value}</li>`;
    }
    return `<li>${entry.feature || entry.value}</li>`;
  }).join('')}</ul>`;
}

function formatDescriptionHtml(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return '<br>';

  const paragraphs = trimmed
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => paragraph.replace(/\r?\n/g, '<br />'));

  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n');
}

function stripDirAndRoleAttributes(html: string): string {
  return html.replace(/\s(?:dir|role)=("[^"]*"|'[^']*')/gi, '');
}

function unwrapSpanTags(html: string): string {
  let nextHtml = html;
  while (/<span\b[^>]*>/i.test(nextHtml)) {
    const unwrapped = nextHtml.replace(/<span\b[^>]*>([\s\S]*?)<\/span>/gi, '$1');
    if (unwrapped === nextHtml) break;
    nextHtml = unwrapped;
  }
  return nextHtml;
}

function removeEmptyFormattingTags(html: string): string {
  return html.replace(/<(b|strong|em|i)\b[^>]*>\s*<\/\1>/gi, '');
}

function normalizeTemplateHtml(html: string): string {
  return removeEmptyFormattingTags(unwrapSpanTags(stripDirAndRoleAttributes(html))).trim();
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

function buildStructuredBodyHtml(
  descriptionHtml: string,
  keyFeaturesHtml: string,
  keyFeaturesHeading = '',
): string {
  const parts: string[] = [];

  if (descriptionHtml) {
    parts.push(descriptionHtml);
  }

  if (keyFeaturesHtml) {
    if (keyFeaturesHeading) {
      parts.push(keyFeaturesHeading);
    }
    parts.push(keyFeaturesHtml);
  }

  return parts.join('\n').trim();
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
    return buildStructuredBodyHtml(descriptionHtml, keyFeaturesHtml);
  }

  if (!hasTemplateTokens(baseTemplate)) {
    const keyFeaturesHeading = keyFeaturesHtml ? extractKeyFeaturesHeading(baseTemplate) : '';
    return buildStructuredBodyHtml(descriptionHtml, keyFeaturesHtml, keyFeaturesHeading);
  }

  const withDescription = replaceFirstParagraph(baseTemplate, descriptionHtml);
  const withFeatures = replaceFirstList(withDescription, keyFeaturesHtml);
  return withFeatures.trim();
}
