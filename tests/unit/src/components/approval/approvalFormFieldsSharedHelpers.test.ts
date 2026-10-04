import { describe, expect, it } from 'vitest';
import { toHumanReadableLabel } from '@/components/approval/approvalFormFieldsSharedHelpers';

describe('approvalFormFieldsSharedHelpers', () => {
  it('uses listing-page shipping labels for shipping weight and dimensions', () => {
    expect(toHumanReadableLabel('Shipping Weight')).toBe('Shipping Weight (in lbs)');
    expect(toHumanReadableLabel('Shipping Dims')).toBe('Shipping Dimensions (L"W"H" in inches)');
  });

  it('omits the primary service number from eBay shipping labels', () => {
    expect(toHumanReadableLabel('Ebay Domestic Service 1')).toBe('Ebay Domestic Service');
    expect(toHumanReadableLabel('Ebay International Service 1')).toBe('Ebay International Service');
    expect(toHumanReadableLabel('Ebay Domestic Service 2')).toBe('Ebay Domestic Service 2');
  });
});