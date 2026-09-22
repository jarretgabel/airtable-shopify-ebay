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

function createAirtable400Error(message = 'Unknown field name') {
  return {
    response: {
      status: 400,
      data: {
        error: {
          message,
        },
      },
    },
  };
}

function createGenericUnknownFieldError(message = 'Unknown field name') {
  return {
    statusCode: 400,
    message,
  };
}

function createGeneric400Error(message = 'Bad request') {
  return {
    statusCode: 400,
    message,
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

  it('maps source alias fields to writable canonical fields during save', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Shopify REST Variant 1 Price': '1299.00',
        'Shopify Type': 'Amplifiers',
        'Ebay Listing Format': 'FixedPrice',
      },
      fieldKinds: {
        'Shopify REST Variant 1 Price': 'text',
        'Shopify Type': 'text',
        'Ebay Listing Format': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockResolvedValue(undefined);

    const succeeded = await saveRecord(
      false,
      buildRecord({
        Price: '1199.00',
        Type: 'Receivers',
        'Listing Format': 'Auction',
      }),
      'base/table',
      'Approval',
      ['Price', 'Type', 'Listing Format'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { Price: '1299.00' },
      { typecast: true },
    );
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { Type: 'Amplifiers' },
      undefined,
    );
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { 'Listing Format': 'FixedPrice' },
      undefined,
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('persists alias-only source fields by trying canonical fallback field names', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Shopify REST Variant 1 Price': '1299.00',
        'Shopify Type': 'Amplifiers',
        'Ebay Listing Format': 'FixedPrice',
      },
      fieldKinds: {
        'Shopify REST Variant 1 Price': 'text',
        'Shopify Type': 'text',
        'Ebay Listing Format': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      const fieldName = Object.keys(payload)[0] ?? '';
      const normalized = fieldName.toLowerCase();
      if (normalized.includes('price')) return;
      if (fieldName === 'Type') return;
      if (normalized.includes('format')) return;
      throw createAirtable422Error('Unknown field name');
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    const payloadFieldNames = updateRecordFromResolvedSourceMock.mock.calls.map((call) => {
      const payload = (call[3] ?? {}) as Record<string, unknown>;
      return Object.keys(payload)[0] ?? '';
    });
    const normalizedPayloadFieldNames = payloadFieldNames.map((fieldName) => fieldName.toLowerCase());

    expect(normalizedPayloadFieldNames.some((fieldName) => fieldName.includes('price'))).toBe(true);
    expect(payloadFieldNames).toContain('Type');
    expect(normalizedPayloadFieldNames.some((fieldName) => fieldName.includes('format'))).toBe(true);
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('retries alias candidates when Airtable returns unknown field name errors', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Shopify REST Variant 1 Price': '1399.00',
      },
      fieldKinds: {
        'Shopify REST Variant 1 Price': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('Price' in payload) {
        return;
      }

      throw createAirtable400Error(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    const attemptedPayloads = updateRecordFromResolvedSourceMock.mock.calls.map((call) => call[3] as Record<string, unknown>);
    expect(attemptedPayloads.some((payload) => payload.Price === '1399.00' || payload.Price === 1399)).toBe(true);
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('retries alias candidates when unknown-field error is thrown as plain Error', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Shopify REST Variant 1 Price': '1499.00',
      },
      fieldKinds: {
        'Shopify REST Variant 1 Price': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('Price' in payload) {
        return;
      }

      throw new Error(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    const attemptedPayloads = updateRecordFromResolvedSourceMock.mock.calls.map((call) => call[3] as Record<string, unknown>);
    expect(attemptedPayloads.some((payload) => payload.Price === '1499.00' || payload.Price === 1499)).toBe(true);
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('persists Shopify Type via Product Type fallback when Type is unknown', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Shopify Type': 'Integrated Amplifier',
      },
      fieldKinds: {
        'Shopify Type': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('Product Type' in payload) {
        return;
      }

      throw new Error(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { 'Product Type': 'Integrated Amplifier' },
      { typecast: true },
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('retries alias candidates when unknown-field error is object-shaped', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Shopify REST Variant 1 Price': '1599.00',
      },
      fieldKinds: {
        'Shopify REST Variant 1 Price': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('Price' in payload) {
        return;
      }

      throw createGenericUnknownFieldError(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    const attemptedPayloads = updateRecordFromResolvedSourceMock.mock.calls.map((call) => call[3] as Record<string, unknown>);
    expect(attemptedPayloads.some((payload) => payload.Price === '1599.00' || payload.Price === 1599)).toBe(true);
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('retries alias candidates on generic 400 errors and still reaches canonical price field', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Shopify REST Variant 1 Price': '1699.00',
      },
      fieldKinds: {
        'Shopify REST Variant 1 Price': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('Price' in payload) {
        return;
      }

      throw createGeneric400Error('Bad request payload');
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    const attemptedPayloads = updateRecordFromResolvedSourceMock.mock.calls.map((call) => call[3] as Record<string, unknown>);
    expect(attemptedPayloads.some((payload) => payload.Price === '1699.00' || payload.Price === 1699)).toBe(true);
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('retries Shopify price aliases with numeric values when Airtable rejects string values', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Shopify Price': '$1,999.50',
      },
      fieldKinds: {
        'Shopify Price': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if (payload['Shopify Price'] === 1999.5) {
        return;
      }

      throw createAirtable422Error('Field "Shopify Price" cannot accept the provided value');
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ 'Shopify Price': '1800.00' }),
      'base/table',
      'Approval',
      ['Shopify Price'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { 'Shopify Price': 1999.5 },
      { typecast: true },
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('prefers eBay price candidates before generic Price for missing-schema eBay aliases', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Buy It Now/Starting Bid': '2299.00',
      },
      fieldKinds: {
        'Buy It Now/Starting Bid': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('eBay Offer Price Value' in payload) {
        return;
      }

      throw new Error(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    const attemptedPayloads = updateRecordFromResolvedSourceMock.mock.calls.map((call) => call[3] as Record<string, unknown>);
    expect(attemptedPayloads.some((payload) => (
      payload['Buy It Now Price'] === '2299.00'
      || payload['Buy It Now Price'] === 2299
      || payload['eBay Offer Price Value'] === '2299.00'
      || payload['eBay Offer Price Value'] === 2299
    ))).toBe(true);
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('persists eBay price alias values even when loaded schema lacks price fields', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Buy It Now/Starting Bid': '1799.00',
      },
      fieldKinds: {
        'Buy It Now/Starting Bid': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('eBay Offer Price Value' in payload) {
        return;
      }

      throw new Error(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    const attemptedPayloads = updateRecordFromResolvedSourceMock.mock.calls.map((call) => call[3] as Record<string, unknown>);
    expect(attemptedPayloads.some((payload) => payload['eBay Offer Price Value'] === '1799.00' || payload['eBay Offer Price Value'] === 1799)).toBe(true);
    expect(attemptedPayloads.some((payload) => (
      'Shopify Price' in payload
      || 'Shopify Variant 1 Price' in payload
      || 'Shopify REST Variant 1 Price' in payload
      || 'Price' in payload
    ))).toBe(false);
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('falls back from Buy It Now/Starting Bid Price to another eBay alias when Airtable rejects legacy field name', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Buy It Now/Starting Bid Price': '111.00',
      },
      fieldKinds: {
        'Buy It Now/Starting Bid Price': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('Buy It Now Price' in payload || 'eBay Offer Price Value' in payload) {
        return;
      }

      throw new Error(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    const attemptedPayloads = updateRecordFromResolvedSourceMock.mock.calls.map((call) => call[3] as Record<string, unknown>);
    expect(attemptedPayloads.some((payload) => payload['Buy It Now Price'] === '111.00' || payload['Buy It Now Price'] === 111)).toBe(true);
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('falls back to canonical flat ebay_offer_price_value when readable aliases are unknown', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Buy It Now/Starting Bid Price': '111.00',
      },
      fieldKinds: {
        'Buy It Now/Starting Bid Price': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('ebay_offer_price_value' in payload) {
        return;
      }

      throw new Error(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { ebay_offer_price_value: 111 },
      { typecast: true },
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });

  it('preserves exact field casing when retrying the live Airtable Ebay Price column', async () => {
    const setMock = vi.fn();
    const loadRecordsMock = vi.fn(async () => {});
    const state = buildStoreState({
      formValues: {
        'Buy It Now/Starting Bid Price': '111.00',
      },
      fieldKinds: {
        'Buy It Now/Starting Bid Price': 'text',
      },
      loadRecords: loadRecordsMock,
    });
    const getMock = vi.fn(() => state);
    const saveRecord = createSaveRecordAction(setMock, getMock);

    updateRecordFromResolvedSourceMock.mockImplementation(async (_tableRef: string, _tableName: string | undefined, _recordId: string, payload: Record<string, unknown>) => {
      if ('Ebay Price' in payload) {
        return;
      }

      throw new Error(`Unknown field name: "${Object.keys(payload)[0] ?? ''}"`);
    });

    const succeeded = await saveRecord(
      false,
      buildRecord({ Title: 'Listing title' }),
      'base/table',
      'Approval',
      ['Title'],
      'Approved',
      () => undefined,
      'full',
    );

    expect(succeeded).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-approval-save-1',
      { 'Ebay Price': 111 },
      { typecast: true },
    );
    expect(loadRecordsMock).toHaveBeenCalledWith('base/table', 'Approval', true);
  });
});