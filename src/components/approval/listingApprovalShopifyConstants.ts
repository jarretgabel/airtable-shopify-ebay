import type { ShopifyApprovalPreviewResult } from '@/services/app-api/shopify';
import type { ShopifyUnifiedProductSetRequest } from '@/services/shopify';
import { SHOPIFY_DEFAULT_VENDOR } from '@/services/shopifyTags';

export const EMPTY_SHOPIFY_FIELD_RESOLUTION: ShopifyApprovalPreviewResult['bodyHtmlResolution'] = {
  sourceFieldName: '',
  sourceType: 'none',
  value: '',
};

export const EMPTY_SHOPIFY_CATEGORY_RESOLUTION: ShopifyApprovalPreviewResult['categoryResolution'] = {
  status: 'idle',
  match: null,
  error: '',
};

export const SHOPIFY_PRODUCT_SET_MUTATION = `mutation ProductSet($input: ProductSetInput!, $identifier: ProductSetIdentifiers, $synchronous: Boolean) {
  productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
    product {
      id
      title
      status
    }
    userErrors {
      field
      message
    }
  }
}`;

export const SHOPIFY_SEARCH_TAXONOMY_CATEGORIES_QUERY = `query SearchTaxonomyCategories($search: String!, $first: Int!) {
  taxonomy {
    categories(first: $first, search: $search) {
      edges {
        node {
          id
          fullName
          name
          isLeaf
        }
      }
    }
  }
}`;

export const CONDITION_FIELD_CANDIDATES = [
  '__Condition__',
  'Condition',
  'Item Condition',
  'condition',
  'item_condition',
] as const;

export const SHOPIFY_IMAGE_LIST_FIELD_CANDIDATES = [
  'Shopify REST Images JSON',
  'shopify_rest_images_json',
  'Shopify Images JSON',
  'shopify_images_json',
  'Shopify REST Images',
  'shopify_rest_images',
  'Images',
  'images',
  'Image URL',
  'Image URLs',
  'Image-URL',
  'Image-URLs',
  'image_url',
  'image_urls',
] as const;

export const SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES = [
  'Shopify Body Description',
  'Shopify REST Body Description',
  'Shopify Product Description',
  'Shopify REST Product Description',
  'Product Description',
  'Item Description',
  'Description',
  'shopify_body_description',
  'shopify_rest_body_description',
  'shopify_product_description',
  'shopify_rest_product_description',
  'product_description',
] as const;

export const SHOPIFY_BODY_HTML_FIELD_CANDIDATES = [
  'Shopify REST Body HTML',
  'Shopify Body HTML',
  'Shopify Body (HTML)',
  'Shopify GraphQL Description HTML',
  'Body (HTML)',
  'Body HTML',
  'body_html',
  'shopify_rest_body_html',
] as const;

export const SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES = [
  'Shopify Body Key Features JSON',
  'Shopify REST Body Key Features JSON',
  'Shopify Body Key Features',
  'Shopify REST Body Key Features',
  'Key Features JSON',
  'Key Features',
  'Features JSON',
  'Features',
  'shopify_body_key_features_json',
  'shopify_rest_body_key_features_json',
  'shopify_body_key_features',
  'shopify_rest_body_key_features',
] as const;

export const SHOPIFY_TITLE_FIELD_CANDIDATES = [
  'Shopify REST Title',
  'Shopify Title',
  'Item Title',
  'Title',
  'Name',
  'shopify_rest_title',
] as const;

export const SHOPIFY_PRICE_FIELD_CANDIDATES = [
  'Shopify REST Variant 1 Price',
  'Shopify Variant 1 Price',
  'Shopify REST Variant 1 Compare At Price',
  'Shopify Variant 1 Compare At Price',
  'Variant-Compare-Price',
  'Variant Compare Price',
  'Price',
  'shopify_rest_variant_1_price',
  'shopify_rest_variant_1_compare_at_price',
  'variant_compare_price',
] as const;

export const SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES = [
  'Shopify Type',
  'Type',
  'Product Type',
  'Shopify REST Product Type',
  'Shopify Product Type',
  'Shopify GraphQL Product Type',
  'Shopify REST Category',
  'Shopify Category',
  'Shopify Product Category',
  'Shopify REST Product Category',
  'Google Product Category',
  'Product Category',
  'Category',
  'shopify_rest_product_type',
  'shopify_product_type',
  'shopify_product_category',
  'shopify_rest_product_category',
  'google_product_category',
  'product_category',
] as const;

export const SHOPIFY_UNIFIED_PRODUCT_SET_DOCS_EXAMPLE: {
  operationName: string;
  query: string;
  variables: ShopifyUnifiedProductSetRequest;
} = {
  operationName: 'ProductSet',
  query: SHOPIFY_PRODUCT_SET_MUTATION,
  variables: {
    input: {
      title: 'Example Product Title',
      descriptionHtml: '<p>Example product description in HTML.</p>',
      vendor: SHOPIFY_DEFAULT_VENDOR,
      productType: 'Turntables & Record Players',
      handle: 'example-product-title',
      status: 'DRAFT',
      category: 'gid://shopify/TaxonomyCategory/el-2-3-10',
      tags: ['Vintage Audio', 'Turntable'],
      collectionsToJoin: ['gid://shopify/Collection/1234567890'],
      templateSuffix: 'product-template',
      files: [
        {
          originalSource: 'https://example.com/image-1.jpg',
          alt: 'Example image alt text',
          contentType: 'IMAGE',
        },
      ],
      productOptions: [
        {
          name: 'Condition',
          position: 1,
          values: [{ name: 'New' }],
        },
      ],
      variants: [
        {
          optionValues: [
            {
              optionName: 'Condition',
              name: 'New',
            },
          ],
          price: '99.99',
          sku: 'EXAMPLE-SKU-1',
          inventoryPolicy: 'DENY',
          taxable: true,
          inventoryItem: {
            sku: 'EXAMPLE-SKU-1',
            tracked: true,
            requiresShipping: true,
          },
        },
      ],
      metafields: [
        {
          namespace: 'custom',
          key: 'example_key',
          type: 'single_line_text_field',
          value: 'Example metafield value',
        },
      ],
    },
    synchronous: true,
  },
};