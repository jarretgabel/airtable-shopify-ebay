import { HttpError } from '../shared/errors.js';
import type { ListingSource } from './listingStore.js';

export type DataBackend = 'airtable' | 'dual' | 'postgres-read' | 'postgres';

const BACKENDS: readonly DataBackend[] = ['airtable', 'dual', 'postgres-read', 'postgres'];

function parseBackend(value: string, label: string): DataBackend {
  const normalized = value.trim().toLowerCase();
  if ((BACKENDS as readonly string[]).includes(normalized)) {
    return normalized as DataBackend;
  }
  throw new HttpError(500, `Invalid data backend "${value}" for ${label}. Expected airtable, dual, postgres-read or postgres.`, {
    service: 'config',
    code: 'DATA_BACKEND_INVALID',
    retryable: false,
  });
}

/** DATA_BACKEND sets the default (airtable when unset); DATA_BACKEND_OVERRIDES is "source=backend,source=backend". */
export function resolveDataBackend(source: ListingSource, env: NodeJS.ProcessEnv = process.env): DataBackend {
  const overrides = env.DATA_BACKEND_OVERRIDES?.trim();
  if (overrides) {
    for (const entry of overrides.split(',')) {
      const [name, value] = entry.split('=').map((part) => part.trim());
      if (name === source && value) {
        return parseBackend(value, source);
      }
    }
  }

  const fallback = env.DATA_BACKEND?.trim();
  return fallback ? parseBackend(fallback, 'DATA_BACKEND') : 'airtable';
}
