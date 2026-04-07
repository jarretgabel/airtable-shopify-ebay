import { parseKeyFeatureEntries } from '@/services/shopifyBodyHtml';

export interface EbayAspectRow {
  name: string;
  value: string;
}

export type EbayAspectMap = Record<string, string[]>;

function normalizeAspectName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function pushAspect(map: Map<string, string[]>, name: string, value: string) {
  const normalizedName = normalizeAspectName(name);
  const normalizedValue = value.trim();
  if (!normalizedName || !normalizedValue) return;

  const existingValues = map.get(normalizedName) ?? [];
  if (!existingValues.some((entry) => entry.toLowerCase() === normalizedValue.toLowerCase())) {
    map.set(normalizedName, [...existingValues, normalizedValue]);
  }
}

function finalizeAspectMap(map: Map<string, string[]>): EbayAspectMap | undefined {
  if (map.size === 0) return undefined;
  return Object.fromEntries(map.entries());
}

function parseAspectObjectRecord(record: Record<string, unknown>, map: Map<string, string[]>) {
  Object.entries(record).forEach(([name, rawValue]) => {
    if (Array.isArray(rawValue)) {
      rawValue.forEach((entry) => {
        if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
          pushAspect(map, name, String(entry));
        }
      });
      return;
    }

    if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      pushAspect(map, name, String(rawValue));
    }
  });
}

export function parseEbayAspects(raw: unknown): EbayAspectMap | undefined {
  const aspects = new Map<string, string[]>();

  const visit = (value: unknown) => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;

        const record = entry as Record<string, unknown>;
        const name = typeof record.name === 'string'
          ? record.name
          : typeof record.feature === 'string'
            ? record.feature
            : typeof record.key === 'string'
              ? record.key
              : '';

        if (!name.trim()) return;

        const rawValues = record.values ?? record.value;
        if (Array.isArray(rawValues)) {
          rawValues.forEach((item) => {
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
              pushAspect(aspects, name, String(item));
            }
          });
          return;
        }

        if (typeof rawValues === 'string' || typeof rawValues === 'number' || typeof rawValues === 'boolean') {
          pushAspect(aspects, name, String(rawValues));
        }
      });
      return;
    }

    if (value && typeof value === 'object') {
      parseAspectObjectRecord(value as Record<string, unknown>, aspects);
      return;
    }

    const text = typeof value === 'string' ? value.trim() : String(value).trim();
    if (!text) return;

    try {
      visit(JSON.parse(text));
      return;
    } catch {
      parseKeyFeatureEntries(text).forEach((entry) => {
        pushAspect(aspects, entry.feature, entry.value);
      });
    }
  };

  visit(raw);
  return finalizeAspectMap(aspects);
}

export function flattenEbayAspects(raw: unknown): EbayAspectRow[] {
  const parsed = parseEbayAspects(raw);
  if (!parsed) return [];

  return Object.entries(parsed).flatMap(([name, values]) => values.map((value) => ({ name, value })));
}

export function serializeEbayAspects(rows: EbayAspectRow[]): string {
  const aspects = new Map<string, string[]>();

  rows.forEach((row) => {
    pushAspect(aspects, row.name, row.value);
  });

  const serialized = finalizeAspectMap(aspects);
  return serialized ? JSON.stringify(serialized) : '';
}