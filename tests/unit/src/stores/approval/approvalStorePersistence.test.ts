import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaveRecordAction } from '@/stores/approval/approvalStorePersistence';
import type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';
import type { AirtableRecord } from '@/types/airtable';

const { updateRecordFromResolvedSourceMock, logServiceInfoMock } = vi.hoisted(() => ({
  updateRecordFromResolvedSourceMock: vi.fn(),
  logServiceInfoMock: vi.fn(),
}));

vi.mock('@/services/app-api/airtable', () => ({
  updateRecordFromResolvedSource: updateRecordFromResolvedSourceMock,
}));

vi.mock('@/services/logger', () => ({
  logServiceInfo: logServiceInfoMock,
}));

function createAirtable422Error(message = 'Unprocessable entity') {
  return {
    response: {
      status: 422,
      data: {
        error: {
          message,
        },
      },
    },
  };
}

function buildRecord(fields: Record<string, unknown>): AirtableRecord {
  return {
    id: 'rec-approval-save-1',
    createdTime: '2026-04-29T00:00:00.000Z',
    fields,
  };
}

function buildStoreState(overrides: Partial<ApprovalStore> = {}): ApprovalStore {
  return {
    records: [],
    loading: false,
    saving: false,
    error: null,
    listingFormatOptions: [],
    listingDurationOptions: [],
    formValues: {},
    initialFormValues: {},
    fieldKinds: {},
    setFormValue: vi.fn(),
    setDerivedFormValue: vi.fn(),
    hydrateForm: vi.fn(),
    loadRecords: vi.fn(async () => {}),
    loadListingFormatOptions: vi.fn(async () => {}),
    saveRecord: vi.fn(async () => true),
    ...overrides,
  };
}

describe('approvalStorePersistence', () => {
  beforeEach(() => {
    updateRecordFromResolvedSourceMock.mockReset();
    logServiceInfoMock.mockReset();
  });

  it('retries category saves with alternate value shapes after a 422 response', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: { Categories: '1234' },
      fieldKinds: { Categories: 'text' },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if (payload.Categories === 1234) {
        return;
      }

      throw createAirtable422Error('Category needs numeric ID');
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Categories: '' }),
      'base/table',
      'Approval',
      ['Categories'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { Categories: 1234 },
      { typecast: true },
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('retries price saves with numeric values after a 422 response', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: { Price: '$1,299.50' },
      fieldKinds: { Price: 'text' },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if (payload.Price === 1299.5) {
        return;
      }

      throw createAirtable422Error('Price must be numeric');
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Price: '1000.00' }),
      'base/table',
      'Approval',
      ['Price'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { Price: 1299.5 },
      { typecast: true },
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('retries Ebay Price alias saves against eBay offer price fields after a 422 response', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: { 'Ebay Price': '2499.99' },
      fieldKinds: { 'Ebay Price': 'text' },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if (payload['eBay Offer Price Value'] === 2499.99) {
        return;
      }

      throw createAirtable422Error('Field "Ebay Price" cannot accept the provided value');
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({}),
      'base/table',
      'Approval',
      ['Ebay Price'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { 'eBay Offer Price Value': 2499.99 },
      { typecast: true },
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('writes to canonical Airtable field names when form values use non-canonical casing', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: { 'Ebay Offer Price Value': '1799.00' },
      fieldKinds: { 'Ebay Offer Price Value': 'text' },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockResolvedValue(undefined);

    const succeeded = await saveRecord(
      false,
      buildRecord({ 'eBay Offer Price Value': '1499.00' }),
      'base/table',
      'Approval',
      ['eBay Offer Price Value'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { 'eBay Offer Price Value': '1799.00' },
      { typecast: true },
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('fails when Airtable rejects all changed fields with 422 responses', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: { Description: 'Updated listing description' },
      fieldKinds: { Description: 'text' },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockRejectedValue(
      createAirtable422Error('Field "Description" is read only in this view'),
    );

    const succeeded = await saveRecord(
      false,
      buildRecord({ Description: 'Original description' }),
      'base/table',
      'Approval',
      ['Description'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(false);
    expect(loadRecordsMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Failed to save fields. Description: Field "Description" is read only in this view'),
    }));
  });

  it('fails when changed fields are dropped because they are not writable in the active source schema', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: { Description: 'Updated listing description' },
      fieldKinds: { Description: 'text' },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Original title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(false);
    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
    expect(loadRecordsMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Failed to save fields. Description are not writable in the current Airtable source.',
    }));
  });

  it('skips non-writable Shopify REST Images JSON without failing the save', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const onSuccess = vi.fn();
    const state = buildStoreState({
      formValues: { 'Shopify REST Images JSON': '[{"src":"https://cdn.example.com/a.jpg","alt":"","position":1}]' },
      fieldKinds: { 'Shopify REST Images JSON': 'text' },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      onSuccess,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
    expect(loadRecordsMock).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('coerces comma-separated image URLs into attachment objects when saving Images fields', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: { Images: 'https://cdn.example.com/image-b.jpg, https://cdn.example.com/image-a.jpg' },
      fieldKinds: { Images: 'text' },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockResolvedValue(undefined);

    const succeeded = await saveRecord(
      false,
      buildRecord({
        Images: [
          { id: 'att-image-a', url: 'https://cdn.example.com/image-a.jpg', filename: 'image-a.jpg' },
          { id: 'att-image-b', url: 'https://cdn.example.com/image-b.jpg', filename: 'image-b.jpg' },
        ],
      }),
      'base/table',
      'Approval',
      ['Images'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      {
        Images: [
          { id: 'att-image-b', url: 'https://cdn.example.com/image-b.jpg', filename: 'image-b.jpg' },
          { id: 'att-image-a', url: 'https://cdn.example.com/image-a.jpg', filename: 'image-a.jpg' },
        ],
      },
      undefined,
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });
});