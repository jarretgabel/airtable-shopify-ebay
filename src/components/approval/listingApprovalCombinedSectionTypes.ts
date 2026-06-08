import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import type { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import type { EbayListingTemplateId } from '@/components/approval/listingApprovalEbayConstants';
import type {
  EbayApprovalPayloadPreviewData,
  ShopifyApprovalPayloadPreviewData,
} from '@/components/approval/ListingApprovalRecordPayloadPanels';
import type { AirtableRecord } from '@/types/airtable';

type ApprovalFormFieldsProps = ComponentProps<typeof ApprovalFormFields>;

export interface DrawerRequiredStatus {
  allFilled: boolean;
  hasRequired: boolean;
}

export interface CombinedSectionCommonProps {
  selectedRecord: AirtableRecord;
  approvedFieldName: string;
  formValues: ApprovalFormFieldsProps['formValues'];
  fieldKinds: ApprovalFormFieldsProps['fieldKinds'];
  listingFormatOptions: ApprovalFormFieldsProps['listingFormatOptions'];
  listingDurationOptions: ApprovalFormFieldsProps['listingDurationOptions'];
  saving: boolean;
  setFormValue: ApprovalFormFieldsProps['setFormValue'];
  setDerivedFormValue: ApprovalFormFieldsProps['setDerivedFormValue'];
  writableFieldNames: string[];
  originalFieldValues: Record<string, string>;
}

export interface ListingApprovalCombinedSharedSectionProps extends CombinedSectionCommonProps {
  sectionId?: string;
  titleFieldName: string;
  combinedDescriptionFieldName: string;
  combinedSharedFieldNames: string[];
  combinedRequiredFieldNames: string[];
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
  combinedSharedKeyFeaturesFieldName: string;
  combinedSharedKeyFeaturesSyncFieldNames: string[];
  sharedTestingSourceFieldValues: Record<string, string>;
  sharedDrawerRequiredStatus: DrawerRequiredStatus;
  onOpenOperationalRecord?: (recordId: string) => void;
  onOpenTestingForm?: (recordId: string) => void;
  onOpenPhotosForm?: (recordId: string) => void;
}

export interface ListingApprovalCombinedIntakeSectionProps extends CombinedSectionCommonProps {
  sectionId?: string;
  combinedSharedFieldNames: string[];
  sharedTestingSourceFieldValues: Record<string, string>;
  onOpenOperationalRecord?: (recordId: string) => void;
  onOpenTestingForm?: (recordId: string) => void;
  onOpenPhotosForm?: (recordId: string) => void;
}

export interface ListingApprovalCombinedShopifySectionProps extends CombinedSectionCommonProps, ShopifyApprovalPayloadPreviewData {
  sectionId?: string;
  combinedShopifyOnlyFieldNames: string[];
  shopifyRequiredFieldNames: string[];
  shopifyDrawerRequiredStatus: DrawerRequiredStatus;
  currentPageShopifyBodyHtml: string;
  currentPageShopifyTagValues: string[];
  currentPageShopifyCollectionIds: string[];
  currentPageShopifyCollectionLabelsById: Record<string, string>;
  selectedEbayTemplateId: EbayListingTemplateId;
  setSelectedEbayTemplateId: (templateId: EbayListingTemplateId) => void;
  combinedShopifyBodyHtmlFieldName: string;
  combinedShopifyBodyHtmlValue: string;
  currentPageProductDescriptionResolution: {
    sourceFieldName: string;
    sourceType: string;
  };
  currentPageProductDescription: string;
  currentPageProductCategoryResolution: {
    sourceFieldName: string;
    sourceType: string;
  };
  currentPageCategoryIdResolution: {
    sourceFieldName: string;
    value: string;
  };
  shopifyCategoryLookupValue: string;
  shopifyCategoryResolution: {
    error?: string;
    match?: {
      fullName?: string;
      id?: string;
    } | null;
    status: string;
  };
}

export interface ListingApprovalCombinedEbaySectionProps extends CombinedSectionCommonProps, EbayApprovalPayloadPreviewData {
  sectionId?: string;
  combinedEbayOnlyFieldNames: string[];
  ebayRequiredFieldNames: string[];
  ebayDrawerRequiredStatus: DrawerRequiredStatus;
  combinedEbayGeneratedBodyHtml: string;
  ebayCategoryLabelsById: Record<string, string>;
  setEbayCategoryLabelsById: Dispatch<SetStateAction<Record<string, string>>>;
  setBodyHtmlPreview: (value: string) => void;
  selectedEbayTemplateId: EbayListingTemplateId;
  setSelectedEbayTemplateId: (templateId: EbayListingTemplateId) => void;
  combinedEbayBodyHtmlFieldName: string;
  combinedEbayBodyHtmlValue: string;
  bodyHtmlPreview: string;
}