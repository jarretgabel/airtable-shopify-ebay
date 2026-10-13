import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useApprovalFormFieldRequirements } from '@/components/approval/useApprovalFormFieldRequirements';

describe('useApprovalFormFieldRequirements', () => {
  it('marks an empty eBay listing format as required and shows the eBay badge', () => {
    const { result } = renderHook(() => useApprovalFormFieldRequirements({
      approvalChannel: 'ebay',
      isCombinedApproval: true,
      allFieldNames: ['Ebay Listing Format'],
      requiredFieldNames: ['Ebay Listing Format'],
      shopifyRequiredFieldNames: [],
      ebayRequiredFieldNames: ['Ebay Listing Format'],
      formValues: { 'Ebay Listing Format': '' },
      isEbayListingForm: true,
      ebayListingFormat: '',
    }));

    expect(result.current.isRequiredField('Ebay Listing Format')).toBe(true);
    expect(result.current.isRequiredFieldMissing('Ebay Listing Format')).toBe(true);

    const { container } = render(result.current.renderFieldLabel('Ebay Listing Format'));
    expect(screen.getByText('eBay Required')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('text-[var(--required-label-ink)]');
  });
});
