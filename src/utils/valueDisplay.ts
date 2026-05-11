const PREFERRED_OBJECT_KEYS = [
  'text',
  'name',
  'label',
  'title',
  'value',
  'sku',
  'componentType',
  'displayName',
] as const;

const IGNORED_PRIMITIVE_KEYS = new Set(['id', 'url']);

function isPrimitiveDisplayValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function primitiveToString(value: string | number | boolean): string {
  return String(value).trim();
}

function collectDisplaySegments(value: unknown): string[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const normalized = primitiveToString(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectDisplaySegments(entry));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    for (const key of PREFERRED_OBJECT_KEYS) {
      if (!(key in record)) continue;

      const segments = collectDisplaySegments(record[key]);
      if (segments.length > 0) {
        return segments;
      }
    }

    const primitiveEntries = Object.entries(record)
      .filter((entry): entry is [string, string | number | boolean] => !IGNORED_PRIMITIVE_KEYS.has(entry[0]) && isPrimitiveDisplayValue(entry[1]))
      .map(([, entryValue]) => primitiveToString(entryValue))
      .filter(Boolean);

    if (primitiveEntries.length === 1) {
      return primitiveEntries;
    }

    if (Object.keys(record).length === 1) {
      return collectDisplaySegments(Object.values(record)[0]);
    }

    return [];
  }

  return [];
}

export function extractReadableValue(value: unknown): string {
  return collectDisplaySegments(value)[0] ?? '';
}

export function displayReadableValue(value: unknown, emptyFallback: string): string {
  const segments = collectDisplaySegments(value);
  return segments.length > 0 ? segments.join(', ') : emptyFallback;
}