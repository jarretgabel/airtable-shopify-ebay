import { describe, expect, it } from 'vitest';
import { shouldHideApprovalFormStandardField } from '../../../../../src/components/approval/approvalFormStandardFieldVisibility';
import { SHIPPING_SERVICE_FIELD } from '../../../../../src/stores/approvalStore';

const baseParams = {
  showWorkflowImageSelector: false,
  isCombinedApproval: true,
  allFieldNames: [SHIPPING_SERVICE_FIELD, 'Ebay International Service 1'],
  hasEbayShippingServicesEditor: false,
  approvedFieldName: 'Ebay Approved',
  hasShopifyTagEditor: false,
  hasShopifyCollectionEditor: false,
  ebayAttributesCandidateFieldNames: [],
  hasEbayCategoryEditor: false,
  hasEbayBusinessPoliciesEditor: false,
  effectiveEbayCategoriesFieldName: 'Ebay Categories',
  useCombinedImageAltEditor: false,
  suppressImageScalarFields: false,
  hasCanonicalConditionField: false,
  testingSectionFieldNames: [],
};

describe('shouldHideApprovalFormStandardField', () => {
  it('hides the synthetic shipping selector in combined approval', () => {
    expect(shouldHideApprovalFormStandardField({
      ...baseParams,
      fieldName: SHIPPING_SERVICE_FIELD,
      approvalChannel: 'ebay',
    })).toBe(true);
  });

  it('keeps the canonical international service field visible', () => {
    expect(shouldHideApprovalFormStandardField({
      ...baseParams,
      fieldName: 'Ebay International Service 1',
      approvalChannel: 'combined',
    })).toBe(false);
  });

  it('keeps the canonical domestic service field visible', () => {
    expect(shouldHideApprovalFormStandardField({
      ...baseParams,
      fieldName: 'Ebay Domestic Service 1',
      approvalChannel: 'ebay',
    })).toBe(false);
  });
});