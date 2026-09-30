import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveEbayApprovalSupplementalFields } from '@/components/approval/listingApprovalEbayFieldPersistence';
import type { AirtableRecord } from '@/types/airtable';

const updateRecordFromResolvedSourceMock = vi.fn();

vi.mock('@/services/app-api/airtable', () => ({
  updateRecordFromResolvedSource: (...args: unknown[]) => updateRecordFromResolvedSourceMock(...args),
}));

function createAirtable422Error(message: string): Error & { response: { status: number; data: { error: { message: string } } } } {
  const error = new Error(message) as Error & { response: { status: number; data: { error: { message: string } } } };
  error.response = {
    status: 422,
    data: {
      error: { message },
    },
  };
  return error;
}

describe('listingApprovalEbayFieldPersistence', () => {
  beforeEach(() => {
    updateRecordFromResolvedSourceMock.mockReset();
  });

  it('does not throw when eBay supplemental price save gets only retryable 422 errors', async () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-ebay-1',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        Title: 'Test listing',
        'eBay Offer Format': 'FIXED_PRICE',
      },
    } as AirtableRecord;

    updateRecordFromResolvedSourceMock.mockRejectedValue(
      createAirtable422Error('Field "eBay Offer Price Value" cannot accept the provided value'),
    );

    await expect(saveEbayApprovalSupplementalFields({
      selectedRecord,
      tableReference: 'base/table',
      tableName: 'Approval',
      formValues: {
        'eBay Offer Price Value': '1899.00',
      },
      setFormValue: vi.fn(),
      priceFieldName: 'eBay Offer Price Value',
      bodyHtmlPreview: '',
      ebayBodyHtmlSaveFieldName: '',
      shouldForceEbayBodyHtmlSave: false,
    })).resolves.toBeUndefined();

    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalled();
  });

  it('defers an existing eBay price field to the atomic full save', async () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-ebay-2',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        Title: 'Test listing',
        'Ebay Price': 1000,
      },
    } as AirtableRecord;

    await saveEbayApprovalSupplementalFields({
      selectedRecord,
      tableReference: 'base/table',
      tableName: 'Approval',
      formValues: {
        'Ebay Price': '1424.24',
      },
      setFormValue: vi.fn(),
      priceFieldName: 'Ebay Price',
      bodyHtmlPreview: '',
      ebayBodyHtmlSaveFieldName: '',
      shouldForceEbayBodyHtmlSave: false,
    });

    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
  });

  it('saves generated body HTML to the exact existing Airtable field first', async () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-ebay-body',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Ebay Body (HTML)': '<p>Original body</p>',
      },
    } as AirtableRecord;

    updateRecordFromResolvedSourceMock.mockResolvedValue({});

    await saveEbayApprovalSupplementalFields({
      selectedRecord,
      tableReference: 'base/table',
      tableName: 'Approval',
      formValues: {
        'Ebay Body (HTML)': '<p>Original body</p>',
      },
      setFormValue: vi.fn(),
      priceFieldName: '',
      bodyHtmlPreview: '<p>Generated body</p>',
      ebayBodyHtmlSaveFieldName: 'eBay Body (HTML)',
      shouldForceEbayBodyHtmlSave: true,
    });

    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledTimes(1);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table',
      'Approval',
      'rec-ebay-body',
      { 'Ebay Body (HTML)': '<p>Generated body</p>' },
      undefined,
    );
  });
});
