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
        'https://cdn.example.com/image-b.jpg',
        'https://cdn.example.com/image-a.jpg',
      ],
      attachments: [
        { id: 'att-1', url: 'https://cdn.example.com/image-a.jpg', filename: 'image-a.jpg' },
        { id: 'att-2', url: 'https://cdn.example.com/image-b.jpg', filename: 'image-b.jpg' },
      ],
      currentRows: [
        { src: 'https://cdn.example.com/image-a.jpg', alt: 'Front view', position: 1 },
        { src: 'https://cdn.example.com/image-b.jpg', alt: 'Rear view', position: 2 },
      ],
    });

    expect(values.imageValue).toBe('https://cdn.example.com/image-b.jpg, https://cdn.example.com/image-a.jpg');
    expect(values.imageAltTextValue).toBe('Rear view, Front view');
    expect(values.shopifyImagePayloadValue).toBe(JSON.stringify([
      { src: 'https://cdn.example.com/image-b.jpg', alt: 'Rear view', position: 1 },
      { src: 'https://cdn.example.com/image-a.jpg', alt: 'Front view', position: 2 },
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
          { id: 'att-1', url: 'https://cdn.example.com/image-a.jpg', filename: 'image-a.jpg' },
          { id: 'att-2', url: 'https://cdn.example.com/image-b.jpg', filename: 'image-b.jpg' },
        ]}
        selectedWorkflowImageUrls={['https://cdn.example.com/image-a.jpg']}
        formValues={{
          Images: 'https://cdn.example.com/image-a.jpg',
          'Images Alt Text': 'Front view',
          'Shopify REST Images JSON': JSON.stringify([
            { src: 'https://cdn.example.com/image-a.jpg', alt: 'Front view', position: 1 },
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

    expect(setFormValue).toHaveBeenNthCalledWith(1, 'Images', 'https://cdn.example.com/image-a.jpg, https://cdn.example.com/image-b.jpg');
    expect(setFormValue).toHaveBeenNthCalledWith(2, 'Images Alt Text', 'Front view, ');
    expect(setFormValue).toHaveBeenNthCalledWith(3, 'Shopify REST Images JSON', JSON.stringify([
      { src: 'https://cdn.example.com/image-a.jpg', alt: 'Front view', position: 1 },
      { src: 'https://cdn.example.com/image-b.jpg', alt: '', position: 2 },
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
          { id: 'att-testing', url: 'https://cdn.example.com/testing-reference.jpg', filename: 'testing-reference.jpg' },
          { id: 'att-photos', url: 'https://cdn.example.com/photos-hero.jpg', filename: 'photos-hero.jpg' },
        ]}
        selectedWorkflowImageUrls={[
          'https://cdn.example.com/testing-reference.jpg',
          'https://cdn.example.com/photos-hero.jpg',
        ]}
        formValues={{
          Images: 'https://cdn.example.com/testing-reference.jpg, https://cdn.example.com/photos-hero.jpg',
          'Images Alt Text': 'Testing reference, Photos hero',
          'Shopify REST Images JSON': JSON.stringify([
            { src: 'https://cdn.example.com/testing-reference.jpg', alt: 'Testing reference', position: 1 },
            { src: 'https://cdn.example.com/photos-hero.jpg', alt: 'Photos hero', position: 2 },
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

    expect(setFormValue).toHaveBeenNthCalledWith(1, 'Images', 'https://cdn.example.com/photos-hero.jpg');
    expect(setFormValue).toHaveBeenNthCalledWith(2, 'Images Alt Text', 'Photos hero');
    expect(setFormValue).toHaveBeenNthCalledWith(3, 'Shopify REST Images JSON', JSON.stringify([
      { src: 'https://cdn.example.com/photos-hero.jpg', alt: 'Photos hero', position: 1 },
    ]));
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
          { id: 'att-1', url: 'https://cdn.example.com/image-a.jpg', filename: 'image-a.jpg' },
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
    expect(screen.getByLabelText('Manual')).toHaveValue('Included');
    expect(screen.getByLabelText('Testing Notes')).toHaveValue('Bench tested');
    expect(screen.getByLabelText('Cosmetic Notes')).toHaveValue('Light wear on the top cover.');
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

    expect(screen.getByLabelText('Manual')).toHaveValue('Included');
    expect(screen.getByLabelText('Original Box')).toHaveValue('No');
    expect(screen.getByLabelText('Voltage')).toHaveValue('120V');
    expect(screen.getByLabelText('Remote')).toHaveValue('Included');
    expect(screen.getByLabelText('Power Cable')).toHaveValue('Included');
    expect(screen.getByLabelText('Testing Notes')).toHaveValue('Bench tested');
    expect(screen.getByLabelText('Audiogon Rating')).toHaveValue('8/10');
    expect(screen.getByLabelText('Cosmetic Notes')).toHaveValue('Light wear on the top cover.');
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
    }));
  });
});