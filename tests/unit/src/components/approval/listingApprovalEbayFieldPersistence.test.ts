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
});
