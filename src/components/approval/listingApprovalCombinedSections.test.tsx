import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingApprovalCombinedEbaySection } from '@/components/approval/ListingApprovalCombinedEbaySection';
import { ListingApprovalCombinedSharedSection } from '@/components/approval/ListingApprovalCombinedSharedSection';
import { ListingApprovalCombinedShopifySection } from '@/components/approval/ListingApprovalCombinedShopifySection';
import type {
  ListingApprovalCombinedEbaySectionProps,
  ListingApprovalCombinedSharedSectionProps,
  ListingApprovalCombinedShopifySectionProps,
} from '@/components/approval/listingApprovalCombinedSectionTypes';
import type { AirtableRecord } from '@/types/airtable';

const {
  approvalFormFieldsSpy,
  bodyHtmlPreviewSpy,
  keyFeaturesEditorSpy,
  testingNotesEditorSpy,
} = vi.hoisted(() => ({
  approvalFormFieldsSpy: vi.fn(),
  bodyHtmlPreviewSpy: vi.fn(),
  keyFeaturesEditorSpy: vi.fn(),
  testingNotesEditorSpy: vi.fn(),
}));

vi.mock('@/components/approval/ApprovalFormFields', () => ({
  ApprovalFormFields: (props: Record<string, unknown>) => {
    approvalFormFieldsSpy(props);
    return <div data-testid="approval-form-fields">{String(props.approvalChannel)}:{Array.isArray(props.allFieldNames) ? props.allFieldNames.join(',') : ''}</div>;
  },
}));

vi.mock('@/components/approval/BodyHtmlPreview', () => ({
  BodyHtmlPreview: (props: Record<string, unknown>) => {
    bodyHtmlPreviewSpy(props);
    return <div data-testid="body-html-preview">{String(props.value ?? '')}</div>;
  },
}));

vi.mock('@/components/approval/KeyFeaturesEditor', () => ({
  KeyFeaturesEditor: (props: Record<string, unknown>) => {
    keyFeaturesEditorSpy(props);
    return <div data-testid="key-features-editor">{String(props.keyFeaturesFieldName ?? '')}</div>;
  },
}));

vi.mock('@/components/approval/TestingNotesEditor', () => ({
  TestingNotesEditor: (props: Record<string, unknown>) => {
    testingNotesEditorSpy(props);
    return <div data-testid="testing-notes-editor">{String(props.fieldName ?? '')}</div>;
  },
}));

function buildRecord(): AirtableRecord {
  return {
    id: 'rec-combined-1',
    createdTime: '2026-04-30T00:00:00.000Z',
    fields: {
      Title: 'McIntosh MA6900',
      Description: 'Original description',
      Category: 'Amplifiers > Integrated Amplifiers',
      Categories: '3276',
      Price: '3499.99',
      'Shopify Body HTML': '<p>Shopify body</p>',
      'eBay Body HTML': '<p>eBay body</p>',
      'Key Features': 'Feature one',
      'Testing Notes': 'Bench tested',
    },
  };
}

function buildCommonProps() {
  return {
    selectedRecord: buildRecord(),
    approvedFieldName: 'Approved',
    formValues: {
      Description: 'Combined description',
      'Key Features': 'Feature one',
      'Testing Notes': 'Bench tested',
      'Shopify Body HTML': '<p>Shopify body</p>',
      'eBay Body HTML': '<p>eBay body</p>',
    },
    fieldKinds: {},
    listingFormatOptions: ['FIXED_PRICE'],
    listingDurationOptions: ['GTC'],
    saving: false,
    setFormValue: vi.fn(),
    writableFieldNames: ['Title', 'Description', 'Price', 'Key Features', 'Testing Notes'],
    originalFieldValues: {
      Description: 'Original description',
    },
  };
}

function buildSharedProps(): ListingApprovalCombinedSharedSectionProps {
  return {
    ...buildCommonProps(),
    combinedDescriptionFieldName: 'Description',
    combinedSharedFieldNames: ['Title', 'Price'],
    combinedRequiredFieldNames: ['Title'],
    shopifyRequiredFieldNames: ['Title', 'Vendor'],
    ebayRequiredFieldNames: ['Title', 'Categories'],
    currentPageShopifyTagValues: ['Vintage', 'Tube'],
    currentPageShopifyCollectionIds: ['gid://shopify/Collection/1'],
    currentPageShopifyCollectionLabelsById: { 'gid://shopify/Collection/1': 'Amplifiers' },
    combinedSharedKeyFeaturesFieldName: 'Key Features',
    combinedSharedKeyFeaturesSyncFieldNames: ['Shopify Key Features'],
    combinedEbayTestingNotesFieldName: 'Testing Notes',
    sharedDrawerRequiredStatus: { hasRequired: true, allFilled: true },
  };
}

