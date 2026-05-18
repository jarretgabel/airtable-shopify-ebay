import { describe, expect, it } from 'vitest';
import { toHumanReadableLabel } from '@/components/approval/approvalFormFieldsSharedHelpers';

describe('approvalFormFieldsSharedHelpers', () => {
  it('uses listing-page shipping labels for shipping weight and dimensions', () => {
    expect(toHumanReadableLabel('Shipping Weight')).toBe('Shipping Weight (in lbs)');
    expect(toHumanReadableLabel('Shipping Dims')).toBe('Shipping Dimensions (L"W"H" in inches)');
  });
});