import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalFormFieldsSupplementalEditors } from '@/components/approval/ApprovalFormFieldsSupplementalEditors';
import { buildWorkflowListingImageSelectionValues } from '@/components/approval/workflowListingImageHelpers';

const { shippingEditorsSpy } = vi.hoisted(() => ({
  shippingEditorsSpy: vi.fn(),
}));

const { keyFeaturesEditorSpy, testingNotesTextareaEditorSpy } = vi.hoisted(() => ({
  keyFeaturesEditorSpy: vi.fn(),
  testingNotesTextareaEditorSpy: vi.fn(),
}));

const { ebayCategoriesSelectSpy } = vi.hoisted(() => ({
  ebayCategoriesSelectSpy: vi.fn(),
}));

vi.mock('@/components/approval/ApprovalFormFieldsShippingEditors', () => ({
  ApprovalFormFieldsShippingEditors: (props: Record<string, unknown>) => {
    shippingEditorsSpy(props);
    return null;
  },
}));

vi.mock('@/components/approval/KeyFeaturesEditor', () => ({
  KeyFeaturesEditor: (props: Record<string, unknown>) => {
    keyFeaturesEditorSpy(props);
    return (
      <div data-testid="mock-key-features-editor">
        {props.headerAction as ReactNode}
      </div>
    );
  },
}));

vi.mock('@/components/approval/TestingNotesTextareaEditor', () => ({
  TestingNotesTextareaEditor: (props: Record<string, unknown>) => {
    testingNotesTextareaEditorSpy(props);
    return (
      <div data-testid="mock-testing-notes-editor">
        {props.headerAction as ReactNode}
      </div>
    );
  },
}));

vi.mock('@/components/approval/EbayCategoriesSelect', () => ({
  EbayCategoriesSelect: (props: Record<string, unknown>) => {
    ebayCategoriesSelectSpy(props);
    return <div data-testid="mock-ebay-categories-select">eBay categories select</div>;
  },
}));

