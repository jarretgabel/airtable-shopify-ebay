import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getConfiguredFieldMetadata,
  getConfiguredRecord,
  updateConfiguredRecord,
} from '@/services/app-api/airtable';
import {
  loadWorkflowPriceFieldMetadata,
  loadWorkflowPriceRecord,
  saveWorkflowPriceRecord,
} from '@/services/workflowPriceEditor';

vi.mock('@/services/app-api/airtable', () => ({
  getConfiguredFieldMetadata: vi.fn(),
  getConfiguredRecord: vi.fn(),
  updateConfiguredRecord: vi.fn(),
}));

const mockGetConfiguredFieldMetadata = vi.mocked(getConfiguredFieldMetadata);
const mockGetConfiguredRecord = vi.mocked(getConfiguredRecord);
const mockUpdateConfiguredRecord = vi.mocked(updateConfiguredRecord);

describe('workflowPriceEditor', () => {
  beforeEach(() => {
    mockGetConfiguredFieldMetadata.mockReset();
    mockGetConfiguredRecord.mockReset();
    mockUpdateConfiguredRecord.mockReset();
  });

  it('loads and sorts editable workflow price fields from used-gear-workflow metadata', async () => {
    mockGetConfiguredFieldMetadata.mockResolvedValue([
      { id: 'fld-title', name: 'Title', type: 'singleLineText' },
      { id: 'fld-price', name: 'Price', type: 'currency' },
      { id: 'fld-shopify', name: 'Shopify Price', type: 'currency' },
      { id: 'fld-readonly', name: 'eBay Offer Price Value', type: 'formula' },
    ]);

    const fields = await loadWorkflowPriceFieldMetadata();

    expect(mockGetConfiguredFieldMetadata).toHaveBeenCalledWith('used-gear-workflow');
    expect(fields).toEqual([
      { id: 'fld-shopify', name: 'Shopify Price', type: 'currency', editable: true, choices: [] },
      { id: 'fld-price', name: 'Price', type: 'currency', editable: true, choices: [] },
    ]);
  });

  it('loads workflow records from used-gear-workflow', async () => {
    mockGetConfiguredRecord.mockResolvedValue({
      id: 'rec-workflow-1',
      createdTime: 'now',
      fields: {
        SKU: 'SKU-1',
        Price: '2199.00',
      },
    });

    const record = await loadWorkflowPriceRecord('rec-workflow-1');

    expect(mockGetConfiguredRecord).toHaveBeenCalledWith('used-gear-workflow', 'rec-workflow-1');
    expect(record.id).toBe('rec-workflow-1');
  });

  it('saves workflow price fields back to used-gear-workflow', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec-workflow-1',
      createdTime: 'now',
      fields: {
        Price: 2199,
      },
    });

    const result = await saveWorkflowPriceRecord(
      'rec-workflow-1',
      ['Price'],
      { Price: '2199' },
      [{ id: 'fld-price', name: 'Price', type: 'currency', editable: true, choices: [] }],
    );

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec-workflow-1',
      { Price: 2199 },
      { typecast: true },
    );
    expect(result.fields.Price).toBe(2199);
  });
});