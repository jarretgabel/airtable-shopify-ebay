interface ConfiguredRecordsCacheKeyInput {
  source: string;
  subset?: string;
  fields?: string[];
  maxRecords?: number;
}

const CACHE_TTL_MS = 120_000;

interface CacheEntry<TValue> {
  expiresAt: number;
  value: TValue;
}

const configuredRecordsCache = new Map<string, CacheEntry<unknown>>();
const configuredRecordsInFlight = new Map<string, Promise<unknown>>();

function normalizeFields(fields: string[] | undefined): string {
  if (!fields || fields.length === 0) {
    return '';
  }

  return fields
    .map((fieldName) => fieldName.trim())
    .filter((fieldName) => fieldName.length > 0)
    .sort((left, right) => left.localeCompare(right))
    .join(',');
}

function buildCacheKey(input: ConfiguredRecordsCacheKeyInput): string {
  const subset = input.subset?.trim() || '';
  const fields = normalizeFields(input.fields);
  const maxRecords = typeof input.maxRecords === 'number' && Number.isFinite(input.maxRecords)
    ? Math.max(0, Math.trunc(input.maxRecords))
    : 0;

  return `${input.source}::${subset}::${fields}::${maxRecords}`;
}

export async function getOrLoadConfiguredRecordsCache<TValue>(
  keyInput: ConfiguredRecordsCacheKeyInput,
  loader: () => Promise<TValue>,
): Promise<TValue> {
  const key = buildCacheKey(keyInput);
  const now = Date.now();

  const cachedEntry = configuredRecordsCache.get(key);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.value as TValue;
  }

  const inFlight = configuredRecordsInFlight.get(key);
  if (inFlight) {
    return inFlight as Promise<TValue>;
  }

  const loadPromise = loader()
    .then((value) => {
      configuredRecordsCache.set(key, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      configuredRecordsInFlight.delete(key);
    });

  configuredRecordsInFlight.set(key, loadPromise as Promise<unknown>);
  return loadPromise;
}

export function invalidateConfiguredRecordsCache(): void {
  configuredRecordsCache.clear();
  configuredRecordsInFlight.clear();
}
