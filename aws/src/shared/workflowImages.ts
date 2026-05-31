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

function normalizeRecord(value: unknown, fallbackOrder: number): WorkflowImageRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const url =
    normalizeString(record.url) ||
    normalizeString(record.src) ||
    normalizeString(record.originalSource) ||
    normalizeString(record.original_source);
  if (!url) return null;
  return {
    url,
    alt: normalizeString(record.alt) || normalizeString(record.altText) || normalizeString(record.alt_text),
    sortOrder: normalizeSortOrder(record.sortOrder ?? record.sort_order ?? record.position, fallbackOrder),
    includedInListing:
      typeof (record.includedInListing ?? record.included_in_listing) === 'boolean'
        ? Boolean(record.includedInListing ?? record.included_in_listing)
        : true,
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
