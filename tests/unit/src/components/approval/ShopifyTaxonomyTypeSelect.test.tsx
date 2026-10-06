import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShopifyTaxonomyTypeSelect } from '@/components/approval/ShopifyTaxonomyTypeSelect';

describe('ShopifyTaxonomyTypeSelect', () => {
  it('updates the listing form immediately as the user types', () => {
    const onChange = vi.fn();

    render(
      <ShopifyTaxonomyTypeSelect
        fieldName="Shopify Type"
        label="Shopify Type"
        value=""
        disabled={false}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Shopify Type' }), {
      target: { value: 'Electronics > Audio > Amplifiers' },
    });

    expect(onChange).toHaveBeenLastCalledWith('Electronics > Audio > Amplifiers');
  });
});