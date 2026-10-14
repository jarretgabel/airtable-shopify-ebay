import { describe, expect, it, vi } from 'vitest';
import {
  EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD,
  EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD,
  EBAY_TEMPLATE_COPY_FIELD_NAME,
  resolveEbayTemplateCopyValue,
  EBAY_LISTING_TEMPLATE_OPTIONS,
  resolveEbayListingTemplateHtml,
} from '@/components/approval/listingApprovalEbayConstants';
import {
  isEbayBodyHtmlSyncTriggerFieldName,
  isEbayBodyTemplateCopyOverrideFieldName,
} from '@/components/approval/listingApprovalFieldHelpers';
import { buildEbayBodyHtmlFromTemplate } from '@/services/ebayBodyHtml';
import { createHydrateFormAction } from '@/stores/approval/approvalStoreRecordState';
import type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';

describe('saved eBay body editors', () => {
  it.each(EBAY_LISTING_TEMPLATE_OPTIONS)('restores template copy from the saved $label body', ({ id }) => {
    const copy = '<p><strong>Sold as-is</strong></p><div><p>Includes original box.</p></div>';
    const bodyHtml = buildEbayBodyHtmlFromTemplate(
      resolveEbayListingTemplateHtml(id), 'Bel Canto Pre 1', 'Description', '', '', '', '', {},
      '<p>Custom about copy</p>', copy,
    );
    const set = vi.fn();
    createHydrateFormAction(set)({
      id: 'rec-copy',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: { 'Ebay Body (HTML)': bodyHtml },
    }, ['Ebay Body (HTML)'], 'Approved');
    const state: Partial<ApprovalStore> = set.mock.calls[0][0];
    expect(state.formValues?.[EBAY_TEMPLATE_COPY_FIELD_NAME]).toBe(copy);
    expect(state.initialFormValues?.[EBAY_TEMPLATE_COPY_FIELD_NAME]).toBe('');
    if (id === 'classic') {
      expect(state.formValues?.[EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD]).toBe('<p>Custom about copy</p>');
    }
  });

  it('restores cleared copy as blank, rather than retaining a previous override', () => {
    const set = vi.fn();
    createHydrateFormAction(set)({
      id: 'rec-cleared',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: { 'Ebay Body (HTML)': '<div id="template-copy"></div><div class="desc">Description</div>' },
    }, ['Ebay Body (HTML)'], 'Approved');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      formValues: expect.objectContaining({ [EBAY_TEMPLATE_COPY_FIELD_NAME]: '' }),
      initialFormValues: expect.objectContaining({ [EBAY_TEMPLATE_COPY_FIELD_NAME]: '' }),
    }));
  });

  it('does not invent copy when a legacy body has no editor section', () => {
    const set = vi.fn();
    createHydrateFormAction(set)({
      id: 'rec-legacy',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: { 'Ebay Body (HTML)': '<p>Legacy description</p>' },
    }, ['Ebay Body (HTML)'], 'Approved');
    const state: Partial<ApprovalStore> = set.mock.calls[0][0];
    expect(state.formValues).not.toHaveProperty(EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD);
    expect(state.formValues?.[EBAY_TEMPLATE_COPY_FIELD_NAME]).toBe('');
  });

  it.each(['<p>Dedicated copy</p>', ''])('prefers the dedicated field, including a saved blank', (copy) => {
    const set = vi.fn();
    createHydrateFormAction(set)({
      id: 'rec-dedicated',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        [EBAY_TEMPLATE_COPY_FIELD_NAME]: copy,
        'Ebay Body (HTML)': '<div id="template-copy"><p>Old embedded copy</p></div>',
      },
    }, ['Ebay Body (HTML)', EBAY_TEMPLATE_COPY_FIELD_NAME], 'Approved');
    const state: Partial<ApprovalStore> = set.mock.calls[0][0];
    expect(state.formValues?.[EBAY_TEMPLATE_COPY_FIELD_NAME]).toBe(copy);
    expect(state.initialFormValues?.[EBAY_TEMPLATE_COPY_FIELD_NAME]).toBe(copy);
  });

  it('uses an explicit blank dedicated value instead of a stale virtual editor value', () => {
    expect(resolveEbayTemplateCopyValue({
      [EBAY_TEMPLATE_COPY_FIELD_NAME]: '',
      [EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD]: '<p>Old copy</p>',
    })).toBe('');
    expect(resolveEbayTemplateCopyValue({
      [EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD]: '<p>Legacy copy</p>',
    })).toBe('<p>Legacy copy</p>');
  });

  it('regenerates the eBay-only body when either editor changes', () => {
    expect(isEbayBodyHtmlSyncTriggerFieldName(EBAY_TEMPLATE_COPY_FIELD_NAME)).toBe(true);
    expect(isEbayBodyHtmlSyncTriggerFieldName(EBAY_BODY_TEMPLATE_COPY_FALLBACK_EDITOR_FIELD)).toBe(true);
    expect(isEbayBodyHtmlSyncTriggerFieldName(EBAY_BODY_ABOUT_FALLBACK_EDITOR_FIELD)).toBe(true);
    expect(isEbayBodyTemplateCopyOverrideFieldName(EBAY_TEMPLATE_COPY_FIELD_NAME)).toBe(true);
  });
});
