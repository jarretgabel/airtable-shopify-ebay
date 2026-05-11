import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalFormFieldsSupplementalEditors } from '@/components/approval/ApprovalFormFieldsSupplementalEditors';
import { buildWorkflowListingImageSelectionValues } from '@/components/approval/workflowListingImageHelpers';

vi.mock('@/components/approval/ApprovalFormFieldsShippingEditors', () => ({
  ApprovalFormFieldsShippingEditors: () => null,
}));

describe('ApprovalFormFieldsSupplementalEditors', () => {
  it('preserves explicit selected image ordering when serializing listing fields', () => {
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
});