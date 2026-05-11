import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useListingApprovalCombinedFieldSync } from '@/components/approval/useListingApprovalCombinedFieldSync';

interface HarnessProps {
  formValues: Record<string, string>;
  setFormValue: ReturnType<typeof vi.fn>;
  setSelectedEbayTemplateId?: ReturnType<typeof vi.fn>;
}

function CombinedFieldSyncHarness({
  formValues,
  setFormValue,
  setSelectedEbayTemplateId = vi.fn(),
}: HarnessProps) {
  useListingApprovalCombinedFieldSync({
    allFieldNames: ['Key Features', 'Testing Notes', 'eBay Body HTML Template'],
    approvalChannel: 'combined',
    isCombinedApproval: true,
    formValues,
    setFormValue,
    combinedSharedKeyFeaturesFieldName: 'Key Features',
    combinedEbayTestingNotesFieldName: 'Testing Notes',
    setSelectedEbayTemplateId,
  });

  return null;
}

describe('useListingApprovalCombinedFieldSync', () => {
  it('does not rewrite plain textarea testing notes in combined approval', () => {
    const setFormValue = vi.fn();

    render(
      <CombinedFieldSyncHarness
        formValues={{
          'Key Features': 'Brand,McIntosh',
          'Testing Notes': 'Passed bench test.\nLamp replaced.',
        }}
        setFormValue={setFormValue}
      />,
    );

    expect(setFormValue).not.toHaveBeenCalled();
  });

  it('still moves structured testing note entries into shared key features', () => {
    const setFormValue = vi.fn();

    render(
      <CombinedFieldSyncHarness
        formValues={{
          'Key Features': 'Condition,Excellent',
          'Testing Notes': 'Brand,McIntosh\nFunctional Notes,Fully tested',
        }}
        setFormValue={setFormValue}
      />,
    );

    expect(setFormValue).toHaveBeenCalledTimes(2);
    expect(setFormValue).toHaveBeenCalledWith('Key Features', 'Condition,Excellent\nBrand,McIntosh');
    expect(setFormValue).toHaveBeenCalledWith('Testing Notes', 'Functional Notes,Fully tested');
  });
});