interface WorkflowImageRecord {
  url: string;
  alt: string;
  sortOrder: number;
  includedInListing: boolean;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSortOrder(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}

function extractFilenameStem(filename: string): string {
  return filename.trim().replace(/\.[^.]+$/, '');
}

function buildFilename(url: string, fallback: string): string {
  const trimmedFallback = fallback.trim();
  if (trimmedFallback) return trimmedFallback;

  const urlPart = url.split('/').pop()?.trim() ?? '';
  return urlPart || 'Image';
}

function isLegacyWorkflowAltText(alt: string): boolean {
  const normalized = alt.trim().toLowerCase();
  if (!normalized) return true;

  const markers = [
    'intake',
    'testing',
    'photos',
    'photo',
    'original',
    'processed',
    'workflow',
  ];
  const markerCount = markers.reduce((count, marker) => count + (normalized.includes(marker) ? 1 : 0), 0);

  if (/\brec[a-z0-9]{8,}\b/i.test(normalized)) {
    return true;
  }

  if (markerCount >= 2) {
    return true;
  }

  if (markerCount >= 1 && /\b\d+\b/.test(normalized)) {
    return true;
  }

  return false;
}

function normalizeAltComparisonKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatWorkflowAltToken(token: string): string {
  if (/^[a-z]{1,4}\d{2,5}$/i.test(token)) {
    const prefix = token.match(/^[a-z]+/i)?.[0] ?? '';
    const suffix = token.slice(prefix.length);
    return `${prefix.toUpperCase()}${suffix}`;
  }

  return `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`;
}

function buildWorkflowAltFromFilename(filename: string, url: string): string {
  const stem = extractFilenameStem(filename) || extractFilenameStem(url.split('/').pop() ?? '');
  if (!stem) return '';

  const rawTokens = stem
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^rec[a-z0-9]{8,}$/.test(token));

  if (rawTokens.length === 0) {
    return '';
  }

  return rawTokens.slice(0, 10).map((token) => formatWorkflowAltToken(token)).join(' ');
}

function resolveWorkflowAltText(rawAlt: string, filename: string, url: string): string {
  const fallbackAlt = buildWorkflowAltFromFilename(filename, url);
  if (!rawAlt) {
    return fallbackAlt;
  }

  if (isLegacyWorkflowAltText(rawAlt)) {
    return fallbackAlt || rawAlt;
  }

  const fallbackWordCount = fallbackAlt.split(/\s+/).filter(Boolean).length;
  const rawWordCount = rawAlt.split(/\s+/).filter(Boolean).length;
  if (
    fallbackAlt
    && rawWordCount <= 2
    && fallbackWordCount >= 4
    && normalizeAltComparisonKey(rawAlt) !== normalizeAltComparisonKey(fallbackAlt)
  ) {
    return fallbackAlt;
  }

  return rawAlt;
}

function normalizeRecord(value: unknown, fallbackOrder: number): WorkflowImageRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const url =
    normalizeString(record.url) ||
    normalizeString(record.src) ||
    normalizeString(record.originalSource) ||
    normalizeString(record.original_source);
  if (!url) return null;
  const filename = buildFilename(url, normalizeString(record.filename) || normalizeString(record.name));
  const rawAlt = normalizeString(record.alt) || normalizeString(record.altText) || normalizeString(record.alt_text);

  return {
    url,
    alt: resolveWorkflowAltText(rawAlt, filename, url),
    sortOrder: normalizeSortOrder(record.sortOrder ?? record.sort_order ?? record.position, fallbackOrder),
    includedInListing: normalizeBoolean(
      record.includedInListing
      ?? record.included_in_listing
      ?? record.includeInListing
      ?? record.include_in_listing
      ?? record.included
      ?? record.isIncluded,
      true,
    ),
  };
}

function parseRawInput(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        const nested = obj.records ?? obj.images ?? obj.items ?? obj.data;
        if (Array.isArray(nested)) return nested;
        return [parsed];
      }
    } catch {
      // fall through
    }
    return [];
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nested = obj.records ?? obj.images ?? obj.items ?? obj.data;
    if (Array.isArray(nested)) return nested;
    return [raw];
  }
  return [];
}

export function parseWorkflowImageMetadata(raw: unknown): WorkflowImageRecord[] {
  return parseRawInput(raw)
    .map((item, index) => normalizeRecord(item, index + 1))
    .filter((record): record is WorkflowImageRecord => record !== null);
}

export function getIncludedWorkflowImages(records: WorkflowImageRecord[]): WorkflowImageRecord[] {
  return records
    .filter((record) => record.includedInListing)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
