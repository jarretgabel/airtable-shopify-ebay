import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingApprovalCombinedSections } from '@/components/approval/ListingApprovalCombinedSections';
import { ListingApprovalCombinedEbaySection } from '@/components/approval/ListingApprovalCombinedEbaySection';
import { ListingApprovalCombinedIntakeSection } from '@/components/approval/ListingApprovalCombinedIntakeSection';
import { ListingApprovalCombinedSharedSection } from '@/components/approval/ListingApprovalCombinedSharedSection';
import { ListingApprovalCombinedShopifySection } from '@/components/approval/ListingApprovalCombinedShopifySection';
import { useAuthStore } from '@/stores/auth/authStore';
import type {
  ListingApprovalCombinedEbaySectionProps,
  ListingApprovalCombinedIntakeSectionProps,
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
      'Component Type': 'Stereo Receiver',
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
      'Testing Cosmetic Notes': 'Light wear on the top cover.',
    },
  };
}

function buildCommonProps() {
  return {
    selectedRecord: buildRecord(),
    approvedFieldName: 'Approved',
    formValues: {
      Description: 'Combined description',
      'Component Type': 'Stereo Receiver',
      'Key Features': 'Feature one',
      'Testing Notes': 'Bench tested',
      Manual: 'Included',
      'Original Box': 'No',
      Voltage: '120V',
      Remote: 'Included',
      'Power Cable': 'Included',
      'Audiogon Rating': '8/10',
      'Testing Cosmetic Notes': 'Light wear on the top cover.',
      'Shopify Body HTML': '<p>Shopify body</p>',
      'eBay Body HTML': '<p>eBay body</p>',
    },
    fieldKinds: {},
    listingFormatOptions: ['FIXED_PRICE'],
    listingDurationOptions: ['GTC'],
    saving: false,
    setFormValue: vi.fn(),
    setDerivedFormValue: vi.fn(),
    writableFieldNames: ['Title', 'Description', 'Price', 'Key Features', 'Testing Notes', 'Manual', 'Original Box', 'Voltage', 'Remote', 'Power Cable', 'Audiogon Rating', 'Testing Cosmetic Notes'],
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
      'Testing Cosmetic Notes': 'Light wear on the top cover.',
    },
    sharedDrawerRequiredStatus: { hasRequired: true, allFilled: true },
    onOpenOperationalRecord: vi.fn(),
    onOpenTestingForm: vi.fn(),
  };
}

function buildIntakeProps(): ListingApprovalCombinedIntakeSectionProps {
  return {
    ...buildCommonProps(),
    combinedSharedFieldNames: ['Title', 'Price'],
    sharedTestingSourceFieldValues: {
      Manual: 'Included',
      'Original Box': 'No',
      Voltage: '120V',
      Remote: 'Included',
      'Power Cable': 'Included',
      'Testing Notes': 'Bench tested',
      'Audiogon Rating': '8/10',
      'Testing Cosmetic Notes': 'Light wear on the top cover.',
    },
    onOpenOperationalRecord: vi.fn(),
    onOpenTestingForm: vi.fn(),
  };
}

