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

  it.each([
    { templateHtml: '<div>{{template_copy}}</div>', copy: '<p>Saved listing copy</p>' },
    { templateHtml: '<div>{{template_copy}}</div>', copy: '' },
    { templateHtml: '', copy: '<p>Saved for later</p>' },
  ])('sends canonical copy only when rendering a template: $copy', async ({ templateHtml, copy }) => {
    renderHook(() => useApprovalPreview({
      approvalChannel: 'ebay',
      selectedRecord: {
        id: 'rec-copy-preview',
        createdTime: '2026-05-18T00:00:00.000Z',
        fields: { 'eBay Template Copy': '<p>Previously saved</p>' },
      },
      fieldKinds: {},
      formValues: {
        'eBay Template Copy': copy,
        '__ebay_body_template_copy_override__': '<p>Stale virtual copy</p>',
      },
      setDerivedFormValue: vi.fn(),
      fromFormValue: (value) => value,
      isCombinedApproval: false,
      ebayCategoryLabelsById: {},
      selectedEbayTemplateHtml: templateHtml,
      combinedEbayTitleFieldName: 'Title',
      combinedDescriptionFieldName: 'Description',
      combinedSharedKeyFeaturesFieldName: 'Key Features',
      combinedEbayTestingNotesFieldName: 'Testing Notes',
      combinedEbayBodyHtmlFieldName: 'Ebay Body (HTML)',
      combinedMakeFieldName: 'Make',
      combinedModelFieldName: 'Model',
      isRemovedCombinedEbayPriceFieldName: () => false,
      isEbayHandlingCostFieldName: () => false,
      isEbayGlobalShippingFieldName: () => false,
    }));
    await waitFor(() => expect(normalizeApprovalRecordMock).toHaveBeenCalled());
    expect(normalizeApprovalRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ 'eBay Template Copy': copy }),
      'ebay',
      expect.objectContaining({
        bodyPreview: templateHtml ? expect.objectContaining({ templateCopy: copy }) : undefined,
      }),
    );
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
          'Domestic Service 1': 'UPS Ground',
          'International Service 1': 'USPS Priority Mail International',
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
          shippingMethod: 'UPS Ground (Domestic) / USPS Priority Mail International (International)',
        }),
      }),
    );
  });
});