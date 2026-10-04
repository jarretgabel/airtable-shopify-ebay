import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApprovalFormEbayCategorySetup } from '../../../../../src/components/approval/useApprovalFormEbayCategorySetup';

describe('useApprovalFormEbayCategorySetup', () => {
  it('updates the canonical category field when Airtable omits a blank category cell', () => {
    const setFormValue = vi.fn();
    const { result } = renderHook(() => useApprovalFormEbayCategorySetup({
      approvalChannel: 'ebay',
      isCombinedApproval: true,
      allFieldNames: ['Ebay Marketplace ID', 'Primary Category Name', 'Secondary Category Name'],
      writableFieldNames: [],
      formValues: {
        'Ebay Marketplace ID': 'EBAY_US',
        'Primary Category Name': '',
        'Secondary Category Name': '',
      },
      originalFieldValues: {
        'Ebay Marketplace ID': 'EBAY_US',
        'Primary Category Name': '',
        'Secondary Category Name': '',
      },
      setFormValue,
    }));

    expect(result.current.effectiveEbayCategoriesFieldName).toBe('Ebay Categories');

    act(() => result.current.setEbayCategoryIds(['12345']));

    expect(setFormValue).toHaveBeenCalledWith('Ebay Categories', '12345');
  });
});