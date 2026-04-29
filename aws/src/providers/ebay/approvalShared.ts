export type ApprovalFieldMap = Record<string, unknown>;

export function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function getField(fields: ApprovalFieldMap, candidates: string[]): string {
  for (const candidate of candidates) {
    const direct = coerceToString(fields[candidate]);
    if (direct.length > 0) return direct;
  }

  const normalizedMap = new Map<string, unknown>();
  Object.entries(fields).forEach(([key, value]) => normalizedMap.set(normalizeKey(key), value));
  for (const candidate of candidates) {
    const value = coerceToString(normalizedMap.get(normalizeKey(candidate)));
    if (value.length > 0) return value;
  }

  return '';
}

export function getRawField(fields: ApprovalFieldMap, candidates: string[]): unknown {
  const hasUsableValue = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return true;
  };

  for (const candidate of candidates) {
    const direct = fields[candidate];
    if (hasUsableValue(direct)) return direct;
  }

  const normalizedMap = new Map<string, unknown>();
  Object.entries(fields).forEach(([key, value]) => normalizedMap.set(normalizeKey(key), value));
  for (const candidate of candidates) {
    const value = normalizedMap.get(normalizeKey(candidate));
    if (hasUsableValue(value)) return value;
  }

  return undefined;
}

export function parseInteger(raw: string, fallback: number): number {
  const parsed = parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseDelimitedCells(line: string, delimiter: ',' | '\t'): string[] {
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
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

export function parseKeyFeatureEntries(raw: string): Array<{ feature: string; value: string }> {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const feature = typeof record.feature === 'string' ? record.feature : typeof record.name === 'string' ? record.name : '';
        const value = typeof record.value === 'string' ? record.value : '';
        if (!feature.trim() && !value.trim()) return null;
        return { feature, value };
      }).filter((entry): entry is { feature: string; value: string } => entry !== null);
    }
  } catch {
    // Fall through.
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const delimiter: ',' | '\t' | null = raw.includes('\t') ? '\t' : raw.includes(',') ? ',' : null;
  if (delimiter && lines.length > 0) {
    const rows = lines.map((line) => parseDelimitedCells(line, delimiter)).map((cells) => ({ feature: cells[0] ?? '', value: cells.slice(1).join(delimiter) })).filter((entry) => entry.feature.trim() || entry.value.trim());
    if (rows.length > 0) return rows;
  }

  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [feature, ...rest] = line.split(':');
    return { feature: feature?.trim() ?? '', value: rest.join(':').trim() };
  }).filter((entry) => entry.feature || entry.value);
}