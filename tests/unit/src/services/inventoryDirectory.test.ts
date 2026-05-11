import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getConfiguredFieldMetadata,
  getConfiguredRecord,
  getConfiguredRecords,
} from '@/services/app-api/airtable';
import { loadInventoryDirectory, loadInventoryRecord } from '@/services/inventoryDirectory';

vi.mock('@/services/app-api/airtable', () => ({
  getConfiguredFieldMetadata: vi.fn(),
  getConfiguredRecord: vi.fn(),
  getConfiguredRecords: vi.fn(),
  updateConfiguredRecord: vi.fn(),
}));

const mockGetConfiguredFieldMetadata = vi.mocked(getConfiguredFieldMetadata);
const mockGetConfiguredRecord = vi.mocked(getConfiguredRecord);
const mockGetConfiguredRecords = vi.mocked(getConfiguredRecords);

describe('inventoryDirectory', () => {
  beforeEach(() => {
    mockGetConfiguredFieldMetadata.mockReset();
    mockGetConfiguredRecord.mockReset();
    mockGetConfiguredRecords.mockReset();
  });

  it('enriches directory records with derived workflow fields', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          SKU: 'SKU-1',
          'Workflow Status': 'Pending Review',
        },
      },
    ]);

    const result = await loadInventoryDirectory();

    expect(result.records[0]?.fields['Workflow Intake Decision']).toBe('Pending');
    expect(result.records[0]?.fields['Workflow Next Team']).toBe('Purchasing');
    expect(result.fields).toEqual([]);
    expect(mockGetConfiguredFieldMetadata).not.toHaveBeenCalled();
  });

  it('enriches record detail loads with derived workflow fields', async () => {
    mockGetConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: {
        SKU: 'SKU-1',
        'Workflow Status': 'Testing and Photography In Progress',
        'Testing Signed By': 'Taylor',
        'Testing Signed At': '2026-05-07T10:00:00.000Z',
      },
    });

    const record = await loadInventoryRecord('rec1');

    expect(record.fields['Workflow Intake Decision']).toBe('Accepted');
    expect(record.fields['Workflow Next Team']).toBe('Photography');
  });
});