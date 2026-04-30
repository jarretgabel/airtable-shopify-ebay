import type { EbayListingTemplateId } from './approvalFormFieldsEbayHelpersBasic';

export type ApprovalChannel = 'shopify' | 'ebay' | 'combined' | undefined;
export type ApprovalFieldKind = 'boolean' | 'number' | 'json' | 'text';

export interface ApprovalFormFieldSetupParams {
  recordId?: string;
  approvalChannel?: ApprovalChannel;
  forceShowShopifyCollectionsEditor: boolean;
  isCombinedApproval: boolean;
  allFieldNames: string[];
  writableFieldNames: string[];
  formValues: Record<string, string>;
  fieldKinds: Record<string, ApprovalFieldKind>;
  originalFieldValues: Record<string, string>;
  normalizedBodyHtmlPreview?: string;
  normalizedShopifyTagValues?: string[];
  normalizedShopifyCollectionIds?: string[];
  normalizedShopifyCollectionLabelsById: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  selectedEbayTemplateId?: string;
  onEbayTemplateIdChange?: (templateId: EbayListingTemplateId) => void;
}