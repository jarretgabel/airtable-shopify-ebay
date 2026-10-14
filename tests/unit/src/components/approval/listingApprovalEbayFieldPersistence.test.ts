import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveEbayApprovalSupplementalFields } from '@/components/approval/listingApprovalEbayFieldPersistence';
import {
  EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD,
  EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD,
  EBAY_TEMPLATE_COPY_FIELD_NAME,
} from '@/components/approval/listingApprovalEbayConstants';
import { createSaveRecordAction } from '@/stores/approval/approvalStorePersistence';
import { useApprovalStore } from '@/stores/approvalStore';
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

  it('migrates legacy editor copy to its Airtable field and completes the full save without internal fields', async () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-ebay-copy',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: { 'Ebay Body (HTML)': '<p>Original body</p>' },
    };
    const bodyHtml = '<div id="template-copy"><p>Sold as-is</p></div><div id="about"><p>Custom about</p></div>';
    useApprovalStore.setState({
      formValues: {
        'Ebay Body (HTML)': '<p>Original body</p>',
        [EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD]: '<p>Sold as-is</p>',
        [EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD]: '<p>Custom about</p>',
      },
      initialFormValues: { 'Ebay Body (HTML)': '<p>Original body</p>' },
      fieldKinds: {},
      error: null,
    });
    updateRecordFromResolvedSourceMock.mockResolvedValue({});

    await saveEbayApprovalSupplementalFields({
      selectedRecord,
      tableReference: 'base/table',
      tableName: 'Approval',
      formValues: useApprovalStore.getState().formValues,
      setFormValue: useApprovalStore.getState().setDerivedFormValue,
      priceFieldName: '',
      bodyHtmlPreview: bodyHtml,
      ebayBodyHtmlSaveFieldName: 'Ebay Body (HTML)',
      shouldForceEbayBodyHtmlSave: false,
    });
    const saveRecord = createSaveRecordAction(useApprovalStore.setState, useApprovalStore.getState);
    expect(await saveRecord(
      false, selectedRecord, 'base/table', 'Approval', ['Ebay Body (HTML)'], 'Approved', vi.fn(), 'full',
    )).toBe(true);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledTimes(2);
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table', 'Approval', selectedRecord.id, { [EBAY_TEMPLATE_COPY_FIELD_NAME]: '<p>Sold as-is</p>' }, undefined,
    );
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledWith(
      'base/table', 'Approval', selectedRecord.id, { 'Ebay Body (HTML)': bodyHtml }, undefined,
    );
    expect(useApprovalStore.getState().initialFormValues).toMatchObject({
      [EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD]: '<p>Sold as-is</p>',
      [EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD]: '<p>Custom about</p>',
    });
  });

  it('does not acknowledge template copy when its Airtable field is not writable', async () => {
    updateRecordFromResolvedSourceMock.mockRejectedValue(createAirtable422Error('Unknown field name'));
    const setFormValue = vi.fn();

    await expect(saveEbayApprovalSupplementalFields({
      selectedRecord: { id: 'rec-no-body', createdTime: '2026-05-08T00:00:00.000Z', fields: {} },
      tableReference: 'base/table',
      formValues: { [EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD]: '<p>Custom copy</p>' },
      setFormValue,
      priceFieldName: '',
      bodyHtmlPreview: '<div id="template-copy"><p>Custom copy</p></div>',
      ebayBodyHtmlSaveFieldName: 'Ebay Body (HTML)',
      shouldForceEbayBodyHtmlSave: false,
    })).rejects.toThrow('Add a writable long-text field');
    expect(setFormValue).not.toHaveBeenCalled();
  });

  it('saves template copy independently when no template or rendered body is used', async () => {
    const setFormValue = vi.fn();
    updateRecordFromResolvedSourceMock.mockResolvedValue({});
    await saveEbayApprovalSupplementalFields({
      selectedRecord: { id: 'rec-no-preview', createdTime: '2026-05-08T00:00:00.000Z', fields: {} },
      tableReference: 'base/table',
      formValues: { [EBAY_TEMPLATE_COPY_FIELD_NAME]: '<p>Custom copy</p>' },
      setFormValue,
      priceFieldName: '',
      bodyHtmlPreview: '',
      ebayBodyHtmlSaveFieldName: '',
      shouldForceEbayBodyHtmlSave: false,
    });
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledExactlyOnceWith(
      'base/table', undefined, 'rec-no-preview', { [EBAY_TEMPLATE_COPY_FIELD_NAME]: '<p>Custom copy</p>' }, undefined,
    );
    expect(setFormValue).toHaveBeenCalledWith(EBAY_TEMPLATE_COPY_FIELD_NAME, '<p>Custom copy</p>');
  });

  it('clears the dedicated copy without altering manually authored full HTML', async () => {
    updateRecordFromResolvedSourceMock.mockResolvedValue({});
    const manualBody = '<html><body><p>Manually authored listing</p></body></html>';
    await saveEbayApprovalSupplementalFields({
      selectedRecord: {
        id: 'rec-clear-copy',
        createdTime: '2026-05-08T00:00:00.000Z',
        fields: {
          [EBAY_TEMPLATE_COPY_FIELD_NAME]: '<p>Previous copy</p>',
          'Ebay Body (HTML)': manualBody,
        },
      },
      tableReference: 'base/table',
      formValues: { [EBAY_TEMPLATE_COPY_FIELD_NAME]: '', 'Ebay Body (HTML)': manualBody },
      setFormValue: vi.fn(),
      priceFieldName: '',
      bodyHtmlPreview: '',
      ebayBodyHtmlSaveFieldName: 'Ebay Body (HTML)',
      shouldForceEbayBodyHtmlSave: false,
    });
    expect(updateRecordFromResolvedSourceMock).toHaveBeenCalledExactlyOnceWith(
      'base/table', undefined, 'rec-clear-copy', { [EBAY_TEMPLATE_COPY_FIELD_NAME]: '' }, undefined,
    );
  });

  it('rejects a stale body preview instead of saving the previous template copy', async () => {
    const setFormValue = vi.fn();
    await expect(saveEbayApprovalSupplementalFields({
      selectedRecord: { id: 'rec-stale-preview', createdTime: '2026-05-08T00:00:00.000Z', fields: {} },
      tableReference: 'base/table',
      formValues: { [EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD]: '<p>New copy</p>' },
      setFormValue,
      priceFieldName: '',
      bodyHtmlPreview: '<div id="template-copy"><p>Old copy</p></div>',
      ebayBodyHtmlSaveFieldName: 'Ebay Body (HTML)',
      shouldForceEbayBodyHtmlSave: false,
    })).rejects.toThrow('rendered listing body is not up to date');
    expect(updateRecordFromResolvedSourceMock).not.toHaveBeenCalled();
    expect(setFormValue).not.toHaveBeenCalled();
  });
});
