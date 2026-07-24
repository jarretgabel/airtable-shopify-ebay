import type { Dispatch, SetStateAction } from 'react';
import type { EbayListingTemplateId } from '@/components/approval/listingApprovalEbayConstants';
import type {
  EbayApprovalPayloadPreviewData,
  ShopifyApprovalPayloadPreviewData,
} from '@/components/approval/ListingApprovalRecordPayloadPanels';
import type { DrawerRequiredStatus } from '@/components/approval/listingApprovalCombinedSectionTypes';
import { shouldIncludeListingRecordFieldName } from '@/components/approval/listingApprovalFieldHelpers';
import { toFormValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

interface BuildListingApprovalSelectedRecordViewPropsParams {
  selectedRecord: AirtableRecord;
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  approvedFieldName: string;
  titleFieldName: string;
  allFieldNames: string[];
  formRequiredFieldNames: string[];
  formShopifyRequiredFieldNames: string[];
  formEbayRequiredFieldNames: string[];
  formValues: Record<string, string>;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  listingFormatOptions: string[];
  listingDurationOptions: string[];
  saving: boolean;
  setFormValue: (fieldName: string, value: string) => void;
  setDerivedFormValue: (fieldName: string, value: string) => void;
  currentPageShopifyBodyHtml: string;
  currentPageShopifyTagValues: string[];
  currentPageShopifyCollectionIds: string[];
  currentPageShopifyCollectionLabelsById: Record<string, string>;
  combinedDescriptionFieldName: string;
  combinedSharedFieldNames: string[];
  combinedRequiredFieldNames: string[];
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
  combinedSharedKeyFeaturesFieldName: string;
  combinedSharedKeyFeaturesSyncFieldNames: string[];
  combinedEbayTestingNotesFieldName: string;
  drawerSourceFields: Record<string, unknown>;
  sharedDrawerRequiredStatus: DrawerRequiredStatus;
  combinedShopifyOnlyFieldNames: string[];
  shopifyDrawerRequiredStatus: DrawerRequiredStatus;
  selectedEbayTemplateId: EbayListingTemplateId;
  setSelectedEbayTemplateId: Dispatch<SetStateAction<EbayListingTemplateId>>;
  combinedShopifyBodyHtmlFieldName: string;
  combinedShopifyBodyHtmlValue: string;
  currentPageProductDescriptionResolution: { sourceFieldName: string; sourceType: string };
  currentPageProductDescription: string;
  currentPageProductCategoryResolution: { sourceFieldName: string; sourceType: string };
  currentPageCategoryIdResolution: { sourceFieldName: string; value: string };
  shopifyCategoryLookupValue: string;
  shopifyCategoryResolution: {
    status: string;
    error?: string;
    match?: { fullName?: string; id?: string } | null;
  };
  isShopifyPayloadPreviewContext: boolean;
  shopifyProductSetRequest: ShopifyApprovalPayloadPreviewData['shopifyProductSetRequest'];
  combinedEbayOnlyFieldNames: string[];
  ebayDrawerRequiredStatus: DrawerRequiredStatus;
  combinedEbayGeneratedBodyHtml: string;
  ebayCategoryLabelsById: Record<string, string>;
  setEbayCategoryLabelsById: Dispatch<SetStateAction<Record<string, string>>>;
  setBodyHtmlPreview: Dispatch<SetStateAction<string>>;
  combinedEbayBodyHtmlFieldName: string;
  combinedEbayBodyHtmlValue: string;
  bodyHtmlPreview: string;
  isEbayPayloadPreviewContext: boolean;
  ebayDraftPayloadBundle: EbayApprovalPayloadPreviewData['ebayDraftPayloadBundle'];
  onOpenOperationalRecord?: (recordId: string) => void;
  onOpenIntakeForm?: (recordId: string) => void;
  onOpenTestingForm?: (recordId: string) => void;
  onOpenPhotosForm?: (recordId: string) => void;
}

export function buildListingApprovalSelectedRecordViewProps({
  selectedRecord,
  approvalChannel,
  isCombinedApproval,
  approvedFieldName,
  titleFieldName,
  allFieldNames,
  formRequiredFieldNames,
  formShopifyRequiredFieldNames,
  formEbayRequiredFieldNames,
  formValues,
  fieldKinds,
  listingFormatOptions,
  listingDurationOptions,
  saving,
  setFormValue,
  setDerivedFormValue,
  currentPageShopifyBodyHtml,
  currentPageShopifyTagValues,
  currentPageShopifyCollectionIds,
  currentPageShopifyCollectionLabelsById,
  combinedDescriptionFieldName,
  combinedSharedFieldNames,
  combinedRequiredFieldNames,
  shopifyRequiredFieldNames,
  ebayRequiredFieldNames,
  combinedSharedKeyFeaturesFieldName,
  combinedSharedKeyFeaturesSyncFieldNames,
  combinedEbayTestingNotesFieldName,
  drawerSourceFields,
  sharedDrawerRequiredStatus,
  combinedShopifyOnlyFieldNames,
  shopifyDrawerRequiredStatus,
  selectedEbayTemplateId,
  setSelectedEbayTemplateId,
  combinedShopifyBodyHtmlFieldName,
  combinedShopifyBodyHtmlValue,
  currentPageProductDescriptionResolution,
  currentPageProductDescription,
  currentPageProductCategoryResolution,
  currentPageCategoryIdResolution,
  shopifyCategoryLookupValue,
  shopifyCategoryResolution,
  isShopifyPayloadPreviewContext,
  shopifyProductSetRequest,
  combinedEbayOnlyFieldNames,
  ebayDrawerRequiredStatus,
  combinedEbayGeneratedBodyHtml,
  ebayCategoryLabelsById,
  setEbayCategoryLabelsById,
  setBodyHtmlPreview,
  combinedEbayBodyHtmlFieldName,
  combinedEbayBodyHtmlValue,
  bodyHtmlPreview,
  isEbayPayloadPreviewContext,
  ebayDraftPayloadBundle,
  onOpenOperationalRecord,
  onOpenIntakeForm,
  onOpenTestingForm,
  onOpenPhotosForm,
}: BuildListingApprovalSelectedRecordViewPropsParams) {
  const workflowImageSourceFieldNames = [
    'Images',
    'Workflow Images',
    'Workflow Photos',
    'Workflow Image Metadata JSON',
    'Workflow Image Metadata',
  ];

  const hydratedWorkflowImageSourceFieldNames = workflowImageSourceFieldNames.filter((fieldName) => {
    if (Object.prototype.hasOwnProperty.call(selectedRecord.fields, fieldName)) {
      return true;
    }

    const hydratedValue = formValues[fieldName];
    return typeof hydratedValue === 'string' && hydratedValue.trim().length > 0;
  });

  const approvalFormFieldNames = Array.from(new Set([
    ...allFieldNames.filter((fieldName) => shouldIncludeListingRecordFieldName(fieldName, approvalChannel)),
    ...hydratedWorkflowImageSourceFieldNames,
  ])).sort((left, right) => left.localeCompare(right));
  const approvalFormWritableFieldNames = Object.keys(selectedRecord.fields).filter((fieldName) => shouldIncludeListingRecordFieldName(fieldName, approvalChannel));
  const approvalFormOriginalFieldValues = Object.fromEntries(
    approvalFormFieldNames.map((fieldName) => {
      const recordHasField = Object.prototype.hasOwnProperty.call(selectedRecord.fields, fieldName);
      const recordValue = recordHasField ? toFormValue(selectedRecord.fields[fieldName]) : '';
      const hydratedValue = formValues[fieldName] ?? '';
      return [fieldName, recordValue || hydratedValue];
    }),
  );

  return {
    combinedSectionsProps: {
      selectedRecord,
      approvedFieldName,
      formValues,
      fieldKinds,
      listingFormatOptions,
      listingDurationOptions,
      saving,
      setFormValue,
      setDerivedFormValue,
      titleFieldName,
      combinedDescriptionFieldName,
      combinedSharedFieldNames,
      combinedRequiredFieldNames,
      shopifyRequiredFieldNames,
      ebayRequiredFieldNames,
      currentPageShopifyTagValues,
      currentPageShopifyCollectionIds,
      currentPageShopifyCollectionLabelsById,
      combinedSharedKeyFeaturesFieldName,
      combinedSharedKeyFeaturesSyncFieldNames,
      combinedEbayTestingNotesFieldName,
      sharedTestingSourceFieldValues: Object.fromEntries(
        Object.entries(drawerSourceFields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
      ),
      sharedDrawerRequiredStatus,
      onOpenIntakeForm,
      onOpenOperationalRecord,
      onOpenTestingForm,
      onOpenPhotosForm,
      combinedShopifyOnlyFieldNames,
      shopifyDrawerRequiredStatus,
      currentPageShopifyBodyHtml,
      selectedEbayTemplateId,
      setSelectedEbayTemplateId,
      combinedShopifyBodyHtmlFieldName,
      combinedShopifyBodyHtmlValue,
      currentPageProductDescriptionResolution,
      currentPageProductDescription,
      currentPageProductCategoryResolution,
      currentPageCategoryIdResolution,
      shopifyCategoryLookupValue,
      shopifyCategoryResolution,
      isShopifyPayloadPreviewContext,
      shopifyProductSetRequest,
      combinedEbayOnlyFieldNames,
      ebayDrawerRequiredStatus,
      combinedEbayGeneratedBodyHtml,
      ebayCategoryLabelsById,
      setEbayCategoryLabelsById,
      setBodyHtmlPreview,
      combinedEbayBodyHtmlFieldName,
      combinedEbayBodyHtmlValue,
      bodyHtmlPreview,
      isEbayPayloadPreviewContext,
      ebayDraftPayloadBundle,
    },
    approvalFormFieldsProps: {
      recordId: selectedRecord.id,
      approvalChannel,
      isCombinedApproval,
      forceShowShopifyCollectionsEditor: approvalChannel === 'shopify',
      allFieldNames: approvalFormFieldNames,
      writableFieldNames: approvalFormWritableFieldNames,
      requiredFieldNames: formRequiredFieldNames,
      shopifyRequiredFieldNames: formShopifyRequiredFieldNames,
      ebayRequiredFieldNames: formEbayRequiredFieldNames,
      approvedFieldName,
      formValues,
      fieldKinds,
      listingFormatOptions,
      listingDurationOptions,
      saving,
      setFormValue,
      setDerivedFormValue,
      suppressImageScalarFields: approvalChannel === 'shopify' || approvalChannel === 'ebay',
      originalFieldValues: approvalFormOriginalFieldValues,
      normalizedBodyHtmlPreview: approvalChannel === 'shopify'
        ? currentPageShopifyBodyHtml
        : approvalChannel === 'ebay'
          ? combinedEbayGeneratedBodyHtml
          : '',
      normalizedShopifyTagValues: approvalChannel === 'ebay' ? undefined : currentPageShopifyTagValues,
      normalizedShopifyCollectionIds: approvalChannel === 'ebay' ? undefined : currentPageShopifyCollectionIds,
      normalizedShopifyCollectionLabelsById: approvalChannel === 'ebay' ? undefined : currentPageShopifyCollectionLabelsById,
      normalizedEbayCategoryLabelsById: approvalChannel === 'ebay' ? ebayCategoryLabelsById : {},
      onEbayCategoryLabelsChange: approvalChannel === 'ebay'
        ? (labelsById: Record<string, string>) => setEbayCategoryLabelsById((current) => ({ ...current, ...labelsById }))
        : undefined,
      onBodyHtmlPreviewChange: setBodyHtmlPreview,
      onOpenOperationalRecord,
      onOpenTestingForm,
      onOpenPhotosForm,
      selectedEbayTemplateId,
      onEbayTemplateIdChange: setSelectedEbayTemplateId,
    },
    payloadPanelProps: {
      approvalChannel,
      currentPageShopifyBodyHtml,
      currentPageProductDescriptionResolution,
      currentPageProductDescription,
      currentPageProductCategoryResolution,
      currentPageCategoryIdResolution,
      shopifyCategoryLookupValue,
      shopifyCategoryResolution,
      isShopifyPayloadPreviewContext,
      shopifyProductSetRequest,
      isEbayPayloadPreviewContext,
      ebayDraftPayloadBundle,
    },
  };
}