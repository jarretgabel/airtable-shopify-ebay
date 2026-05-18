import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApprovalPreview } from '@/hooks/approval/useApprovalPreview';

const normalizeApprovalRecordMock = vi.fn();

vi.mock('@/services/app-api/approval', () => ({
  normalizeApprovalRecord: (...args: unknown[]) => normalizeApprovalRecordMock(...args),
}));

describe('useApprovalPreview', () => {
  beforeEach(() => {
    normalizeApprovalRecordMock.mockReset();
    normalizeApprovalRecordMock.mockResolvedValue({
      target: 'both',
      ebay: {
        generatedBodyHtml: '<p>Preview</p>',
        draftPayloadBundle: { inventoryItem: {}, offer: {} },
        categoryFieldUpdates: {},
      },
    });
  });

  it('falls back to merged source values when combined form values are blank', async () => {
    renderHook(() => useApprovalPreview({
      approvalChannel: 'combined',
      selectedRecord: {
        id: 'rec-preview-1',
        createdTime: '2026-05-18T00:00:00.000Z',
        fields: {
          Title: 'Marantz 2270',
          Description: 'Receiver description',
          Make: 'Marantz',
          Model: '2270',
          'Key Features': 'Includes,Original wood case',
          'Testing Notes': 'Bench tested',
        },
      },
      fieldKinds: {},
      formValues: {
        Title: 'Marantz 2270',
        Description: 'Receiver description',
        Make: '',
        Model: '',
        'Key Features': 'Includes,Original wood case',
        'Testing Notes': 'Bench tested',
      },
      setDerivedFormValue: vi.fn(),
      fromFormValue: (value) => value,
      isCombinedApproval: true,
      ebayCategoryLabelsById: {},
      selectedEbayTemplateHtml: '<table id="key-features"><tbody><tr><th>{{key}}</th><td>{{value}}</td></tr></tbody></table>',
      combinedEbayTitleFieldName: 'Title',
      combinedDescriptionFieldName: 'Description',
      combinedSharedKeyFeaturesFieldName: 'Key Features',
      combinedEbayTestingNotesFieldName: 'Testing Notes',
      combinedEbayBodyHtmlFieldName: 'eBay Body HTML',
      combinedMakeFieldName: 'Make',
      combinedModelFieldName: 'Model',
      isRemovedCombinedEbayPriceFieldName: () => false,
      isEbayHandlingCostFieldName: () => false,
      isEbayGlobalShippingFieldName: () => false,
    }));

    await waitFor(() => {
      expect(normalizeApprovalRecordMock).toHaveBeenCalled();
    });

    expect(normalizeApprovalRecordMock).toHaveBeenCalledWith(
      expect.any(Object),
      'both',
      expect.objectContaining({
        bodyPreview: expect.objectContaining({
          title: 'Marantz 2270',
          description: 'Receiver description',
          keyFeatures: 'Includes,Original wood case',
          testingNotes: 'Bench tested',
          make: 'Marantz',
          model: '2270',
        }),
      }),
    );
  });
});