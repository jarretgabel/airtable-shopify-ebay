export const SHOPIFY_SHIPPING_DIMENSION_KEYS = {
  width: 'shipping_width_inches',
  depth: 'shipping_depth_inches',
  height: 'shipping_height_inches',
} as const;

export interface ShopifyShippingUpdate {
  variantId: number;
  weightPounds?: number;
  widthInches: number;
  depthInches: number;
  heightInches: number;
}

export interface ShopifyShippingInspection {
  productId: string;
  servedApiVersion: string | null;
  accessScopes: string[];
  packageAssignmentSupported: boolean;
  inventoryPackageFields: string[];
  shopPackageFields: string[];
  measurementPackageFields: string[];
  packageQueries: string[];
  packageMutations: string[];
  packedSizeSchema: {
    measurementInputFields: string[];
    inventoryItemInputFields: string[];
    variantInputFields: string[];
    measurementOutputFields: string[];
    inventoryItemOutputFields: string[];
  };
  variants: Array<{
    id: string;
    sku: string | null;
    inventoryItem: {
      id: string;
      requiresShipping: boolean;
      measurement: { weight: { value: number; unit: string } | null };
    };
  }>;
  variantsTruncated: boolean;
  dimensionMetafields: Record<'width' | 'depth' | 'height', {
    value: string;
    type: string;
    compareDigest?: string;
    definition?: { id: string; name: string } | null;
  } | null>;
  legacyDimensionMetafields?: ShopifyShippingInspection['dimensionMetafields'];
  dimensionDefinitions?: Record<'width' | 'depth' | 'height', { id: string; name: string; type: string } | null>;
}
