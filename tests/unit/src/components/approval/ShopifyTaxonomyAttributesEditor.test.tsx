import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopifyTaxonomyAttributesEditor } from '@/components/approval/ShopifyTaxonomyAttributesEditor';

const { getTaxonomyCategoryAttributesMock, resolveTaxonomyCategoryMock } = vi.hoisted(() => ({
  getTaxonomyCategoryAttributesMock: vi.fn(),
  resolveTaxonomyCategoryMock: vi.fn(),
}));

vi.mock('@/services/app-api/shopify', () => ({
  getTaxonomyCategoryAttributes: getTaxonomyCategoryAttributesMock,
  resolveTaxonomyCategory: resolveTaxonomyCategoryMock,
}));

describe('ShopifyTaxonomyAttributesEditor', () => {
  beforeEach(() => {
    getTaxonomyCategoryAttributesMock.mockReset();
    resolveTaxonomyCategoryMock.mockReset();
  });

  it('preserves saved selections while attribute definitions load', async () => {
    let resolveDefinitions: (definitions: unknown[]) => void = () => undefined;
    getTaxonomyCategoryAttributesMock.mockReturnValue(new Promise((resolve) => {
      resolveDefinitions = resolve;
    }));
    resolveTaxonomyCategoryMock.mockResolvedValue({
      id: 'gid://shopify/TaxonomyCategory/el-7-7-1-10',
      fullName: 'Electronics > Cables > Speaker Cables',
    });
    const setFormValue = vi.fn();
    const value = JSON.stringify({
      version: 1,
      categoryId: 'gid://shopify/TaxonomyCategory/el-7-7-1-10',
      categoryFullName: 'Electronics > Cables > Speaker Cables',
      attributes: [{
        id: 'gid://shopify/TaxonomyAttribute/1',
        name: 'Color',
        type: 'choice',
        values: [{ id: 'gid://shopify/TaxonomyValue/6', name: 'Beige' }],
      }],
    });

    render(
      <ShopifyTaxonomyAttributesEditor
        fieldName="Shopify Taxonomy Attributes JSON"
        value={value}
        formValues={{ 'Shopify Type': 'Speaker Cables' }}
        setFormValue={setFormValue}
        disabled={false}
      />,
    );

    await waitFor(() => expect(resolveTaxonomyCategoryMock).toHaveBeenCalled());
    expect(setFormValue).not.toHaveBeenCalled();

    resolveDefinitions([{
      id: 'gid://shopify/TaxonomyAttribute/1',
      name: 'Color',
      type: 'choice',
      values: [{ id: 'gid://shopify/TaxonomyValue/6', name: 'Beige' }],
    }]);

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Beige' })).toBeChecked());
    expect(setFormValue).not.toHaveBeenCalled();
  });

  it('counts selected choice values instead of attribute groups', async () => {
    resolveTaxonomyCategoryMock.mockResolvedValue({
      id: 'gid://shopify/TaxonomyCategory/el-7-7-1-10',
      fullName: 'Electronics > Cables > Speaker Cables',
    });
    getTaxonomyCategoryAttributesMock.mockResolvedValue([{
      id: 'gid://shopify/TaxonomyAttribute/1',
      name: 'Color',
      type: 'choice',
      values: [
        { id: 'gid://shopify/TaxonomyValue/6', name: 'Beige' },
        { id: 'gid://shopify/TaxonomyValue/7', name: 'Blue' },
      ],
    }]);

    render(
      <ShopifyTaxonomyAttributesEditor
        fieldName="Shopify Taxonomy Attributes JSON"
        value={JSON.stringify({
          version: 1,
          categoryId: 'gid://shopify/TaxonomyCategory/el-7-7-1-10',
          categoryFullName: 'Electronics > Cables > Speaker Cables',
          attributes: [{
            id: 'gid://shopify/TaxonomyAttribute/1',
            name: 'Color',
            type: 'choice',
            values: [
              { id: 'gid://shopify/TaxonomyValue/6', name: 'Beige' },
              { id: 'gid://shopify/TaxonomyValue/7', name: 'Blue' },
            ],
          }],
        })}
        formValues={{ 'Shopify Type': 'Speaker Cables' }}
        setFormValue={vi.fn()}
        disabled={false}
      />,
    );

    await waitFor(() => expect(screen.getByText('2 selected')).toBeInTheDocument());
  });
});