function buildShopifyProps(): ListingApprovalCombinedShopifySectionProps {
  return {
    ...buildCommonProps(),
    combinedShopifyOnlyFieldNames: ['Vendor', 'Tags', 'Shopify Variant Taxable', 'Shopify Variant Fulfillment', 'Shopify Variant Requires Shipping'],
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
    useAuthStore.setState({
      users: [
        {
          id: 'user-developer',
          name: 'Devon Developer',
          email: 'developer@example.com',
          role: 'developer',
          allowedPages: ['dashboard', 'workflow-guide', 'manual-intake', 'jotform', 'parking-lot', 'trash-review', 'inventory', 'testing-queue', 'photography-queue', 'testing', 'photos', 'listings', 'post-publish', 'archive', 'shopify', 'ebay', 'market', 'settings', 'notifications', 'imagelab', 'users'],
          notificationPreferences: {
            infoEnabled: true,
            successEnabled: true,
            warningEnabled: true,
            errorEnabled: true,
            autoDismissMs: 9000,
            workflowAssignedAlertsEnabled: true,
            workflowUnassignedAlertsEnabled: true,
            workflowEvents: {
              pendingReview: true,
              processing: true,
              testing: true,
              photography: true,
              preListingReview: true,
              approvedForPublish: true,
            },
          },
        },
      ],
      currentUserId: 'user-developer',
    });
  });

  it('renders the intake drawer with snapshot modules and testing notes nested under intake details', () => {
    const props = buildIntakeProps();
    props.sharedTestingSourceFieldValues = {
      Manual: '["Included"]',
      'Original Box': '["No"]',
      Voltage: '120V',
      Weight: '42 lbs',
      'Shipping Dims': '22x19x11',
      Remote: '["Included"]',
      'Power Cable': '["Included"]',
      'Testing Notes': 'Bench tested',
      'Audiogon Rating': '["8/10"]',
      'Testing Cosmetic Notes': 'Light wear on the top cover.',
    };
    props.formValues = {
      ...props.formValues,
      'eBay Body Key Features JSON': JSON.stringify([
        { feature: 'Includes', value: 'Original box and inserts' },
      ]),
    };

    render(<ListingApprovalCombinedIntakeSection {...props} />);

    expect(screen.getByText('Intake Details')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Testing Notes')).toBeInTheDocument();
    expect(screen.queryByText('Shared Fields')).not.toBeInTheDocument();
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Original Box').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Includes')).toHaveLength(1);
    expect(screen.getAllByText('Voltage').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shipping Weight').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shipping Dimensions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Remote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Power Cable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Audiogon Rating').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Included').length).toBeGreaterThan(0);
    expect(screen.getByText('Original box and inserts')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('120V')).toBeInTheDocument();
    expect(screen.getByText('42 lbs')).toBeInTheDocument();
    expect(screen.getByText('22x19x11')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText('Bench tested')).toBeInTheDocument();
    expect(screen.getByText('Light wear on the top cover.')).toBeInTheDocument();
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

  it('prefers the generated Shopify body html in the body html and rendered panels', () => {
    const props = buildShopifyProps();
    props.currentPageShopifyBodyHtml = '<p>Generated description</p>\n<h3>Key Features</h3>\n<ul><li><strong>Includes:</strong> Original box</li></ul>';
    props.combinedShopifyBodyHtmlValue = '<p>Saved Shopify body without features</p>';

    render(<ListingApprovalCombinedShopifySection {...props} />);

    expect(screen.getByText('Shopify Body (HTML)').closest('details')).toHaveTextContent('Generated description');
    expect(screen.getByText('Shopify Body (HTML)').closest('details')).toHaveTextContent('Key Features');
    expect(screen.getByText('Shopify Body (HTML)').closest('details')).toHaveTextContent('<strong>Includes:</strong> Original box');
    expect(screen.queryByText('Saved Shopify body without features')).not.toBeInTheDocument();
    expect(bodyHtmlPreviewSpy).toHaveBeenCalledWith(expect.objectContaining({
      value: props.currentPageShopifyBodyHtml,
    }));
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
      hiddenFeatureNames: expect.arrayContaining(['Make', 'Model', 'Serial Number', 'Condition', 'Component Type', 'Cosmetic Notes', 'Includes', 'Original Box', 'Manual', 'Remote', 'Power Cable', 'Voltage', 'Shipping Weight', 'Shipping Dimensions', 'Audiogon Rating']),
    }));
  });

  it('renders combined identity fields from source values inside intake details and keeps the snapshot quick links', () => {
    const props = buildIntakeProps();
    props.combinedSharedFieldNames = ['Title', 'SKU', 'Make', 'Model', 'Serial Number', 'Component Type', '__Condition__', 'Price'];
    props.formValues = {
      ...props.formValues,
      SKU: '',
      Make: '',
      Model: 'Stale model',
      'Serial Number': '',
      'Component Type': '',
      __Condition__: '',
    };
    props.sharedTestingSourceFieldValues = {
      ...props.sharedTestingSourceFieldValues,
      SKU: 'MARANTZ-2270',
      Make: 'Marantz',
      Model: '2270',
      'Serial Number': 'SN-2270-4455',
      'Component Type': 'Stereo Receiver',
      __Condition__: 'Used - Very Good',
    };

    render(<ListingApprovalCombinedIntakeSection {...props} />);

    expect(screen.getByText('Intake Details')).toBeInTheDocument();
    expect(screen.queryByText('Make, Model, Condition, SKU, and Component Type are auto-populated from the workflow and testing source forms.')).not.toBeInTheDocument();
    expect(screen.getByText('MARANTZ-2270')).toBeInTheDocument();
    expect(screen.getByText('Marantz')).toBeInTheDocument();
    expect(screen.getByText('2270')).toBeInTheDocument();
    expect(screen.getByText('SN-2270-4455')).toBeInTheDocument();
    expect(screen.getByText('Stereo Receiver')).toBeInTheDocument();
    expect(screen.getByText('Used - Very Good')).toBeInTheDocument();
    expect(screen.getByText('Make').compareDocumentPosition(screen.getByText('Model')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Model').compareDocumentPosition(screen.getByText('SKU')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('SKU').compareDocumentPosition(screen.getByText('Serial Number')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit workflow source record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit testing form' }));

    expect(props.onOpenOperationalRecord).toHaveBeenCalledWith('rec-combined-1');
    expect(props.onOpenTestingForm).toHaveBeenCalledWith('rec-combined-1');
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

  it('keeps source-managed and testing snapshot fields out of the shared editor fields', () => {
    const props = buildSharedProps();
    props.combinedSharedFieldNames = ['Title', 'SKU', 'Make', 'Model', 'Serial Number', 'Component Type', '__Condition__', 'Price', 'Manual', 'Testing Notes', 'Voltage'];

    render(<ListingApprovalCombinedSharedSection {...props} />);

    expect(approvalFormFieldsSpy).toHaveBeenCalledTimes(2);
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      allFieldNames: ['Title'],
    }));
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      allFieldNames: ['Price'],
    }));
  });

  it('renders key features after the listing images block and keeps shipping fields out of the shared editor', () => {
    const props = buildSharedProps();
    props.combinedSharedFieldNames = ['Title', 'Images', 'Serial Number', 'Shipping Dims', 'Shipping Weight'];
    props.formValues = {
      ...props.formValues,
      Images: '',
      'Serial Number': 'SAMPLE-SN-0012',
      'Shipping Dims': '22x19x11',
      'Shipping Weight': '42',
    };

    render(<ListingApprovalCombinedSharedSection {...props} />);

    const imageFields = screen.getByText('combined:Images');
    const keyFeaturesEditor = screen.getByTestId('key-features-editor');

    expect(imageFields.compareDocumentPosition(keyFeaturesEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('combined:Shipping Dims,Shipping Weight')).not.toBeInTheDocument();
    expect(approvalFormFieldsSpy).toHaveBeenCalledWith(expect.objectContaining({
      allFieldNames: ['Title'],
    }));
    expect(approvalFormFieldsSpy).toHaveBeenCalledWith(expect.objectContaining({
      allFieldNames: ['Images'],
    }));
    expect(screen.queryByText(/combined:.*Serial Number/)).not.toBeInTheDocument();
  });

  it('passes component type into the shared key features editor preset flow', () => {
    render(<ListingApprovalCombinedSharedSection {...buildSharedProps()} />);

    expect(keyFeaturesEditorSpy).toHaveBeenCalledWith(expect.objectContaining({
      componentTypeValue: 'Stereo Receiver',
    }));
  });

  it('renders the Shopify drawer with collection editor wiring and preview panels', async () => {
    render(<ListingApprovalCombinedShopifySection {...buildShopifyProps()} />);

    expect(screen.getByText('Shopify-Specific Fields')).toBeInTheDocument();
    expect(screen.getByText('Advanced Shopify Fields')).toBeInTheDocument();
    expect(screen.getByLabelText('Contains missing required fields')).toBeInTheDocument();
    expect(approvalFormFieldsSpy).toHaveBeenCalledTimes(2);
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      approvalChannel: 'shopify',
      forceShowShopifyCollectionsEditor: true,
      allFieldNames: ['Vendor', 'Tags'],
    }));
    expect(approvalFormFieldsSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      approvalChannel: 'shopify',
      allFieldNames: ['Shopify Variant Taxable', 'Shopify Variant Fulfillment', 'Shopify Variant Requires Shipping'],
    }));
    expect(screen.getByRole('separator', { name: 'Listing content divider' })).toBeInTheDocument();
    expect(screen.getByTestId('body-html-preview')).toHaveTextContent('<p>Rendered Shopify body</p>');
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
    expect(screen.getByRole('separator', { name: 'Listing content divider' })).toBeInTheDocument();
    expect(bodyHtmlPreviewSpy).toHaveBeenCalledWith(expect.objectContaining({
      value: '<p>Rendered eBay body</p>',
      showTemplateSelector: true,
    }));
    await waitFor(() => {
      expect(screen.getByText('eBay Create Listing API Payload (Exact Request)')).toBeInTheDocument();
    });
  });

  it('hides combined Shopify and eBay payload JSON panels for non-developers', async () => {
    useAuthStore.setState({
      users: [
        {
          id: 'user-tester',
          name: 'Taylor Tester',
          email: 'tester@example.com',
          role: 'tester',
          allowedPages: ['dashboard', 'workflow-guide', 'testing-queue', 'testing', 'settings', 'notifications'],
          notificationPreferences: {
            infoEnabled: true,
            successEnabled: true,
            warningEnabled: true,
            errorEnabled: true,
            autoDismissMs: 9000,
            workflowAssignedAlertsEnabled: true,
            workflowUnassignedAlertsEnabled: true,
            workflowEvents: {
              pendingReview: true,
              processing: true,
              testing: true,
              photography: true,
              preListingReview: true,
              approvedForPublish: true,
            },
          },
        },
      ],
      currentUserId: 'user-tester',
    });

    render(
      <ListingApprovalCombinedSections
        {...buildCommonProps()}
        titleFieldName="Title"
        combinedDescriptionFieldName="Description"
        combinedSharedFieldNames={['Title', 'Price']}
        combinedRequiredFieldNames={['Title']}
        shopifyRequiredFieldNames={['Vendor']}
        ebayRequiredFieldNames={['Categories']}
        combinedSharedKeyFeaturesFieldName="Key Features"
        combinedSharedKeyFeaturesSyncFieldNames={['Shopify Key Features']}
        sharedTestingSourceFieldValues={{}}
        sharedDrawerRequiredStatus={{ hasRequired: true, allFilled: true }}
        combinedShopifyOnlyFieldNames={buildShopifyProps().combinedShopifyOnlyFieldNames}
        shopifyDrawerRequiredStatus={{ hasRequired: true, allFilled: false }}
        currentPageShopifyBodyHtml="<p>Rendered Shopify body</p>"
        currentPageShopifyTagValues={['Vintage']}
        currentPageShopifyCollectionIds={['gid://shopify/Collection/1']}
        currentPageShopifyCollectionLabelsById={{ 'gid://shopify/Collection/1': 'Amplifiers' }}
        selectedEbayTemplateId="classic"
        setSelectedEbayTemplateId={vi.fn()}
        combinedShopifyBodyHtmlFieldName="Shopify Body HTML"
        combinedShopifyBodyHtmlValue="<p>Shopify body</p>"
        currentPageProductDescriptionResolution={{ sourceFieldName: 'Description', sourceType: 'exact' }}
        currentPageProductDescription="Combined description"
        currentPageProductCategoryResolution={{ sourceFieldName: 'Category', sourceType: 'exact' }}
        currentPageCategoryIdResolution={{ sourceFieldName: 'Shopify Category ID', value: 'gid://shopify/TaxonomyCategory/amplifiers' }}
        shopifyCategoryLookupValue="Amplifiers > Integrated Amplifiers"
        shopifyCategoryResolution={{ status: 'resolved', match: { id: 'gid://shopify/TaxonomyCategory/amplifiers', fullName: 'Amplifiers > Integrated Amplifiers' } }}
        isShopifyPayloadPreviewContext
        shopifyProductSetRequest={{ input: { title: 'Combined description' }, synchronous: true }}
        combinedEbayOnlyFieldNames={['Categories', 'Condition', 'Testing Notes']}
        ebayDrawerRequiredStatus={{ hasRequired: true, allFilled: true }}
        combinedEbayGeneratedBodyHtml="<p>Rendered eBay body</p>"
        ebayCategoryLabelsById={{ '3276': 'Amplifiers' }}
        setEbayCategoryLabelsById={vi.fn()}
        setBodyHtmlPreview={vi.fn()}
        combinedEbayBodyHtmlFieldName="eBay Body HTML"
        combinedEbayBodyHtmlValue="<p>eBay body</p>"
        bodyHtmlPreview="<p>Preview body</p>"
        isEbayPayloadPreviewContext
        ebayDraftPayloadBundle={{ inventoryItem: {}, offer: {} }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Shopify Create Listing API Payload (Exact Request)')).not.toBeInTheDocument();
      expect(screen.queryByText('eBay Create Listing API Payload (Exact Request)')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Shopify Body (HTML)')).toBeInTheDocument();
    expect(screen.getByText('eBay Body (HTML)')).toBeInTheDocument();
  });
});