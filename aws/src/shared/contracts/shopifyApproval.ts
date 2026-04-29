export interface ShopifyApprovalProductOption {
  id?: number;
  name: string;
  position?: number;
  values: string[];
}

export interface ShopifyApprovalProductVariant {
  id?: number;
  title?: string;
  position?: number;
  price?: string;
  compare_at_price?: string | null;
  sku?: string;
  barcode?: string;
  inventory_quantity?: number;
  inventory_management?: string;
  inventory_policy?: string;
  fulfillment_service?: string;
  taxable?: boolean;
  requires_shipping?: boolean;
  weight?: number;
  weight_unit?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
}

export interface ShopifyApprovalProductImage {
  id?: number;
  src: string;
  alt?: string;
  position?: number;
  variant_ids?: number[];
}

export interface ShopifyApprovalMetafield {
  id?: number;
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export interface ShopifyApprovalProduct {
  id?: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  handle?: string;
  published_at?: string | null;
  published_scope?: string;
  template_suffix?: string | null;
  tags?: string;
  status?: 'active' | 'draft' | 'archived';
  options?: ShopifyApprovalProductOption[];
  variants?: ShopifyApprovalProductVariant[];
  images?: ShopifyApprovalProductImage[];
  metafields?: ShopifyApprovalMetafield[];
}

export interface ShopifyApprovalTaxonomyCategoryMatch {
  id: string;
  fullName: string;
  name: string;
  isLeaf: boolean;
}

export interface ShopifyApprovalProductSetIdentifier {
  id?: string;
  handle?: string;
}

export interface ShopifyApprovalProductSetFileInput {
  originalSource: string;
  alt?: string;
  contentType: 'IMAGE';
}

export interface ShopifyApprovalProductSetOptionValueInput {
  name: string;
}

export interface ShopifyApprovalProductSetOptionInput {
  name: string;
  position?: number;
  values?: ShopifyApprovalProductSetOptionValueInput[];
}

export interface ShopifyApprovalVariantOptionValueInput {
  optionName: string;
  name: string;
}

export interface ShopifyApprovalInventoryItemInput {
  sku?: string;
  tracked?: boolean;
  requiresShipping?: boolean;
  measurement?: {
    weight: {
      value: number;
      unit: 'GRAMS' | 'KILOGRAMS' | 'OUNCES' | 'POUNDS';
    };
  };
}

export interface ShopifyApprovalProductSetVariantInput {
  optionValues: ShopifyApprovalVariantOptionValueInput[];
  price?: string;
  sku?: string;
  barcode?: string;
  position?: number;
  compareAtPrice?: string;
  inventoryPolicy?: 'CONTINUE' | 'DENY';
  inventoryItem?: ShopifyApprovalInventoryItemInput;
  taxable?: boolean;
}

export interface ShopifyApprovalProductSetInput {
  title?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  handle?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  tags?: string[];
  templateSuffix?: string;
  category?: string;
  collectionsToJoin?: string[];
  files?: ShopifyApprovalProductSetFileInput[];
  metafields?: ShopifyApprovalMetafield[];
  productOptions?: ShopifyApprovalProductSetOptionInput[];
  variants?: ShopifyApprovalProductSetVariantInput[];
}

export interface ShopifyApprovalProductSetRequest {
  input: ShopifyApprovalProductSetInput;
  synchronous: true;
  identifier?: ShopifyApprovalProductSetIdentifier;
}

export interface ShopifyApprovalFieldResolution {
  sourceFieldName: string;
  sourceType: 'exact' | 'normalized' | 'fuzzy' | 'draft-product' | 'none';
  value: string;
}

export interface ShopifyApprovalCategoryResolution {
  status: 'idle' | 'resolved' | 'unresolved' | 'error';
  match: ShopifyApprovalTaxonomyCategoryMatch | null;
  error: string;
}

export interface ShopifyApprovalPreviewResult {
  draftProduct: ShopifyApprovalProduct;
  effectiveProduct: ShopifyApprovalProduct;
  tagValues: string[];
  collectionIds: string[];
  collectionLabelsById?: Record<string, string>;
  bodyHtmlResolution: ShopifyApprovalFieldResolution;
  productDescriptionResolution: ShopifyApprovalFieldResolution;
  productCategoryResolution: ShopifyApprovalFieldResolution;
  categoryIdResolution: ShopifyApprovalFieldResolution;
  categoryLookupValue: string;
  categoryResolution: ShopifyApprovalCategoryResolution;
  resolvedCategoryId?: string;
  productSetRequest: ShopifyApprovalProductSetRequest;
}

export interface ShopifyApprovalPublishResult {
  productId: string;
  mode: 'created' | 'updated';
  warnings: string[];
  wroteProductId: boolean;
  staleProductIdCleared: boolean;
}