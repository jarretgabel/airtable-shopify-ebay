import { EbayAttributesEditor } from './EbayAttributesEditor';
import { EbayCategoriesSelect } from './EbayCategoriesSelect';
import { EbayShippingServicesEditor } from './EbayShippingServicesEditor';
import { ApprovalFormFieldsShippingEditors } from './ApprovalFormFieldsShippingEditors';
import { ImageUrlListEditor } from './ImageUrlListEditor';
import { KeyFeaturesEditor } from './KeyFeaturesEditor';
import { ShopifyCollectionsSelect } from './ShopifyCollectionsSelect';
import { ShopifyTagsEditor } from './ShopifyTagsEditor';
import { TestingNotesEditor } from './TestingNotesEditor';
import { parseImageEditorRows, toCommaSeparatedImageValues } from './approvalFormFieldsImageHelpers';

export interface ApprovalFormFieldsSupplementalEditorsProps {
  imageUrlSourceField?: string;
  useCombinedImageAltEditor: boolean;
  combinedImageEditorValue: string;
  imageAltTextSourceField?: string;
  shopifyImagePayloadFieldName?: string;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  saving: boolean;
  isReadOnlyApprovalField: (fieldName: string) => boolean;
  activeBodyDescriptionFieldName?: string;
  renderSpecialLabel: (label: string, fieldName?: string) => JSX.Element;
  inputBaseClass: string;
  isEbayApprovalForm: boolean;
  shopifyKeyFeaturesFieldName?: string;
  shopifyKeyFeaturesSyncFieldNames: string[];
  ebayKeyFeaturesFieldName?: string;
  ebayKeyFeaturesSyncFieldNames: string[];
  ebayTestingNotesFieldName?: string;
  ebayAttributesFieldName?: string;
  ebayAttributesSyncFieldNames: string[];
  ebayDomesticShippingFeesFieldName?: string;
  ebayInternationalShippingFeesFieldName?: string;
  ebayDomesticShippingFlatFeeFieldName: string;
  ebayInternationalShippingFlatFeeFieldName: string;
  hasEbayShippingServicesEditor: boolean;
  domesticService1FieldName?: string;
  domesticService2FieldName?: string;
  internationalService1FieldName?: string;
  internationalService2FieldName?: string;
  hasShopifyTagEditor: boolean;
  shopifyTagValues: string[];
  setShopifyTagValues: (nextTags: string[]) => void;
  shopifyTagMaxTags?: number;
  hasShopifyCollectionEditor: boolean;
  shopifyCollectionsFieldName: string;
  effectiveShopifyCollectionIds: string[];
  effectiveCollectionEditorLabelsById: Record<string, string>;
  setShopifyCollectionIds: (nextCollectionIds: string[], collectionLabelsById?: Record<string, string>) => void;
  hasEbayCategoryEditor: boolean;
  effectiveEbayCategoriesFieldName: string;
  ebayMarketplaceId: string;
  ebaySelectedCategoryDisplayValues: string[];
  normalizedEbayCategoryLabelsById: Record<string, string>;
  setEbayCategoryIds: (nextIds: string[]) => void;
  onEbayCategoryLabelsChange?: (labelsById: Record<string, string>) => void;
  hasSecondaryEbayCategory: boolean;
  renderFieldLabel: (fieldName: string) => JSX.Element;
  getSelectClassName: (fieldName: string) => string;
  getInputClassName: (fieldName: string, extraClassName?: string) => string;
}

