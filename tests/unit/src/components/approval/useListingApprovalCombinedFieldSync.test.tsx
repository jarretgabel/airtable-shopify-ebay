import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useListingApprovalCombinedFieldSync } from '@/components/approval/useListingApprovalCombinedFieldSync';

interface HarnessProps {
  formValues: Record<string, string>;
  setDerivedFormValue: ReturnType<typeof vi.fn>;
  setSelectedEbayTemplateId?: ReturnType<typeof vi.fn>;
}

function CombinedFieldSyncHarness({
  formValues,
  setDerivedFormValue,
  setSelectedEbayTemplateId = vi.fn(),
}: HarnessProps) {
  useListingApprovalCombinedFieldSync({
    allFieldNames: ['Key Features', 'Testing Notes', 'eBay Body HTML Template'],
    approvalChannel: 'combined',
    isCombinedApproval: true,
    formValues,
    setDerivedFormValue,
    combinedSharedKeyFeaturesFieldName: 'Key Features',
    combinedEbayTestingNotesFieldName: 'Testing Notes',
    setSelectedEbayTemplateId,
  });

  return null;
}

describe('useListingApprovalCombinedFieldSync', () => {
  it('does not rewrite plain textarea testing notes in combined approval', () => {
    const setDerivedFormValue = vi.fn();

    render(
      <CombinedFieldSyncHarness
        formValues={{
          'Key Features': 'Brand,McIntosh',
          'Testing Notes': 'Passed bench test.\nLamp replaced.',
        }}
        setDerivedFormValue={setDerivedFormValue}
      />,
    );

    expect(setDerivedFormValue).not.toHaveBeenCalled();
  });

  it('still moves structured testing note entries into shared key features', () => {
    const setDerivedFormValue = vi.fn();

    render(
      <CombinedFieldSyncHarness
        formValues={{
          'Key Features': 'Condition,Excellent',
          'Testing Notes': 'Brand,McIntosh\nFunctional Notes,Fully tested',
        }}
        setDerivedFormValue={setDerivedFormValue}
      />,
    );

    expect(setDerivedFormValue).toHaveBeenCalledTimes(2);
    expect(setDerivedFormValue).toHaveBeenCalledWith('Key Features', 'Condition,Excellent\nBrand,McIntosh');
    expect(setDerivedFormValue).toHaveBeenCalledWith('Testing Notes', 'Functional Notes,Fully tested');
  });
});