describe('ApprovalFormFieldsSupplementalEditors', () => {
  it('does not render eBay shipping editors outside the eBay drawer', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField={undefined}
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[]}
        selectedWorkflowImageUrls={[]}
        formValues={{}}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName="Domestic Shipping Fees"
        ebayInternationalShippingFeesFieldName="International Shipping Fees"
        ebayDomesticShippingFlatFeeFieldName="eBay Domestic Shipping Flat Fee"
        ebayInternationalShippingFlatFeeFieldName="eBay International Shipping Flat Fee"
        hasEbayShippingServicesEditor={true}
        domesticService1FieldName="Domestic Service 1"
        domesticService2FieldName="Domestic Service 2"
        internationalService1FieldName="International Service 1"
        internationalService2FieldName="International Service 2"
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    expect(shippingEditorsSpy).not.toHaveBeenCalled();
  });

  it('renders eBay shipping editors only in the eBay drawer', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField={undefined}
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[]}
        selectedWorkflowImageUrls={[]}
        formValues={{}}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={true}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName="Domestic Shipping Fees"
        ebayInternationalShippingFeesFieldName="International Shipping Fees"
        ebayDomesticShippingFlatFeeFieldName="eBay Domestic Shipping Flat Fee"
        ebayInternationalShippingFlatFeeFieldName="eBay International Shipping Flat Fee"
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    expect(shippingEditorsSpy).toHaveBeenCalledWith(expect.objectContaining({
      ebayDomesticShippingFeesFieldName: 'Domestic Shipping Fees',
      ebayInternationalShippingFeesFieldName: 'International Shipping Fees',
    }));
  });

  it('preserves explicit selected image ordering when serializing listing fields', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const values = buildWorkflowListingImageSelectionValues({
      selectedUrls: [
        '/api/media/used-gear-workflow/uc?id=file-image-b',
        '/api/media/used-gear-workflow/uc?id=file-image-a',
      ],
      attachments: [
        { id: 'att-1', url: '/api/media/used-gear-workflow/uc?id=file-image-a', filename: 'image-a.jpg' },
        { id: 'att-2', url: '/api/media/used-gear-workflow/uc?id=file-image-b', filename: 'image-b.jpg' },
      ],
      currentRows: [
        { src: '/api/media/used-gear-workflow/uc?id=file-image-a', alt: 'Front view', position: 1 },
        { src: '/api/media/used-gear-workflow/uc?id=file-image-b', alt: 'Rear view', position: 2 },
      ],
    });

    expect(values.imageValue).toBe('/api/media/used-gear-workflow/uc?id=file-image-b, /api/media/used-gear-workflow/uc?id=file-image-a');
    expect(values.imageAltTextValue).toBe('Rear view, Front view');
    expect(values.shopifyImagePayloadValue).toBe(JSON.stringify([
      { src: '/api/media/used-gear-workflow/uc?id=file-image-b', alt: 'Rear view', position: 1 },
      { src: '/api/media/used-gear-workflow/uc?id=file-image-a', alt: 'Front view', position: 2 },
    ]));
  });

  it('updates listing image fields from workflow image toggles', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const setFormValue = vi.fn();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField="Images"
        useCombinedImageAltEditor
        combinedImageEditorValue=""
        imageAltTextSourceField="Images Alt Text"
        shopifyImagePayloadFieldName="Shopify REST Images JSON"
        workflowImageAttachments={[
          { id: 'att-1', url: '/api/media/used-gear-workflow/uc?id=file-image-a', filename: 'image-a.jpg' },
          { id: 'att-2', url: '/api/media/used-gear-workflow/uc?id=file-image-b', filename: 'image-b.jpg' },
        ]}
        selectedWorkflowImageUrls={['/api/media/used-gear-workflow/uc?id=file-image-a']}
        formValues={{
          Images: '/api/media/used-gear-workflow/uc?id=file-image-a',
          'Images Alt Text': 'Front view',
          'Shopify REST Images JSON': JSON.stringify([
            { src: '/api/media/used-gear-workflow/uc?id=file-image-a', alt: 'Front view', position: 1 },
          ]),
        }}
        setFormValue={setFormValue}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    expect(setFormValue).toHaveBeenNthCalledWith(1, 'Images', '/api/media/used-gear-workflow/uc?id=file-image-a, /api/media/used-gear-workflow/uc?id=file-image-b');
    expect(setFormValue).toHaveBeenNthCalledWith(2, 'Images Alt Text', 'Front view, ');
    expect(setFormValue).toHaveBeenNthCalledWith(3, 'Shopify REST Images JSON', JSON.stringify([
      { src: '/api/media/used-gear-workflow/uc?id=file-image-a', alt: 'Front view', position: 1 },
      { src: '/api/media/used-gear-workflow/uc?id=file-image-b', alt: '', position: 2 },
    ]));
  });

  it('lets the listing editor exclude a testing-stage image while keeping the remaining workflow image payload aligned', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const setFormValue = vi.fn();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField="Images"
        useCombinedImageAltEditor
        combinedImageEditorValue=""
        imageAltTextSourceField="Images Alt Text"
        shopifyImagePayloadFieldName="Shopify REST Images JSON"
        workflowImageAttachments={[
          { id: 'att-testing', url: '/api/media/used-gear-workflow/uc?id=file-testing-reference', filename: 'testing-reference.jpg' },
          { id: 'att-photos', url: '/api/media/used-gear-workflow/uc?id=file-photos-hero', filename: 'photos-hero.jpg' },
        ]}
        selectedWorkflowImageUrls={[
          '/api/media/used-gear-workflow/uc?id=file-testing-reference',
          '/api/media/used-gear-workflow/uc?id=file-photos-hero',
        ]}
        formValues={{
          Images: '/api/media/used-gear-workflow/uc?id=file-testing-reference, /api/media/used-gear-workflow/uc?id=file-photos-hero',
          'Images Alt Text': 'Testing reference, Photos hero',
          'Shopify REST Images JSON': JSON.stringify([
            { src: '/api/media/used-gear-workflow/uc?id=file-testing-reference', alt: 'Testing reference', position: 1 },
            { src: '/api/media/used-gear-workflow/uc?id=file-photos-hero', alt: 'Photos hero', position: 2 },
          ]),
        }}
        setFormValue={setFormValue}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(setFormValue).toHaveBeenNthCalledWith(1, 'Images', '/api/media/used-gear-workflow/uc?id=file-photos-hero');
    expect(setFormValue).toHaveBeenNthCalledWith(2, 'Images Alt Text', 'Photos hero');
    expect(setFormValue).toHaveBeenNthCalledWith(3, 'Shopify REST Images JSON', JSON.stringify([
      { src: '/api/media/used-gear-workflow/uc?id=file-photos-hero', alt: 'Photos hero', position: 1 },
    ]));
  });

  it('writes both Images and Shopify REST Images JSON so persistence can save whichever field is writable', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const setFormValue = vi.fn();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField="Images"
        useCombinedImageAltEditor
        combinedImageEditorValue=""
        imageAltTextSourceField="Images Alt Text"
        shopifyImagePayloadFieldName="Shopify REST Images JSON"
        workflowImageAttachments={[
          { id: 'att-1', url: '/api/media/used-gear-workflow/uc?id=file-image-a', filename: 'image-a.jpg' },
          { id: 'att-2', url: '/api/media/used-gear-workflow/uc?id=file-image-b', filename: 'image-b.jpg' },
        ]}
        selectedWorkflowImageUrls={['/api/media/used-gear-workflow/uc?id=file-image-a']}
        formValues={{
          Images: '/api/media/used-gear-workflow/uc?id=file-image-a',
          'Images Alt Text': 'Front view',
          'Shopify REST Images JSON': JSON.stringify([
            { src: '/api/media/used-gear-workflow/uc?id=file-image-a', alt: 'Front view', position: 1 },
          ]),
        }}
        setFormValue={setFormValue}
        saving={false}
        isReadOnlyApprovalField={(fieldName) => fieldName === 'Shopify REST Images JSON'}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    expect(setFormValue).toHaveBeenNthCalledWith(1, 'Images', '/api/media/used-gear-workflow/uc?id=file-image-a, /api/media/used-gear-workflow/uc?id=file-image-b');
    expect(setFormValue).toHaveBeenNthCalledWith(2, 'Images Alt Text', 'Front view, ');
    expect(setFormValue).toHaveBeenNthCalledWith(3, 'Shopify REST Images JSON', JSON.stringify([
      { src: '/api/media/used-gear-workflow/uc?id=file-image-a', alt: 'Front view', position: 1 },
      { src: '/api/media/used-gear-workflow/uc?id=file-image-b', alt: '', position: 2 },
    ]));
  });

  it('keeps normally named photography selected when a processed image is excluded using URL variants', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const setFormValue = vi.fn();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField="Images"
        useCombinedImageAltEditor
        combinedImageEditorValue=""
        imageAltTextSourceField="Images Alt Text"
        shopifyImagePayloadFieldName="Shopify REST Images JSON"
        workflowImageMetadataFieldName="Workflow Image Metadata JSON"
        workflowImageAttachments={[
          {
            id: 'att-photo-1',
            url: '/api/media/used-gear-workflow/uc?export=view&id=file-photo-1',
            filename: 'mit-miterminator-4-badge-detail-processed.jpg',
          },
          {
            id: 'att-photo-2',
            url: '/api/media/used-gear-workflow/uc?id=file-photo-2',
            filename: 'brand-model-amplifier-rear.jpg',
          },
        ]}
        selectedWorkflowImageUrls={[
          '/api/media/used-gear-workflow/thumbnail?id=file-photo-1&sz=w1600',
          '/api/media/used-gear-workflow/uc?id=file-photo-2',
        ]}
        formValues={{
          Images: '/api/media/used-gear-workflow/thumbnail?id=file-photo-1&sz=w1600, /api/media/used-gear-workflow/uc?id=file-photo-2',
          'Images Alt Text': '',
          'Shopify REST Images JSON': JSON.stringify([
            { src: '/api/media/used-gear-workflow/thumbnail?id=file-photo-1&sz=w1600', alt: '', position: 1 },
            { src: '/api/media/used-gear-workflow/uc?id=file-photo-2', alt: '', position: 2 },
          ]),
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-photo-1',
              url: '/api/media/used-gear-workflow/uc?export=view&id=file-photo-1',
              filename: 'mit-miterminator-4-badge-detail-processed.jpg',
              alt: '',
              sortOrder: 1,
              sourceStage: 'photos',
              includedInListing: true,
            },
            {
              attachmentId: 'att-photo-2',
              url: '/api/media/used-gear-workflow/uc?id=file-photo-2',
              filename: 'brand-model-amplifier-rear.jpg',
              alt: '',
              sortOrder: 2,
              sourceStage: 'photos',
              includedInListing: true,
            },
          ]),
        }}
        setFormValue={setFormValue}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    const metadataCall = setFormValue.mock.calls.find((call) => call[0] === 'Workflow Image Metadata JSON');
    expect(metadataCall).toBeDefined();
    const serializedMetadata = String(metadataCall?.[1] ?? '');
    expect(serializedMetadata).toContain('"attachmentId":"att-photo-1"');
    expect(serializedMetadata).toContain('"includedInListing":false');
    const metadataRows = JSON.parse(serializedMetadata);
    expect(metadataRows).toHaveLength(2);
    expect(metadataRows.find((row: { attachmentId: string }) => row.attachmentId === 'att-photo-2')).toMatchObject({ includedInListing: true });
  });

  it('adds missing processed metadata rows when selecting from available images', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const setFormValue = vi.fn();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField="Images"
        useCombinedImageAltEditor
        combinedImageEditorValue=""
        imageAltTextSourceField="Images Alt Text"
        shopifyImagePayloadFieldName="Shopify REST Images JSON"
        workflowImageMetadataFieldName="Workflow Image Metadata JSON"
        workflowImageAttachments={[
          {
            id: 'att-photo-1',
            url: '/api/media/used-gear-workflow/uc?id=file-photo-1',
            filename: 'photo-1-processed.jpg',
          },
          {
            id: 'att-photo-2',
            url: '/api/media/used-gear-workflow/uc?id=file-photo-2',
            filename: 'photo-2-processed.jpg',
          },
        ]}
        selectedWorkflowImageUrls={[
          '/api/media/used-gear-workflow/uc?id=file-photo-1',
        ]}
        formValues={{
          Images: '/api/media/used-gear-workflow/uc?id=file-photo-1',
          'Images Alt Text': '',
          'Shopify REST Images JSON': JSON.stringify([
            { src: '/api/media/used-gear-workflow/uc?id=file-photo-1', alt: '', position: 1 },
          ]),
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-photo-1',
              url: '/api/media/used-gear-workflow/uc?id=file-photo-1',
              filename: 'photo-1-processed.jpg',
              alt: '',
              sortOrder: 1,
              sourceStage: 'photos',
              includedInListing: true,
            },
          ]),
        }}
        setFormValue={setFormValue}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    const metadataCall = setFormValue.mock.calls.find((call) => call[0] === 'Workflow Image Metadata JSON');
    expect(metadataCall).toBeDefined();
    const serializedMetadata = String(metadataCall?.[1] ?? '');
    expect(serializedMetadata).toContain('"attachmentId":"att-photo-2"');
    expect(serializedMetadata).toContain('"url":"/api/media/used-gear-workflow/uc?id=file-photo-2"');
    expect(serializedMetadata).toContain('"includedInListing":true');
  });

  it('keeps workflow image checkboxes enabled when Images is read-only but metadata is writable', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const setFormValue = vi.fn();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField="Images"
        useCombinedImageAltEditor
        combinedImageEditorValue=""
        imageAltTextSourceField="Images Alt Text"
        shopifyImagePayloadFieldName="Shopify REST Images JSON"
        workflowImageMetadataFieldName="Workflow Image Metadata JSON"
        workflowImageAttachments={[
          {
            id: 'att-photo-1',
            url: '/api/media/used-gear-workflow/uc?id=file-photo-1',
            filename: 'photo-1-processed.jpg',
          },
          {
            id: 'att-photo-2',
            url: '/api/media/used-gear-workflow/uc?id=file-photo-2',
            filename: 'photo-2-processed.jpg',
          },
        ]}
        selectedWorkflowImageUrls={[
          '/api/media/used-gear-workflow/uc?id=file-photo-1',
        ]}
        formValues={{
          Images: '/api/media/used-gear-workflow/uc?id=file-photo-1',
          'Images Alt Text': '',
          'Shopify REST Images JSON': JSON.stringify([
            { src: '/api/media/used-gear-workflow/uc?id=file-photo-1', alt: '', position: 1 },
          ]),
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-photo-1',
              url: '/api/media/used-gear-workflow/uc?id=file-photo-1',
              filename: 'photo-1-processed.jpg',
              alt: '',
              sortOrder: 1,
              sourceStage: 'photos',
              includedInListing: true,
            },
          ]),
        }}
        setFormValue={setFormValue}
        saving={false}
        isReadOnlyApprovalField={(fieldName) => fieldName === 'Images'}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[1]).not.toBeDisabled();
    fireEvent.click(checkboxes[1]);

    const metadataCall = setFormValue.mock.calls.find((call) => call[0] === 'Workflow Image Metadata JSON');
    expect(metadataCall).toBeDefined();
  });

  it('locks testing-derived detail editors to the Testing form when workflow-managed content is present', async () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const onOpenOperationalRecord = vi.fn();
    const onOpenTestingForm = vi.fn();

    render(
      <ApprovalFormFieldsSupplementalEditors
        recordId="rec-workflow-1"
        imageUrlSourceField={undefined}
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[]}
        selectedWorkflowImageUrls={[]}
        formValues={{
          'eBay Body Key Features JSON': '[]',
          'Testing Notes': 'Passed bench test.',
        }}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={true}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName="eBay Body Key Features JSON"
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName="Testing Notes"
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenTestingForm={onOpenTestingForm}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-key-features-editor')).toBeInTheDocument();
      expect(screen.getByTestId('mock-testing-notes-editor')).toBeInTheDocument();
    });

    const keyFeaturesEditor = screen.getByTestId('mock-key-features-editor');
    const testingNotesEditor = screen.getByTestId('mock-testing-notes-editor');

    fireEvent.click(within(keyFeaturesEditor).getByRole('button', { name: 'Edit workflow source record' }));
    fireEvent.click(within(testingNotesEditor).getByRole('button', { name: 'Edit testing form' }));

    expect(onOpenOperationalRecord).toHaveBeenCalledWith('rec-workflow-1');
    expect(onOpenTestingForm).toHaveBeenCalledWith('rec-workflow-1');

    await waitFor(() => {
      expect(keyFeaturesEditorSpy).toHaveBeenCalledWith(expect.objectContaining({
        disabled: true,
        helperText: expect.stringContaining('Testing form'),
      }));
      expect(testingNotesTextareaEditorSpy).toHaveBeenCalledWith(expect.objectContaining({
        disabled: true,
        helperText: expect.stringContaining('Testing form'),
      }));
    });
  });

  it('renders testing and photos quick links for workflow image source content', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    const onOpenTestingForm = vi.fn();
    const onOpenPhotosForm = vi.fn();

    render(
      <ApprovalFormFieldsSupplementalEditors
        recordId="rec-images-1"
        imageUrlSourceField="Images"
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[
          { id: 'att-1', url: '/api/media/used-gear-workflow/uc?id=file-image-a', filename: 'image-a.jpg' },
        ]}
        selectedWorkflowImageUrls={[]}
        formValues={{ Images: '' }}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        onOpenTestingForm={onOpenTestingForm}
        onOpenPhotosForm={onOpenPhotosForm}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit testing form' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit photos form' }));

    expect(onOpenTestingForm).toHaveBeenCalledWith('rec-images-1');
    expect(onOpenPhotosForm).toHaveBeenCalledWith('rec-images-1');
  });

  it('renders key features immediately after the listing images selector', async () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField="Images"
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[
          { id: 'att-1', url: '/api/media/used-gear-workflow/uc?id=file-image-a', filename: 'image-a.jpg' },
        ]}
        selectedWorkflowImageUrls={[]}
        formValues={{
          Images: '',
          'eBay Body Key Features JSON': '[]',
          Description: 'Listing description',
        }}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        activeBodyDescriptionFieldName="Description"
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={true}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName="eBay Body Key Features JSON"
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-key-features-editor')).toBeInTheDocument();
    });

    const imageSelector = screen.getByTestId('workflow-listing-image-selector');
    const keyFeaturesEditor = screen.getByTestId('mock-key-features-editor');
    const description = screen.getByText('Description');

    expect(imageSelector.compareDocumentPosition(keyFeaturesEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(keyFeaturesEditor.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('passes guidance that Make and Model are automatic for editable eBay key features', async () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField={undefined}
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[]}
        selectedWorkflowImageUrls={[]}
        formValues={{
          'eBay Body Key Features JSON': '[]',
        }}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={true}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName="eBay Body Key Features JSON"
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    await waitFor(() => {
      expect(keyFeaturesEditorSpy).toHaveBeenCalledWith(expect.objectContaining({
        helperText: 'Shared buyer-facing highlights for the eBay body. Make, Model, Serial Number, Condition, Cosmetic Notes, Includes, Original Box, Manual, Remote, Power Cable, Voltage, and Audiogon Rating are added automatically from the listing record. Add one here only if you need to override the listing value.',
      }));
    });
  });

  it('renders the shared Testing section on single-channel listing editors and suppresses the standalone testing-notes editor', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField={undefined}
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[]}
        selectedWorkflowImageUrls={[]}
        formValues={{
          Manual: 'Included',
          'Original Box': 'No',
          Voltage: '120V',
          Remote: 'Included',
          'Power Cable': 'Included',
          'Testing Notes': 'Bench tested',
          'Audiogon Rating': '8/10',
          'Testing Cosmetic Notes': 'Light wear on the top cover.',
        }}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent
        testingSectionFields={[
          { fieldName: 'Manual', label: 'Manual', multiline: false },
          { fieldName: 'Original Box', label: 'Original Box', multiline: false },
          { fieldName: 'Voltage', label: 'Voltage', multiline: false },
          { fieldName: 'Remote', label: 'Remote', multiline: false },
          { fieldName: 'Power Cable', label: 'Power Cable', multiline: false },
          { fieldName: 'Testing Notes', label: 'Testing Notes', multiline: true },
          { fieldName: 'Audiogon Rating', label: 'Audiogon Rating', multiline: false },
          { fieldName: 'Testing Cosmetic Notes', label: 'Cosmetic Notes', multiline: true },
        ]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName="Testing Notes"
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getAllByText('Included').length).toBeGreaterThan(0);
    expect(screen.getByText('Testing Notes')).toBeInTheDocument();
    expect(screen.getByText('Bench tested')).toBeInTheDocument();
    expect(screen.getByText('Cosmetic Notes')).toBeInTheDocument();
    expect(screen.getByText('Light wear on the top cover.')).toBeInTheDocument();
    expect(testingNotesTextareaEditorSpy).not.toHaveBeenCalled();
  });

  it('renders testing-section values from merged source fields when the editable form only carries testing notes', () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField={undefined}
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[]}
        selectedWorkflowImageUrls={[]}
        formValues={{
          'Testing Notes': 'Bench tested',
        }}
        testingSectionValues={{
          Manual: 'Included',
          'Original Box': 'No',
          Voltage: '120V',
          Remote: 'Included',
          'Power Cable': 'Included',
          'Testing Notes': 'Bench tested',
          'Audiogon Rating': '8/10',
          'Testing Cosmetic Notes': 'Light wear on the top cover.',
        }}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent
        testingSectionFields={[
          { fieldName: 'Manual', label: 'Manual', multiline: false },
          { fieldName: 'Original Box', label: 'Original Box', multiline: false },
          { fieldName: 'Voltage', label: 'Voltage', multiline: false },
          { fieldName: 'Remote', label: 'Remote', multiline: false },
          { fieldName: 'Power Cable', label: 'Power Cable', multiline: false },
          { fieldName: 'Testing Notes', label: 'Testing Notes', multiline: true },
          { fieldName: 'Audiogon Rating', label: 'Audiogon Rating', multiline: false },
          { fieldName: 'Testing Cosmetic Notes', label: 'Cosmetic Notes', multiline: true },
        ]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={false}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName="Testing Notes"
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName="categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={[]}
        normalizedEbayCategoryLabelsById={{}}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Original Box')).toBeInTheDocument();
    expect(screen.getByText('Voltage')).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByText('Power Cable')).toBeInTheDocument();
    expect(screen.getByText('Audiogon Rating')).toBeInTheDocument();
    expect(screen.getAllByText('Included').length).toBeGreaterThan(0);
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('120V')).toBeInTheDocument();
    expect(screen.getByText('Bench tested')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText('Light wear on the top cover.')).toBeInTheDocument();
  });

  it('renders the eBay category selector when the category editor is enabled', async () => {
    shippingEditorsSpy.mockReset();
    keyFeaturesEditorSpy.mockReset();
    testingNotesTextareaEditorSpy.mockReset();
    ebayCategoriesSelectSpy.mockReset();

    render(
      <ApprovalFormFieldsSupplementalEditors
        imageUrlSourceField={undefined}
        useCombinedImageAltEditor={false}
        combinedImageEditorValue=""
        imageAltTextSourceField={undefined}
        shopifyImagePayloadFieldName={undefined}
        workflowImageAttachments={[]}
        selectedWorkflowImageUrls={[]}
        formValues={{ Categories: '3276' }}
        setFormValue={vi.fn()}
        saving={false}
        isReadOnlyApprovalField={() => false}
        workflowManagedListingContent={false}
        testingSectionFields={[]}
        renderSpecialLabel={(label) => <span>{label}</span>}
        inputBaseClass="input"
        isEbayApprovalForm={true}
        shopifyKeyFeaturesFieldName={undefined}
        shopifyKeyFeaturesSyncFieldNames={[]}
        ebayKeyFeaturesFieldName={undefined}
        ebayKeyFeaturesSyncFieldNames={[]}
        ebayTestingNotesFieldName={undefined}
        ebayAttributesFieldName={undefined}
        ebayAttributesSyncFieldNames={[]}
        ebayDomesticShippingFeesFieldName={undefined}
        ebayInternationalShippingFeesFieldName={undefined}
        ebayDomesticShippingFlatFeeFieldName=""
        ebayInternationalShippingFlatFeeFieldName=""
        hasEbayShippingServicesEditor={false}
        domesticService1FieldName={undefined}
        domesticService2FieldName={undefined}
        internationalService1FieldName={undefined}
        internationalService2FieldName={undefined}
        hasShopifyTagEditor={false}
        shopifyTagValues={[]}
        setShopifyTagValues={vi.fn()}
        hasShopifyCollectionEditor={false}
        shopifyCollectionsFieldName="Collections"
        effectiveShopifyCollectionIds={[]}
        effectiveCollectionEditorLabelsById={{}}
        setShopifyCollectionIds={vi.fn()}
        hasEbayCategoryEditor
        effectiveEbayCategoriesFieldName="Categories"
        ebayMarketplaceId="EBAY_US"
        ebaySelectedCategoryDisplayValues={['3276']}
        normalizedEbayCategoryLabelsById={{ '3276': 'Amplifiers' }}
        setEbayCategoryIds={vi.fn()}
        hasSecondaryEbayCategory={false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-ebay-categories-select')).toBeInTheDocument();
    });

    expect(ebayCategoriesSelectSpy).toHaveBeenCalledWith(expect.objectContaining({
      fieldName: 'Categories',
      marketplaceId: 'EBAY_US',
      value: ['3276'],
      required: true,
    }));
  });
});