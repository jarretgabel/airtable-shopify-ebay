import { HttpError } from '../shared/errors.js';
import { getPostgresPool } from '../db/pool.js';
import { resolveConfiguredSourceTable } from '../providers/airtable/sources.js';
import { airtableListingStore } from './airtableListingStore.js';
import { createDualListingStore } from './dualListingStore.js';
import { createPostgresListingStore } from './postgresListingStore.js';
import { createPostgresFirstListingStore } from './postgresFirstListingStore.js';
import { createPostgresReadListingStore } from './postgresReadListingStore.js';
import { createPostgresMirror } from './postgresMirror.js';
import { resolveDataBackend } from './backend.js';
import type {
  ListingAttachmentPayload,
  ListingAttachmentSource,
  ListingMetadataSource,
  ListingReadOptions,
  ListingSource,
  ListingStore,
  ListingWriteOptions,
  ListingWriteSource,
} from './listingStore.js';

export type {
  AirtableConfiguredAttachmentSource,
  AirtableConfiguredMetadataSource,
  AirtableConfiguredRecordsSource,
  AirtableConfiguredRecordsSubset,
  AirtableConfiguredRecordsSummary,
  AirtableConfiguredWriteSource,
} from '../providers/airtable/sources.js';
export type { ListingStore } from './listingStore.js';

let dualStore: ListingStore | undefined;
let postgresReadStore: ListingStore | undefined;
let postgresFirstStore: ListingStore | undefined;

// Near-static sources only. Users stay short so a disabled account or changed password takes effect quickly on other instances.
const READ_CACHE_TTL_MS = { 'shopify-vendors': 60_000, 'user-guide': 60_000, users: 15_000 } as const;

function getDualStore(): ListingStore {
  dualStore ??= createDualListingStore({
    primary: airtableListingStore,
    // The pool is created on first use, so a missing DATABASE_URL is a logged mirror failure, never a failed request.
    mirror: createPostgresMirror(() => getPostgresPool(), resolveConfiguredSourceTable),
    // Shadow reads: compared and reported, never served. The query proxy keeps the pool lazy too.
    shadowReader: createPostgresListingStore({
      pool: { query: ((...args: unknown[]) => (getPostgresPool().query as (...a: unknown[]) => unknown)(...args)) as never },
    }),
  });
  return dualStore;
}

function getPostgresReadStore(): ListingStore {
  postgresReadStore ??= createPostgresReadListingStore({
    reader: createPostgresListingStore({
      pool: { query: ((...args: unknown[]) => (getPostgresPool().query as (...a: unknown[]) => unknown)(...args)) as never },
    }),
    fallback: airtableListingStore,
    writer: getDualStore(),
    cacheTtlMs: READ_CACHE_TTL_MS,
  });
  return postgresReadStore;
}

/** Postgres is authoritative: no Airtable fallback (Airtable may lag the outbox), updates commit to Postgres and the outbox. */
function getPostgresFirstStore(): ListingStore {
  if (postgresFirstStore) return postgresFirstStore;
  const lazyPool = {
    query: ((...args: unknown[]) => (getPostgresPool().query as (...a: unknown[]) => unknown)(...args)) as never,
    connect: (() => getPostgresPool().connect()) as never,
  };
  const postgres = createPostgresListingStore({ pool: lazyPool });
  postgresFirstStore = createPostgresReadListingStore({
    reader: postgres,
    fallback: postgres,
    writer: createPostgresFirstListingStore({
      pool: lazyPool,
      resolveTable: resolveConfiguredSourceTable,
      airtableWriter: getDualStore(),
      reader: postgres,
    }),
    cacheTtlMs: READ_CACHE_TTL_MS,
  });
  return postgresFirstStore;
}

export function getListingStore(source: ListingSource): ListingStore {
  const backend = resolveDataBackend(source);
  if (backend === 'airtable') {
    return airtableListingStore;
  }
  if (backend === 'dual') {
    return getDualStore();
  }

  if (backend === 'postgres-read') {
    return getPostgresReadStore();
  }

  if (backend === 'postgres') {
    return getPostgresFirstStore();
  }

  throw new HttpError(501, `Data backend "${backend}" is not implemented yet for source ${source}.`, {
    service: 'config',
    code: 'DATA_BACKEND_NOT_IMPLEMENTED',
    retryable: false,
  });
}

export const getConfiguredRecords = (source: ListingSource, options?: ListingReadOptions) =>
  getListingStore(source).getRecords(source, options);
export const getConfiguredRecordsSummary = (source: ListingSource) =>
  getListingStore(source).getRecordsSummary(source);
export const getConfiguredRecord = (source: ListingSource, recordId: string) =>
  getListingStore(source).getRecord(source, recordId);
export const createConfiguredRecord = (source: ListingWriteSource, fields: Record<string, unknown>, options?: ListingWriteOptions) =>
  getListingStore(source).createRecord(source, fields, options);
export const updateConfiguredRecord = (source: ListingWriteSource, recordId: string, fields: Record<string, unknown>, options?: ListingWriteOptions) =>
  getListingStore(source).updateRecord(source, recordId, fields, options);
export const deleteConfiguredRecord = (source: ListingWriteSource, recordId: string) =>
  getListingStore(source).deleteRecord(source, recordId);
export const getConfiguredFieldMetadata = (source: ListingMetadataSource) =>
  getListingStore(source).getFieldMetadata(source);
export const uploadConfiguredAttachment = (source: ListingAttachmentSource, recordId: string, fieldId: string, payload: ListingAttachmentPayload) =>
  getListingStore(source).uploadAttachment(source, recordId, fieldId, payload);
