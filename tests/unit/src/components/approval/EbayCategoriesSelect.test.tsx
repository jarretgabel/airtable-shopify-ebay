import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EbayCategoriesSelect } from '@/components/approval/EbayCategoriesSelect';

describe('EbayCategoriesSelect', () => {
  it('keeps an optional empty category neutral and does not change its selection', () => {
    const onChange = vi.fn();
    render(
      <EbayCategoriesSelect
        fieldName="Categories"
        label="eBay Categories"
        marketplaceId="EBAY_US"
        value={[]}
        disabled
        onChange={onChange}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'eBay Categories' });
    expect(screen.queryByText('eBay Required')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveClass('border-rose-400/45');
    expect(input).not.toHaveAttribute('required');
    expect(screen.getByText('No categories selected.')).toHaveClass('text-[var(--muted)]');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks a required category as missing until one is selected', () => {
    render(
      <EbayCategoriesSelect
        fieldName="Categories"
        label="eBay Categories"
        required
        marketplaceId="EBAY_US"
        value={[]}
        disabled
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'eBay Categories' });
    expect(screen.getByText('eBay Required')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('border-rose-400/45');
    expect(screen.getByText('No categories selected.')).toHaveClass('text-rose-200');
  });

  it('clears the missing state when a required category is selected', () => {
    render(
      <EbayCategoriesSelect
        fieldName="Categories"
        label="eBay Categories"
        required
        marketplaceId="EBAY_US"
        value={['3276']}
        labelsById={{ '3276': 'Amplifiers' }}
        disabled
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'eBay Categories' });
    expect(screen.getByText('eBay Required')).toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveClass('border-rose-400/45');
    expect(screen.queryByText('No categories selected.')).not.toBeInTheDocument();
  });
});