export function ApprovalFormFieldsSupplementalEditors({
  imageUrlSourceField,
  useCombinedImageAltEditor,
  combinedImageEditorValue,
  imageAltTextSourceField,
  shopifyImagePayloadFieldName,
  formValues,
  setFormValue,
  saving,
  isReadOnlyApprovalField,
  activeBodyDescriptionFieldName,
  renderSpecialLabel,
  inputBaseClass,
  isEbayApprovalForm,
  shopifyKeyFeaturesFieldName,
  shopifyKeyFeaturesSyncFieldNames,
  ebayKeyFeaturesFieldName,
  ebayKeyFeaturesSyncFieldNames,
  ebayTestingNotesFieldName,
  ebayAttributesFieldName,
  ebayAttributesSyncFieldNames,
  ebayDomesticShippingFeesFieldName,
  ebayInternationalShippingFeesFieldName,
  ebayDomesticShippingFlatFeeFieldName,
  ebayInternationalShippingFlatFeeFieldName,
  hasEbayShippingServicesEditor,
  domesticService1FieldName,
  domesticService2FieldName,
  internationalService1FieldName,
  internationalService2FieldName,
  hasShopifyTagEditor,
  shopifyTagValues,
  setShopifyTagValues,
  shopifyTagMaxTags,
  hasShopifyCollectionEditor,
  shopifyCollectionsFieldName,
  effectiveShopifyCollectionIds,
  effectiveCollectionEditorLabelsById,
  setShopifyCollectionIds,
  hasEbayCategoryEditor,
  effectiveEbayCategoriesFieldName,
  ebayMarketplaceId,
  ebaySelectedCategoryDisplayValues,
  normalizedEbayCategoryLabelsById,
  setEbayCategoryIds,
  onEbayCategoryLabelsChange,
  hasSecondaryEbayCategory,
  renderFieldLabel,
  getSelectClassName,
  getInputClassName,
}: ApprovalFormFieldsSupplementalEditorsProps) {
  return (
    <>
      {imageUrlSourceField && (
        <ImageUrlListEditor
          key={imageUrlSourceField}
          fieldLabel="Images"
          value={useCombinedImageAltEditor ? combinedImageEditorValue : (formValues[imageUrlSourceField] ?? '')}
          onChange={(newValue) => {
            const parsedRows = parseImageEditorRows(newValue);
            const normalizedRows = parsedRows
              .map((row, index) => ({
                src: row.src.trim(),
                alt: row.alt.trim(),
                position: index + 1,
              }))
              .filter((row) => row.src.length > 0);

            if (!useCombinedImageAltEditor || !imageAltTextSourceField) {
              setFormValue(imageUrlSourceField, newValue);
              if (shopifyImagePayloadFieldName && shopifyImagePayloadFieldName !== imageUrlSourceField) {
                setFormValue(
                  shopifyImagePayloadFieldName,
                  normalizedRows.length > 0 ? JSON.stringify(normalizedRows) : '',
                );
              }
              return;
            }

            const urls = normalizedRows.map((row) => row.src);
            const alts = parsedRows.map((row) => row.alt.trim());

            setFormValue(imageUrlSourceField, toCommaSeparatedImageValues(urls));
            setFormValue(imageAltTextSourceField, toCommaSeparatedImageValues(alts));
            if (shopifyImagePayloadFieldName && shopifyImagePayloadFieldName !== imageUrlSourceField) {
              setFormValue(
                shopifyImagePayloadFieldName,
                normalizedRows.length > 0 ? JSON.stringify(normalizedRows) : '',
              );
            }
          }}
          disabled={saving || isReadOnlyApprovalField(imageUrlSourceField)}
        />
      )}

      {activeBodyDescriptionFieldName && (
        <label className="col-span-1 flex flex-col gap-2 md:col-span-2">
          {renderSpecialLabel('Description', activeBodyDescriptionFieldName)}
          <textarea
            className={`${inputBaseClass} min-h-[110px] resize-y leading-[1.4]`}
            value={formValues[activeBodyDescriptionFieldName] ?? ''}
            onChange={(event) => setFormValue(activeBodyDescriptionFieldName, event.target.value)}
            placeholder={isEbayApprovalForm
              ? 'Listing description saved to Airtable Description and mirrored into Body HTML'
              : 'Short product description used in listing body HTML'}
            disabled={saving}
          />
        </label>
      )}

      {shopifyKeyFeaturesFieldName && (
        <KeyFeaturesEditor
          keyFeaturesFieldName={shopifyKeyFeaturesFieldName}
          keyFeaturesValue={formValues[shopifyKeyFeaturesFieldName] ?? ''}
          setFormValue={setFormValue}
          syncFieldNames={shopifyKeyFeaturesSyncFieldNames}
          disabled={saving}
        />
      )}

      {ebayKeyFeaturesFieldName && (
        <KeyFeaturesEditor
          keyFeaturesFieldName={ebayKeyFeaturesFieldName}
          keyFeaturesValue={formValues[ebayKeyFeaturesFieldName] ?? ''}
          setFormValue={setFormValue}
          syncFieldNames={ebayKeyFeaturesSyncFieldNames}
          disabled={saving}
        />
      )}

      {ebayTestingNotesFieldName && (
        <TestingNotesEditor
          fieldName={ebayTestingNotesFieldName}
          value={formValues[ebayTestingNotesFieldName] ?? ''}
          setFormValue={setFormValue}
          disabled={saving}
          label="Testing Notes"
        />
      )}

      {ebayAttributesFieldName && (
        <EbayAttributesEditor
          fieldName={ebayAttributesFieldName}
          value={formValues[ebayAttributesFieldName] ?? ''}
          setFormValue={setFormValue}
          syncFieldNames={ebayAttributesSyncFieldNames}
          disabled={saving}
          label="Attributes"
        />
      )}

      <ApprovalFormFieldsShippingEditors
        formValues={formValues}
        setFormValue={setFormValue}
        saving={saving}
        isReadOnlyApprovalField={isReadOnlyApprovalField}
        renderSpecialLabel={renderSpecialLabel}
        renderFieldLabel={renderFieldLabel}
        getSelectClassName={getSelectClassName}
        getInputClassName={getInputClassName}
        ebayDomesticShippingFeesFieldName={ebayDomesticShippingFeesFieldName}
        ebayInternationalShippingFeesFieldName={ebayInternationalShippingFeesFieldName}
        ebayDomesticShippingFlatFeeFieldName={ebayDomesticShippingFlatFeeFieldName}
        ebayInternationalShippingFlatFeeFieldName={ebayInternationalShippingFlatFeeFieldName}
      />

      {hasEbayShippingServicesEditor && (
        <EbayShippingServicesEditor
          domesticService1FieldName={domesticService1FieldName}
          domesticService2FieldName={domesticService2FieldName}
          internationalService1FieldName={internationalService1FieldName}
          internationalService2FieldName={internationalService2FieldName}
          values={formValues}
          setFormValue={setFormValue}
          disabled={saving}
        />
      )}

      {hasShopifyTagEditor && (
        <ShopifyTagsEditor
          tags={shopifyTagValues}
          onChange={setShopifyTagValues}
          disabled={saving}
          maxTags={shopifyTagMaxTags}
        />
      )}

      {hasShopifyCollectionEditor && (
        <ShopifyCollectionsSelect
          fieldName={shopifyCollectionsFieldName}
          label="Collections"
          value={effectiveShopifyCollectionIds}
          labelsById={effectiveCollectionEditorLabelsById}
          onChange={setShopifyCollectionIds}
          disabled={saving}
        />
      )}

      {hasEbayCategoryEditor && (
        <EbayCategoriesSelect
          fieldName={effectiveEbayCategoriesFieldName}
          label="eBay Categories"
          marketplaceId={ebayMarketplaceId}
          value={ebaySelectedCategoryDisplayValues}
          labelsById={normalizedEbayCategoryLabelsById}
          onChange={(nextIds, labelsById) => {
            setEbayCategoryIds(nextIds);
            if (labelsById) {
              onEbayCategoryLabelsChange?.(labelsById);
            }
          }}
          disabled={saving}
          helperWarning={hasSecondaryEbayCategory ? (
            <span className="text-xs font-semibold text-rose-300">
              Adding a second category incurrs extra fees
            </span>
          ) : null}
        />
      )}
    </>
  );
}