function buildShopifyProps(): ListingApprovalCombinedShopifySectionProps {
  return {
    ...buildCommonProps(),
    combinedShopifyOnlyFieldNames: ['Vendor', 'Tags'],
    shopifyRequiredFieldNames: ['Vendor'],
    shopifyDrawerRequiredStatus: { hasRequired: true, allFilled: false },
    currentPageShopifyBodyHtml: '<p>Rendered Shopify body</p>',
    currentPageShopifyTagValues: ['Vintage'],
    currentPageShopifyCollectionIds: ['gid://shopify/Collection/1'],
    currentPageShopifyCollectionLabelsById: { 'gid://shopify/Collection/1': 'Amplifiers' },
    selectedEbayTemplateId: 'classic',
    setSelectedEbayTemplateId: vi.fn(),
    combinedShopifyBodyHtmlFieldName: 'Shopify Body HTML',
    combinedShopifyBodyHtmlValue: '<p>Shopify body</p>',
    currentPageProductDescriptionResolution: { sourceFieldName: 'Description', sourceType: 'exact' },
    currentPageProductDescription: 'Combined description',
    currentPageProductCategoryResolution: { sourceFieldName: 'Category', sourceType: 'exact' },
    currentPageCategoryIdResolution: { sourceFieldName: 'Shopify Category ID', value: 'gid://shopify/TaxonomyCategory/amplifiers' },
    shopifyCategoryLookupValue: 'Amplifiers > Integrated Amplifiers',
    shopifyCategoryResolution: {
      status: 'resolved',
      match: {
        id: 'gid://shopify/TaxonomyCategory/amplifiers',
        fullName: 'Amplifiers > Integrated Amplifiers',
      },
    },
    isShopifyPayloadPreviewContext: true,
    shopifyProductSetRequest: {
      input: {
        title: 'Combined description',
        tags: ['Vintage'],
        collectionsToJoin: ['gid://shopify/Collection/1'],
      },
      synchronous: true,
    },
  };
}

function buildEbayProps(): ListingApprovalCombinedEbaySectionProps {
  return {
    ...buildCommonProps(),
    combinedEbayOnlyFieldNames: ['Categories', 'Condition'],
    ebayRequiredFieldNames: ['Categories'],
    ebayDrawerRequiredStatus: { hasRequired: true, allFilled: true },
    combinedEbayGeneratedBodyHtml: '<p>Rendered eBay body</p>',
    ebayCategoryLabelsById: { '3276': 'Amplifiers' },
    setEbayCategoryLabelsById: vi.fn(),
    setBodyHtmlPreview: vi.fn(),
    selectedEbayTemplateId: 'classic',
    setSelectedEbayTemplateId: vi.fn(),
    combinedEbayBodyHtmlFieldName: 'eBay Body HTML',
    combinedEbayBodyHtmlValue: '<p>eBay body</p>',
    bodyHtmlPreview: '<p>Preview body</p>',
    isEbayPayloadPreviewContext: true,
    ebayDraftPayloadBundle: { inventoryItem: {}, offer: {} },
  };
}

describe('combined approval sections', () => {
  beforeEach(() => {
    approvalFormFieldsSpy.mockReset();
    bodyHtmlPreviewSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesEditorSpy.mockReset();
  });

  it('renders the shared drawer with description editing and shared editor modules', async () => {
    const props = buildSharedProps();

    render(<ListingApprovalCombinedSharedSection {...props} />);

    expect(screen.getByText('Shared Fields')).toBeInTheDocument();
    expect(screen.getByLabelText('All required fields filled')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated combined description' } });

    expect(props.setFormValue).toHaveBeenCalledWith('Description', 'Updated combined description');
    expect(approvalFormFieldsSpy).toHaveBeenCalledWith(expect.objectContaining({
      approvalChannel: 'combined',
      allFieldNames: ['Title', 'Price'],
      requiredFieldNames: ['Title'],
    }));

    await waitFor(() => {
      expect(screen.getByTestId('key-features-editor')).toHaveTextContent('Key Features');
      expect(screen.getByTestId('testing-notes-editor')).toHaveTextContent('Testing Notes');
    });
  });

  it('renders the Shopify drawer with collection editor wiring and preview panels', async () => {
    render(<ListingApprovalCombinedShopifySection {...buildShopifyProps()} />);

    expect(screen.getByText('Shopify-Specific Fields')).toBeInTheDocument();
    expect(screen.getByLabelText('Contains missing required fields')).toBeInTheDocument();
    expect(approvalFormFieldsSpy).toHaveBeenCalledTimes(1);
    expect(approvalFormFieldsSpy).toHaveBeenCalledWith(expect.objectContaining({
      approvalChannel: 'shopify',
      forceShowShopifyCollectionsEditor: true,
      allFieldNames: ['Vendor', 'Tags'],
    }));
    expect(screen.getByTestId('body-html-preview')).toHaveTextContent('<p>Shopify body</p>');
    await waitFor(() => {
      expect(screen.getByText('Shopify Create Listing API Payload (Exact Request)')).toBeInTheDocument();
    });
  });

  it('renders the eBay drawer with base and advanced field groups plus payload preview', async () => {
    render(<ListingApprovalCombinedEbaySection {...buildEbayProps()} />);

    expect(screen.getByText('eBay-Specific Fields')).toBeInTheDocument();
    expect(approvalFormFieldsSpy).toHaveBeenCalledTimes(2);
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      approvalChannel: 'ebay',
      hideEbayAdvancedOptions: true,
    }));
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      approvalChannel: 'ebay',
      showOnlyEbayAdvancedOptions: true,
    }));
    expect(bodyHtmlPreviewSpy).toHaveBeenCalledWith(expect.objectContaining({
      value: '<p>Rendered eBay body</p>',
      showTemplateSelector: true,
    }));
    await waitFor(() => {
      expect(screen.getByText('eBay Create Listing API Payload (Exact Request)')).toBeInTheDocument();
    });
  });
});