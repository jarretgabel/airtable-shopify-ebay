import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingApprovalTab } from '@/components/ListingApprovalTab';
import type { AirtableRecord } from '@/types/airtable';
import type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';
import * as approvalStoreModule from '@/stores/approvalStore';

const { defaultRecord, normalizeApprovalRecordMock, getRecordFromResolvedSourceMock } = vi.hoisted(() => {
  const record: AirtableRecord = {
    id: 'rec-approval-1',
    createdTime: '2026-04-28T00:00:00.000Z',
    fields: {
      Title: 'McIntosh MA6900',
      Description: 'Original description text',
      Category: 'Amplifiers > Integrated Amplifiers',
      Price: '3499.99',
      SKU: 'MCINTOSH-MA6900',
      Brand: 'McIntosh',
      Quantity: '1',
      Categories: '3276',
      'Key Features': 'Power Output: 200W\nInputs: Balanced and RCA',
      'Shopify REST Product ID': '44',
      Approved: 'false',
    },
  };

  return {
    defaultRecord: record,
    normalizeApprovalRecordMock: vi.fn(),
    getRecordFromResolvedSourceMock: vi.fn(),
  };
});

function buildShopifyPreview(fields: Record<string, unknown>) {
  const description = String(fields.Description ?? '');
  const category = String(fields.Category ?? '');
  const categoryKey = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unresolved';
  const categoryName = category.split('>').map((segment) => segment.trim()).filter(Boolean).join(' > ') || 'Unresolved Category';
  const resolvedCategoryId = `gid://shopify/TaxonomyCategory/${categoryKey}`;
  const categorySegments = categoryName.split(' > ');
  const resolvedCategoryLeafName = categorySegments[categorySegments.length - 1] || categoryName;
  return {
    draftProduct: {
      title: String(fields.Title ?? ''),
      body_html: `<p>${description}</p>`,
      vendor: 'Resolution Audio Video NYC',
      product_type: 'Integrated Amplifiers',
      status: 'draft',
      variants: [{ price: String(fields.Price ?? '0.00'), taxable: true, requires_shipping: true }],
    },
    effectiveProduct: {
      title: String(fields.Title ?? ''),
      body_html: `<p>${description}</p>`,
      vendor: 'Resolution Audio Video NYC',
      product_type: 'Integrated Amplifiers',
      status: 'draft',
      published_scope: 'web',
      template_suffix: 'product-template',
      variants: [{ price: String(fields.Price ?? '0.00'), inventory_policy: 'deny', taxable: true, requires_shipping: true, position: 1 }],
    },
    collectionIds: ['gid://shopify/Collection/101'],
    bodyHtmlResolution: {
      sourceFieldName: 'Description',
      sourceType: 'exact',
      value: `<p>${description}</p>`,
    },
    productDescriptionResolution: {
      sourceFieldName: 'Description',
      sourceType: 'exact',
      value: description,
    },
    productCategoryResolution: {
      sourceFieldName: 'Category',
      sourceType: 'exact',
      value: category,
    },
    categoryIdResolution: {
      sourceFieldName: '',
      sourceType: 'none',
      value: '',
    },
    categoryLookupValue: category,
    categoryResolution: {
      status: 'resolved',
      match: {
        id: resolvedCategoryId,
        fullName: categoryName,
        name: resolvedCategoryLeafName,
        isLeaf: true,
      },
      error: '',
    },
    resolvedCategoryId,
    productSetRequest: {
      input: {
        title: String(fields.Title ?? ''),
        descriptionHtml: `<p>${description}</p>`,
        vendor: 'Resolution Audio Video NYC',
        productType: 'Integrated Amplifiers',
        status: 'DRAFT',
        templateSuffix: 'product-template',
        category: resolvedCategoryId,
        variants: [{ optionValues: [], price: String(fields.Price ?? '0.00'), position: 1, inventoryPolicy: 'DENY', inventoryItem: { requiresShipping: true }, taxable: true }],
      },
      synchronous: true as const,
      identifier: { id: 'gid://shopify/Product/44' },
    },
  };
}

function buildEbayPreview(fields: Record<string, unknown>, bodyPreview?: { description?: string }) {
  const description = String(bodyPreview?.description ?? fields.Description ?? '');
  const generatedBodyHtml = `<html><body><h1>${String(fields.Title ?? '')}</h1><p>${description}</p></body></html>`;
  return {
    generatedBodyHtml,
    draftPayloadBundle: {
      inventoryItem: {
        sku: String(fields.SKU ?? ''),
        product: {
          title: String(fields.Title ?? ''),
          description: generatedBodyHtml,
          brand: String(fields.Brand ?? ''),
          imageUrls: [],
        },
        condition: 'USED_EXCELLENT',
        availability: { shipToLocationAvailability: { quantity: 1 } },
      },
      offer: {
        sku: String(fields.SKU ?? ''),
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        availableQuantity: 1,
        categoryId: String(fields.Categories ?? '3276'),
        listingDescription: generatedBodyHtml,
        listingDuration: 'GTC',
        pricingSummary: { price: { value: String(fields.Price ?? '0.00'), currency: 'USD' } },
        includeCatalogProductDetails: false,
      },
    },
  };
}

