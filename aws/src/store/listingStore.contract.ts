import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../shared/errors.js';
import type { ListingStore } from './listingStore.js';

export interface ListingStoreHarness {
  store: ListingStore;
  /** Empties the backing data and installs the given records. */
  seed(records: Array<{ id: string; fields: Record<string, unknown> }>): Promise<void>;
  /** A field id the store must accept for attachment upload on 'inventory-directory'. */
  allowedAttachmentFieldId: string;
  /** Backends that cannot store attachments yet must reject every upload with HTTP 501. Defaults to 'supported'. */
  attachments?: 'supported' | 'not-implemented';
  metadataFields: Array<{ id: string; name: string; type: string }>;
  cleanup(): Promise<void>;
}

/** Behavior every ListingStore implementation (Airtable, Postgres, dual) must share. */
export function runListingStoreContract(name: string, createHarness: () => Promise<ListingStoreHarness>): void {
  async function withHarness(fn: (harness: ListingStoreHarness) => Promise<void>): Promise<void> {
    const harness = await createHarness();
    try {
      await fn(harness);
    } finally {
      await harness.cleanup();
    }
  }

  test(`${name}: create then get returns the stored fields`, () => withHarness(async ({ store }) => {
    const created = await store.createRecord('user-guide', { Name: 'Alpha', Order: 1 });
    assert.ok(created.id);
    assert.equal(created.fields.Name, 'Alpha');

    const fetched = await store.getRecord('user-guide', created.id);
    assert.equal(fetched.id, created.id);
    assert.deepEqual(fetched.fields, { Name: 'Alpha', Order: 1 });
  }));

  test(`${name}: update merges fields and keeps untouched ones`, () => withHarness(async ({ store, seed }) => {
    await seed([{ id: 'rec1', fields: { Name: 'Alpha', Order: 1 } }]);
    const updated = await store.updateRecord('user-guide', 'rec1', { Order: 2 });
    assert.deepEqual(updated.fields, { Name: 'Alpha', Order: 2 });
    assert.deepEqual((await store.getRecord('user-guide', 'rec1')).fields, { Name: 'Alpha', Order: 2 });
  }));

  test(`${name}: delete removes the record`, () => withHarness(async ({ store, seed }) => {
    await seed([{ id: 'rec1', fields: { Name: 'Alpha' } }]);
    await store.deleteRecord('shopify-vendors', 'rec1');
    await assert.rejects(store.getRecord('shopify-vendors', 'rec1'), (error: unknown) => error instanceof HttpError && error.statusCode === 404);
  }));

  test(`${name}: getRecords honours maxRecords and field projection`, () => withHarness(async ({ store, seed }) => {
    await seed([
      { id: 'rec1', fields: { Name: 'A', Order: 1 } },
      { id: 'rec2', fields: { Name: 'B', Order: 2 } },
      { id: 'rec3', fields: { Name: 'C', Order: 3 } },
    ]);
    const limited = await store.getRecords('user-guide', { maxRecords: 2 });
    assert.equal(limited.length, 2);

    const projected = await store.getRecords('user-guide', { fields: ['Name'] });
    assert.ok(projected.every((record) => Object.keys(record.fields).every((key) => key === 'Name')));
  }));

  test(`${name}: summary counts approved and pending records`, () => withHarness(async ({ store, seed }) => {
    await seed([
      { id: 'rec1', fields: { Approved: true } },
      { id: 'rec2', fields: { Approved: false } },
      { id: 'rec3', fields: {} },
    ]);
    assert.deepEqual(await store.getRecordsSummary('approval-ebay'), { total: 3, approved: 1, pending: 2 });
  }));

  test(`${name}: field metadata lists id, name and type`, () => withHarness(async ({ store, metadataFields }) => {
    const fields = await store.getFieldMetadata('inventory-directory');
    for (const expected of metadataFields) {
      assert.ok(fields.some((field) => field.id === expected.id && field.name === expected.name && field.type === expected.type));
    }
  }));

  test(`${name}: attachment upload rejects fields outside the allow-list`, () => withHarness(async ({ store, allowedAttachmentFieldId, attachments }) => {
    const payload = { filename: 'a.jpg', contentType: 'image/jpeg', file: 'AAAA' };
    if (attachments === 'not-implemented') {
      await assert.rejects(
        store.uploadAttachment('inventory-directory', 'rec1', allowedAttachmentFieldId, payload),
        (error: unknown) => error instanceof HttpError && error.statusCode === 501,
      );
      return;
    }
    await assert.rejects(
      store.uploadAttachment('inventory-directory', 'rec1', 'fldNotAllowed', payload),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400,
    );
    await store.uploadAttachment('inventory-directory', 'rec1', allowedAttachmentFieldId, payload);
  }));
}
