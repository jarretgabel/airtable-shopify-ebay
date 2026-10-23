import { HttpError } from '../shared/errors.js';
import { airtableSourceDependencies, clearAirtableSourceCaches } from '../providers/airtable/sources.js';
import type { AirtableRecord } from '../providers/airtable/client.js';
import { airtableListingStore } from './airtableListingStore.js';
import { runListingStoreContract } from './listingStore.contract.js';

const INVENTORY_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';
const METADATA_FIELDS = [{ id: 'fldName', name: 'Name', type: 'singleLineText' }];

/** In-memory stand-in for the Airtable HTTP client, installed over airtableSourceDependencies. */
function installFakeAirtable() {
  const original = { ...airtableSourceDependencies };
  const savedBaseId = process.env.AIRTABLE_BASE_ID;
  let records: AirtableRecord[] = [];
  let nextId = 1;

  process.env.AIRTABLE_BASE_ID = 'appTEST';
  clearAirtableSourceCaches();

  const notFound = () => new HttpError(404, 'Record not found', { service: 'airtable', code: 'AIRTABLE_HTTP_ERROR' });

  Object.assign(airtableSourceDependencies, {
    async getRecords(_base: string, _table: string, _view?: string, options: { fields?: string[]; maxRecords?: number } = {}) {
      const projected = records.map((record) => ({
        ...record,
        fields: options.fields
          ? Object.fromEntries(Object.entries(record.fields).filter(([key]) => options.fields!.includes(key)))
          : record.fields,
      }));
      return options.maxRecords ? projected.slice(0, options.maxRecords) : projected;
    },
    async getRecord(_base: string, _table: string, recordId: string) {
      const found = records.find((record) => record.id === recordId);
      if (!found) throw notFound();
      return found;
    },
    async createRecord(_base: string, _table: string, fields: Record<string, unknown>) {
      const record = { id: `rec${nextId++}`, fields: { ...fields }, createdTime: new Date().toISOString() };
      records.push(record);
      return record;
    },
    async updateRecord(_base: string, _table: string, recordId: string, fields: Record<string, unknown>) {
      const found = records.find((record) => record.id === recordId);
      if (!found) throw notFound();
      found.fields = { ...found.fields, ...fields };
      return found;
    },
    async deleteRecord(_base: string, _table: string, recordId: string) {
      if (!records.some((record) => record.id === recordId)) throw notFound();
      records = records.filter((record) => record.id !== recordId);
    },
    async getTableMetadata() {
      return METADATA_FIELDS;
    },
    async uploadAttachment() {},
  });

  return {
    seed: async (seed: Array<{ id: string; fields: Record<string, unknown> }>) => {
      records = seed.map((entry) => ({ ...entry, createdTime: new Date().toISOString() }));
    },
    restore: async () => {
      Object.assign(airtableSourceDependencies, original);
      if (savedBaseId === undefined) delete process.env.AIRTABLE_BASE_ID;
      else process.env.AIRTABLE_BASE_ID = savedBaseId;
      clearAirtableSourceCaches();
    },
  };
}

runListingStoreContract('airtable store', async () => {
  const fake = installFakeAirtable();
  return {
    store: airtableListingStore,
    seed: fake.seed,
    allowedAttachmentFieldId: INVENTORY_ATTACHMENT_FIELD_ID,
    metadataFields: METADATA_FIELDS,
    cleanup: fake.restore,
  };
});