vi.mock('@/stores/approvalStore', async () => {
  const { create } = await import('zustand');

  let approvalStoreSetState: any = null;

  const createApprovalStoreState = (record: AirtableRecord): ApprovalStore => ({
    records: [record],
    loading: false,
    saving: false,
    error: null,
    listingFormatOptions: ['FIXED_PRICE'],
    listingDurationOptions: ['GTC'],
    formValues: {},
    fieldKinds: {},
    setFormValue: (fieldName, value) => {
      approvalStoreSetState?.((state: ApprovalStore) => ({
        formValues: {
          ...state.formValues,
          [fieldName]: value,
        },
      }));
    },
    hydrateForm: (nextRecord, allFieldNames) => {
      approvalStoreSetState?.({
        formValues: Object.fromEntries(allFieldNames.map((fieldName) => [fieldName, String(nextRecord.fields[fieldName] ?? '')])),
        fieldKinds: Object.fromEntries(allFieldNames.map((fieldName) => [fieldName, 'text'])),
      });
    },
    loadRecords: vi.fn(async () => {}),
    loadListingFormatOptions: vi.fn(async () => {}),
    saveRecord: vi.fn(async () => true),
  });

  const approvalStore = create<ApprovalStore>()((set) => {
    approvalStoreSetState = set;
    return createApprovalStoreState(defaultRecord);
  });

  return {
    CONDITION_FIELD: 'Condition',
    DEFAULT_APPROVAL_TABLE_REFERENCE: 'test-base/test-table',
    SHIPPING_SERVICE_FIELD: 'Shipping Service',
    useApprovalStore: approvalStore,
    displayValue: (value: unknown) => String(value ?? ''),
    fromFormValue: (value: string) => value,
    toFormValue: (value: unknown) => String(value ?? ''),
    __resetApprovalStoreMock: (record: AirtableRecord = defaultRecord) => approvalStore.setState(createApprovalStoreState(record), true),
  };
});

vi.mock('@/services/app-api/airtable', () => ({
  createRecordFromResolvedSource: vi.fn(),
  getRecordFromResolvedSource: getRecordFromResolvedSourceMock,
  updateRecordFromResolvedSource: vi.fn(),
}));

vi.mock('@/services/app-api/shopify', () => ({
  addProductToCollections: vi.fn(),
  getProduct: vi.fn(async () => null),
  publishApprovalListingToShopify: vi.fn(),
  upsertExistingProductWithCollectionsInSingleMutation: vi.fn(),
  upsertProductWithUnifiedRequest: vi.fn(),
}));

vi.mock('@/services/app-api/ebay', () => ({
  publishApprovalRecordToEbay: vi.fn(),
}));

vi.mock('@/services/app-api/approval', () => ({
  normalizeApprovalRecord: normalizeApprovalRecordMock,
  publishApprovalRecord: vi.fn(),
}));

vi.mock('@/components/approval/ApprovalFormFields', () => ({
  ApprovalFormFields: () => <div data-testid="approval-form-fields" />,
}));

vi.mock('@/components/approval/BodyHtmlPreview', () => ({
  BodyHtmlPreview: ({ value }: { value: string }) => <div data-testid="body-html-preview">{value}</div>,
}));

vi.mock('@/components/approval/KeyFeaturesEditor', () => ({
  KeyFeaturesEditor: () => null,
}));

vi.mock('@/components/approval/TestingNotesEditor', () => ({
  TestingNotesEditor: () => null,
}));

vi.mock('@/components/approval/ApprovalQueueTable', () => ({
  ApprovalQueueTable: () => null,
}));

vi.mock('@/components/approval/shopifyPublish', () => ({
  upsertShopifyProductWithCollectionFallback: vi.fn(),
}));

vi.mock('@/services/workflowAnalytics', () => ({
  trackWorkflowEvent: vi.fn(),
}));

