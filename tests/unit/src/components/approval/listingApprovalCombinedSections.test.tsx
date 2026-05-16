import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingApprovalCombinedSections } from '@/components/approval/ListingApprovalCombinedSections';
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
  testingNotesTextareaEditorSpy,
} = vi.hoisted(() => ({
  approvalFormFieldsSpy: vi.fn(),
  bodyHtmlPreviewSpy: vi.fn(),
  keyFeaturesEditorSpy: vi.fn(),
  testingNotesTextareaEditorSpy: vi.fn(),
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

vi.mock('@/components/approval/TestingNotesTextareaEditor', () => ({
  TestingNotesTextareaEditor: (props: Record<string, unknown>) => {
    testingNotesTextareaEditorSpy(props);
    return <div data-testid="testing-notes-textarea-editor">{String(props.fieldName ?? '')}</div>;
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
      Manual: 'Included',
      'Original Box': 'No',
      Voltage: '120V',
      Remote: 'Included',
      'Power Cable': 'Included',
      'Audiogon Rating': '8/10',
      'Cosmetic Condition Notes': 'Light wear on the top cover.',
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
      Manual: 'Included',
      'Original Box': 'No',
      Voltage: '120V',
      Remote: 'Included',
      'Power Cable': 'Included',
      'Audiogon Rating': '8/10',
      'Cosmetic Condition Notes': 'Light wear on the top cover.',
      'Shopify Body HTML': '<p>Shopify body</p>',
      'eBay Body HTML': '<p>eBay body</p>',
    },
    fieldKinds: {},
    listingFormatOptions: ['FIXED_PRICE'],
    listingDurationOptions: ['GTC'],
    saving: false,
    setFormValue: vi.fn(),
    writableFieldNames: ['Title', 'Description', 'Price', 'Key Features', 'Testing Notes', 'Manual', 'Original Box', 'Voltage', 'Remote', 'Power Cable', 'Audiogon Rating', 'Cosmetic Condition Notes'],
    originalFieldValues: {
      Description: 'Original description',
    },
  };
}

function buildSharedProps(): ListingApprovalCombinedSharedSectionProps {
  return {
    ...buildCommonProps(),
    titleFieldName: 'Title',
    combinedDescriptionFieldName: 'Description',
    combinedSharedFieldNames: ['Title', 'Price'],
    combinedRequiredFieldNames: ['Title'],
    shopifyRequiredFieldNames: ['Title', 'Vendor'],
    ebayRequiredFieldNames: ['Title', 'Categories'],
    combinedSharedKeyFeaturesFieldName: 'Key Features',
    combinedSharedKeyFeaturesSyncFieldNames: ['Shopify Key Features'],
    sharedTestingSourceFieldValues: {
      Manual: 'Included',
      'Original Box': 'No',
      Voltage: '120V',
      Remote: 'Included',
      'Power Cable': 'Included',
      'Testing Notes': 'Bench tested',
      'Audiogon Rating': '8/10',
      'Cosmetic Condition Notes': 'Light wear on the top cover.',
    },
    sharedDrawerRequiredStatus: { hasRequired: true, allFilled: true },
    onOpenOperationalRecord: vi.fn(),
    onOpenTestingForm: vi.fn(),
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
    combinedEbayOnlyFieldNames: ['Categories', 'Condition', 'Testing Notes'],
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
    testingNotesTextareaEditorSpy.mockReset();
  });

  it('renders the shared drawer with description editing and shared editor modules', async () => {
    const props = buildSharedProps();
    props.sharedTestingSourceFieldValues = {
      Manual: '["Included"]',
      'Original Box': '["No"]',
      Voltage: '120V',
      Remote: '["Included"]',
      'Power Cable': '["Included"]',
      'Testing Notes': 'Bench tested',
      'Audiogon Rating': '["8/10"]',
      'Cosmetic Condition Notes': 'Light wear on the top cover.',
    };

    render(<ListingApprovalCombinedSharedSection {...props} />);

    expect(screen.getByText('Shared Fields')).toBeInTheDocument();
    expect(screen.getByLabelText('All required fields filled')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Combined description'), { target: { value: 'Updated combined description' } });

    expect(props.setFormValue).toHaveBeenCalledWith('Description', 'Updated combined description');
    expect(approvalFormFieldsSpy).toHaveBeenCalledWith(expect.objectContaining({
      approvalChannel: 'combined',
      allFieldNames: ['Title'],
      requiredFieldNames: ['Title'],
    }));
    expect(approvalFormFieldsSpy).toHaveBeenCalledWith(expect.objectContaining({
      approvalChannel: 'combined',
      allFieldNames: ['Price'],
      requiredFieldNames: ['Title'],
    }));
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByLabelText('Manual')).toHaveValue('Included');
    expect(screen.getByLabelText('Original Box')).toHaveValue('No');
    expect(screen.getByLabelText('Voltage')).toHaveValue('120V');
    expect(screen.getByLabelText('Remote')).toHaveValue('Included');
    expect(screen.getByLabelText('Power Cable')).toHaveValue('Included');
    expect(screen.getByLabelText('Audiogon Rating')).toHaveValue('8/10');
    expect(screen.getByLabelText('Testing Notes')).toHaveValue('Bench tested');
    expect(screen.getByLabelText('Cosmetic Notes')).toHaveValue('Light wear on the top cover.');

    await waitFor(() => {
      expect(screen.getByTestId('key-features-editor')).toHaveTextContent('Key Features');
    });
    expect(keyFeaturesEditorSpy).toHaveBeenCalledWith(expect.objectContaining({
      disabled: false,
    }));
    expect(testingNotesTextareaEditorSpy).not.toHaveBeenCalled();
  });

  it('renders item title above description in the shared section', () => {
    const props = buildSharedProps();

    render(<ListingApprovalCombinedSharedSection {...props} />);

    const [titleFields, priceFields] = screen.getAllByTestId('approval-form-fields');
    const descriptionLabel = screen.getByText('Description');

    expect(titleFields).toHaveTextContent('combined:Title');
    expect(priceFields).toHaveTextContent('combined:Price');
    expect(titleFields.compareDocumentPosition(descriptionLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps key features editable when workflow-managed source fields are present', async () => {
    const props = buildSharedProps();
    props.originalFieldValues = {
      ...props.originalFieldValues,
      'Workflow Status': 'Approved for Publish',
      Make: 'Marantz',
      Model: '2270',
      'Component Type': 'Stereo Receiver',
      'Testing Notes': 'Passed extended bench test.',
    };

    render(<ListingApprovalCombinedSharedSection {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId('key-features-editor')).toHaveTextContent('Key Features');
    });

    expect(keyFeaturesEditorSpy).toHaveBeenCalledWith(expect.objectContaining({
      disabled: false,
    }));
  });

  it('renders combined identity fields from source values and marks them read-only', () => {
    const props = buildSharedProps();
    props.combinedSharedFieldNames = ['Title', 'SKU', 'Make', 'Model', 'Component Type', '__Condition__', 'Price'];
    props.formValues = {
      ...props.formValues,
      SKU: '',
      Make: '',
      Model: 'Stale model',
      'Component Type': '',
      __Condition__: '',
    };
    props.sharedTestingSourceFieldValues = {
      ...props.sharedTestingSourceFieldValues,
      SKU: 'MARANTZ-2270',
      Make: 'Marantz',
      Model: '2270',
      'Component Type': 'Stereo Receiver',
      __Condition__: 'Used - Very Good',
    };

    render(<ListingApprovalCombinedSharedSection {...props} />);

    expect(screen.getByText('Source-Managed Details')).toBeInTheDocument();
    expect(screen.getByText('Make, Model, Condition, SKU, and Component Type are auto-populated from the workflow and testing source forms.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit workflow source record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit testing form' }));

    expect(props.onOpenOperationalRecord).toHaveBeenCalledWith('rec-combined-1');
    expect(props.onOpenTestingForm).toHaveBeenCalledWith('rec-combined-1');

    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      allFieldNames: ['Title'],
      readOnlyFieldNames: [],
    }));
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      readOnlyFieldNames: expect.arrayContaining(['SKU', 'Make', 'Model', 'Component Type', '__Condition__']),
      allFieldNames: ['SKU', 'Make', 'Model', 'Component Type', '__Condition__'],
      formValues: expect.objectContaining({
        SKU: 'MARANTZ-2270',
        Make: 'Marantz',
        Model: '2270',
        'Component Type': 'Stereo Receiver',
        __Condition__: 'Used - Very Good',
      }),
    }));
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(3, expect.objectContaining({
      allFieldNames: ['Price'],
      readOnlyFieldNames: [],
    }));
  });

  it('forwards combined shared quick-link callbacks through the wrapper', () => {
    const sharedProps = buildSharedProps();
    const shopifyProps = buildShopifyProps();
    const ebayProps = buildEbayProps();
    sharedProps.combinedSharedFieldNames = ['Title', 'SKU', 'Make', 'Model', 'Component Type', '__Condition__'];
    sharedProps.formValues = {
      ...sharedProps.formValues,
      SKU: '',
      Make: '',
      Model: '',
      'Component Type': '',
      __Condition__: '',
    };
    sharedProps.sharedTestingSourceFieldValues = {
      ...sharedProps.sharedTestingSourceFieldValues,
      SKU: 'MAC-01',
      Make: 'McIntosh',
      Model: 'MA6900',
      'Component Type': 'Integrated Amplifier',
      __Condition__: 'Used - Good',
    };

    render(
      <ListingApprovalCombinedSections
        {...buildCommonProps()}
        titleFieldName={sharedProps.titleFieldName}
        combinedDescriptionFieldName={sharedProps.combinedDescriptionFieldName}
        combinedSharedFieldNames={sharedProps.combinedSharedFieldNames}
        combinedRequiredFieldNames={sharedProps.combinedRequiredFieldNames}
        combinedSharedKeyFeaturesFieldName={sharedProps.combinedSharedKeyFeaturesFieldName}
        combinedSharedKeyFeaturesSyncFieldNames={sharedProps.combinedSharedKeyFeaturesSyncFieldNames}
        sharedTestingSourceFieldValues={sharedProps.sharedTestingSourceFieldValues}
        sharedDrawerRequiredStatus={sharedProps.sharedDrawerRequiredStatus}
        onOpenOperationalRecord={sharedProps.onOpenOperationalRecord}
        onOpenTestingForm={sharedProps.onOpenTestingForm}
        {...shopifyProps}
        {...ebayProps}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit workflow source record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit testing form' }));

    expect(sharedProps.onOpenOperationalRecord).toHaveBeenCalledWith('rec-combined-1');
    expect(sharedProps.onOpenTestingForm).toHaveBeenCalledWith('rec-combined-1');
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
      allFieldNames: ['Categories', 'Condition', 'Testing Notes'],
    }));
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      approvalChannel: 'ebay',
      showOnlyEbayAdvancedOptions: true,
      allFieldNames: ['Categories', 'Condition', 'Testing Notes'],
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