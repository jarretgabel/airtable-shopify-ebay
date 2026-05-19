import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalFormFieldGrid } from '@/components/approval/ApprovalFormFieldGrid';

const { approvalFormStandardFieldSpy } = vi.hoisted(() => ({
  approvalFormStandardFieldSpy: vi.fn(),
}));

vi.mock('@/components/approval/ApprovalFormStandardField', () => ({
  ApprovalFormStandardField: ({ fieldName }: { fieldName: string }) => {
    approvalFormStandardFieldSpy(fieldName);
    return <div data-testid={`field-${fieldName}`}>{fieldName}</div>;
  },
}));

describe('ApprovalFormFieldGrid', () => {
  it('renders inline content immediately after the matched field name', () => {
    const { container } = render(
      <ApprovalFormFieldGrid
        showOnlyEbayAdvancedOptions={false}
        showEbayAdvancedOptions={false}
        ebayAdvancedOptionFieldNames={[]}
        requiredOrderedFieldNames={['Title']}
        optionalOrderedFieldNames={['Price', 'Quantity', 'Condition']}
        standardFieldProps={{} as never}
        supplementalEditors={<div data-testid="supplemental-editors">Supplemental</div>}
        inlineAfterFieldNames={['Quantity', 'Qty']}
        inlineAfterFieldContent={<div data-testid="inline-editor">Inline editor</div>}
      />,
    );

    const fieldQuantity = screen.getByTestId('field-Quantity');
    const inlineEditor = screen.getByTestId('inline-editor');
    const fieldCondition = screen.getByTestId('field-Condition');

    expect(approvalFormStandardFieldSpy).toHaveBeenCalledWith('Quantity');
    expect(fieldQuantity.compareDocumentPosition(inlineEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inlineEditor.compareDocumentPosition(fieldCondition) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container).toHaveTextContent('Supplemental');
  });

  it('falls back to rendering inline content when no target field is present', () => {
    render(
      <ApprovalFormFieldGrid
        showOnlyEbayAdvancedOptions={false}
        showEbayAdvancedOptions={false}
        ebayAdvancedOptionFieldNames={[]}
        requiredOrderedFieldNames={['Title']}
        optionalOrderedFieldNames={['Price']}
        standardFieldProps={{} as never}
        supplementalEditors={<div data-testid="supplemental-editors">Supplemental</div>}
        inlineAfterFieldNames={['Quantity', 'Qty']}
        inlineAfterFieldContent={<div data-testid="inline-editor">Inline editor</div>}
      />,
    );

    expect(screen.getByTestId('inline-editor')).toBeInTheDocument();
  });
});