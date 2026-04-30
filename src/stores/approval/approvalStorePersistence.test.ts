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
    fieldKinds: {},
    setFormValue: vi.fn(),
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
});