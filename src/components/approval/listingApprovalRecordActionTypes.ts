import type { publishApprovalRecord } from '@/services/app-api/approval';
import type { AirtableRecord } from '@/types/airtable';
import type { ShopifyProduct } from '@/types/shopify';

export type InlineNoticeTone = 'success' | 'warning' | 'error' | 'info';

export interface ShopifyApprovalPreviewShape {
  effectiveProduct: ShopifyProduct;
  collectionIds: string[];
  resolvedCategoryId?: string | null;
}

export interface UseListingApprovalRecordActionsParams {
  selectedRecord?: AirtableRecord;
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  allFieldNames: string[];
  approvedFieldName: string;
  actualFieldNames: string[];
  tableReference: string;
  tableName?: string;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  hydrateForm: (record: AirtableRecord, fieldNames: string[], approvedFieldName: string) => void;
  saveRecord: (
    shouldApprove: boolean,
    record: AirtableRecord,
    tableReference: string,
    tableName: string | undefined,
    allFieldNames: string[],
    approvedFieldName: string,
    afterSave: () => void,
    mode: 'full' | 'approve-only',
  ) => Promise<boolean>;
  bodyHtmlPreview: string;
  ebayBodyHtmlSaveFieldName: string;
  shouldForceEbayBodyHtmlSave: boolean;
  combinedSharedKeyFeaturesFieldName?: string;
  combinedEbayTestingNotesFieldName?: string;
  priceFieldName: string;
  createShopifyDraftOnApprove: boolean;
  shopifyApprovalPreview?: ShopifyApprovalPreviewShape | null;
  loadShopifyApprovalPreviewNow: (fields: Record<string, unknown>) => Promise<ShopifyApprovalPreviewShape>;
  syncExistingShopifyListing: (record: AirtableRecord, productId: number) => Promise<void>;
  describeShopifyCreateError: (error: unknown) => string;
  resolveShopifyCategoryId: () => Promise<string | undefined>;
  upsertShopifyProductWithCollectionFallback: (params: {
    product: ShopifyProduct;
    categoryId?: string;
    collectionIds?: string[];
    existingProductId?: number;
  }) => Promise<unknown>;
  canUpdateApprovedShopifyListing: boolean;
  hasMissingShopifyRequiredFields: boolean;
  hasMissingEbayRequiredFields: boolean;
  missingShopifyRequiredFieldLabels: string[];
  missingEbayRequiredFieldLabels: string[];
  approvalPublishSource: Parameters<typeof publishApprovalRecord>[0];
  mergedDraftSourceFields?: Record<string, unknown> | null;
  onBackToList: () => void;
  pushInlineActionNotice: (tone: InlineNoticeTone, title: string, message: string) => void;
}