describe('ListingApprovalTab', () => {
  beforeEach(() => {
    (approvalStoreModule as typeof approvalStoreModule & { __resetApprovalStoreMock: (record?: AirtableRecord) => void }).__resetApprovalStoreMock(defaultRecord);
    getRecordFromResolvedSourceMock.mockReset();
    normalizeApprovalRecordMock.mockReset();

    getRecordFromResolvedSourceMock.mockResolvedValue(defaultRecord);
    normalizeApprovalRecordMock.mockImplementation(async (
      fields: Record<string, unknown>,
      target: 'shopify' | 'ebay' | 'both',
      options?: { bodyPreview?: { description?: string } },
    ) => ({
      target,
      shopify: target === 'ebay' ? undefined : buildShopifyPreview(fields),
      ebay: target === 'shopify' ? undefined : buildEbayPreview(fields, options?.bodyPreview),
    }));
  });

  it('updates Shopify and eBay exact-request preview panes from backend preview responses after an unsaved edit', async () => {
    const { container } = render(
      <ListingApprovalTab
        viewModel={{
          selectedRecordId: defaultRecord.id,
          onSelectRecord: vi.fn(),
          onBackToList: vi.fn(),
        }}
        tableReference="test-base/test-table"
        tableName="Approval Listings"
        approvalChannel="combined"
      />,
    );

    await waitFor(() => {
      expect(normalizeApprovalRecordMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Shopify Create Listing API Payload (Exact Request)'));
    fireEvent.click(screen.getByText('eBay Create Listing API Payload (Exact Request)'));

    act(() => {
      approvalStoreModule.useApprovalStore.getState().setFormValue('Description', 'Updated description from backend preview');
    });

    await waitFor(() => {
      expect(normalizeApprovalRecordMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ Description: 'Updated description from backend preview' }),
        'both',
        expect.objectContaining({
          bodyPreview: expect.objectContaining({ description: 'Updated description from backend preview' }),
        }),
      );
    });

    await waitFor(() => {
      const preTexts = Array.from(container.querySelectorAll('pre')).map((element) => element.textContent ?? '');
      expect(preTexts.some((text) => text.includes('Updated description from backend preview') && text.includes('descriptionHtml'))).toBe(true);
      expect(preTexts.some((text) => text.includes('Updated description from backend preview') && text.includes('listingDescription'))).toBe(true);
    });
  });

  it('updates Shopify taxonomy debug and exact request preview after an unsaved category edit', async () => {
    const { container } = render(
      <ListingApprovalTab
        viewModel={{
          selectedRecordId: defaultRecord.id,
          onSelectRecord: vi.fn(),
          onBackToList: vi.fn(),
        }}
        tableReference="test-base/test-table"
        tableName="Approval Listings"
        approvalChannel="combined"
      />,
    );

    await waitFor(() => {
      expect(normalizeApprovalRecordMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Shopify Create Listing API Payload (Exact Request)'));

    act(() => {
      approvalStoreModule.useApprovalStore.getState().setFormValue('Category', 'Speakers > Floorstanding Speakers');
    });

    await waitFor(() => {
      expect(normalizeApprovalRecordMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          Category: 'Speakers > Floorstanding Speakers',
        }),
        'both',
        expect.anything(),
      );
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Lookup Value: Speakers > Floorstanding Speakers');
      expect(container.textContent).toContain('Resolved Category ID: gid://shopify/TaxonomyCategory/speakers-floorstanding-speakers');
      expect(container.textContent).toContain('Resolved Category Name: Speakers > Floorstanding Speakers');
    });

    await waitFor(() => {
      const preTexts = Array.from(container.querySelectorAll('pre')).map((element) => element.textContent ?? '');
      expect(preTexts.some((text) => text.includes('gid://shopify/TaxonomyCategory/speakers-floorstanding-speakers') && text.includes('descriptionHtml'))).toBe(true);
    });
  });

  it('updates eBay exact request preview after an unsaved category edit', async () => {
    const { container } = render(
      <ListingApprovalTab
        viewModel={{
          selectedRecordId: defaultRecord.id,
          onSelectRecord: vi.fn(),
          onBackToList: vi.fn(),
        }}
        tableReference="test-base/test-table"
        tableName="Approval Listings"
        approvalChannel="combined"
      />,
    );

    await waitFor(() => {
      expect(normalizeApprovalRecordMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('eBay Create Listing API Payload (Exact Request)'));

    act(() => {
      approvalStoreModule.useApprovalStore.getState().setFormValue('Categories', '654321');
    });

    await waitFor(() => {
      expect(normalizeApprovalRecordMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          Categories: '654321',
        }),
        'both',
        expect.anything(),
      );
    });

    await waitFor(() => {
      const preTexts = Array.from(container.querySelectorAll('pre')).map((element) => element.textContent ?? '');
      expect(preTexts.some((text) => text.includes('"categoryId": "654321"') && text.includes('listingDescription'))).toBe(true);
    });
  });
});