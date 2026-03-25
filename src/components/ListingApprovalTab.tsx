import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import airtableService from '@/services/airtable';
import {
  buildShopifyUnifiedProductSetRequest,
  normalizeShopifyProductForUpsert,
  shopifyService,
  type ShopifyTaxonomyCategoryMatch,
  type ShopifyUnifiedProductSetRequest,
} from '@/services/shopify';
import { buildEbayDraftPayloadBundleFromApprovalFields } from '@/services/ebayDraftFromAirtable';
import {
  buildShopifyCollectionIdsFromApprovalFields,
  buildShopifyDraftProductFromApprovalFields,
} from '@/services/shopifyDraftFromAirtable';
import { SHOPIFY_DEFAULT_VENDOR } from '@/services/shopifyTags';
import { trimShopifyProductType } from '@/services/shopifyTaxonomy';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import { errorSurfaceClass, loadingSurfaceClass, panelSurfaceClass, spinnerClass } from '@/components/tabs/uiClasses';
import {
  CONDITION_FIELD,
  useApprovalStore,
  displayValue,
  fromFormValue,
  toFormValue,
  DEFAULT_APPROVAL_TABLE_REFERENCE,
  SHIPPING_SERVICE_FIELD,
} from '@/stores/approvalStore';
import { AirtableRecord } from '@/types/airtable';
import type { ShopifyProduct } from '@/types/shopify';

interface ListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
  tableReference?: string;
  tableName?: string;
  createShopifyDraftOnApprove?: boolean;
  approvalChannel?: 'shopify' | 'ebay';
}

interface ShopifyCategoryResolutionState {
  status: 'idle' | 'resolving' | 'resolved' | 'unresolved' | 'error';
  match: ShopifyTaxonomyCategoryMatch | null;
  error: string;
}

const SHOPIFY_PRODUCT_SET_MUTATION = `mutation ProductSet($input: ProductSetInput!, $identifier: ProductSetIdentifiers, $synchronous: Boolean) {
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

const SHOPIFY_SEARCH_TAXONOMY_CATEGORIES_QUERY = `query SearchTaxonomyCategories($search: String!, $first: Int!) {
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

const SHOPIFY_IMAGE_LIST_FIELD_CANDIDATES = [
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

const SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES = [
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

const SHOPIFY_BODY_HTML_FIELD_CANDIDATES = [
  'Shopify REST Body HTML',
  'Shopify Body HTML',
  'Shopify GraphQL Description HTML',
  'Body (HTML)',
  'Body HTML',
  'body_html',
  'shopify_rest_body_html',
] as const;

const SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES = [
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

const SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD = 'Shopify GraphQL Collection IDs';

const SHOPIFY_TITLE_FIELD_CANDIDATES = [
  'Shopify REST Title',
  'Shopify Title',
  'Item Title',
  'Title',
  'Name',
  'shopify_rest_title',
] as const;

const SHOPIFY_PRICE_FIELD_CANDIDATES = [
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

const SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES = [
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

const SHOPIFY_GRAPHQL_CATEGORY_ID_FIELD_CANDIDATES = [
  'Shopify GraphQL Category ID',
  'Shopify Extra Category ID',
  'Shopify Category ID',
  'shopify_graphql_category_id',
  'shopify_extra_category_id',
  'shopify_category_id',
] as const;

const EBAY_IMAGE_LIST_FIELD_CANDIDATES = [
  'eBay Inventory Product Image URLs JSON',
  'eBay Inventory Product ImageURLs JSON',
  'ebay_inventory_product_imageurls_json',
  'Shopify REST Images JSON',
  'shopify_rest_images_json',
  'Shopify Images JSON',
  'shopify_images_json',
  'Images',
  'images',
  'Image URL',
  'Image URLs',
  'Image-URL',
  'Image-URLs',
  'image_url',
  'image_urls',
] as const;

const EBAY_TITLE_FIELD_CANDIDATES = [
  'eBay Inventory Product Title',
  'Item Title',
  'Title',
  'Name',
] as const;

const EBAY_PRICE_FIELD_CANDIDATES = [
  'eBay Offer Price Value',
  'eBay Offer Auction Start Price Value',
  'Buy It Now/Starting Bid',
  'Buy It Now USD',
  'Starting Bid USD',
  'Price',
] as const;

const EBAY_VENDOR_FIELD_CANDIDATES = [
  'eBay Inventory Product Brand',
  'Brand',
  'Vendor',
  'Manufacturer',
] as const;

const EBAY_QTY_FIELD_CANDIDATES = [
  'eBay Inventory Ship To Location Quantity',
  'Quantity',
  'Qty',
] as const;

const EBAY_FORMAT_FIELD_CANDIDATES = [
  'eBay Offer Format',
  'Listing Format',
  'Status',
] as const;

const EBAY_PRIMARY_CATEGORY_FIELD_CANDIDATES = [
  'eBay Offer Category ID',
  'ebay_offer_category_id',
  'Primary Category',
  'primary_category',
] as const;

const EBAY_SECONDARY_CATEGORY_FIELD_CANDIDATES = [
  'eBay Offer Secondary Category ID',
  'ebay_offer_secondary_category_id',
  'Secondary Category',
  'secondary_category',
] as const;

const EBAY_CATEGORIES_FIELD_CANDIDATES = [
  'Categories',
  'categories',
] as const;

const EBAY_DESCRIPTION_FIELD_CANDIDATES = [
  'Description',
  'Item Description',
  'eBay Inventory Product Description',
  'ebay_inventory_product_description',
] as const;

const EBAY_BODY_HTML_FIELD_CANDIDATES = [
  'Body HTML',
  'Body (HTML)',
  'body_html',
  'eBay Body HTML',
  'ebay_body_html',
] as const;

const EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES = [
  'eBay Body Key Features JSON',
  'eBay Body Key Features',
  'eBay Listing Key Features JSON',
  'eBay Listing Key Features',
  'Key Features JSON',
  'Key Features',
  'Features JSON',
  'Features',
  'ebay_body_key_features_json',
  'ebay_body_key_features',
  'ebay_listing_key_features_json',
  'ebay_listing_key_features',
] as const;

function normalizeEbayListingFormat(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function getEbayPriceFieldLabel(listingFormat: string): string {
  const normalized = normalizeEbayListingFormat(listingFormat);
  if (normalized === 'AUCTION') return 'Starting Auction Price';
  if (normalized === 'FIXED_PRICE' || normalized === 'BUY_IT_NOW') return 'Buy It Now Price';
  return 'Buy It Now/Starting Bid Price';
}

function toApprovalFieldLabel(fieldName: string, options?: { ebayListingFormat?: string }): string {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'ebay offer price value') {
    return getEbayPriceFieldLabel(options?.ebayListingFormat ?? '');
  }

  const withSpaces = fieldName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withSpaces) return fieldName;

  return withSpaces
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z0-9]+$/.test(word)) return word;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

const SHOPIFY_UNIFIED_PRODUCT_SET_DOCS_EXAMPLE: {
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

function isVendorFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest vendor'
    || normalized === 'shopify vendor'
    || normalized === 'shopify graphql vendor'
    || normalized === 'vendor'
    || normalized === 'brand'
    || normalized === 'manufacturer'
    || normalized === 'shopify_rest_vendor';
}

function isShopifyGraphqlCollectionIdsFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify graphql collection ids'
    || normalized === 'shopify graphql collection id'
    || normalized === 'shopify graphql collections json'
    || normalized === 'shopify_graphql_collection_ids'
    || normalized === 'shopify_graphql_collection_id'
    || normalized === 'shopify_graphql_collections_json'
    || /^shopify\s+graphql\s+collection\s+\d+\s+id$/.test(normalized)
    || /^shopify_graphql_collection_\d+_id$/.test(normalized);
}

function normalizeShopifyCollectionIdForPayload(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^gid:\/\/shopify\/Collection\/\d+$/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Collection/${trimmed}`;
  return '';
}

function parseCollectionIdsFromFormPreview(raw: string | undefined): string[] {
  if (!raw) return [];

  const values: string[] = [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      parsed.forEach((entry) => {
        if (typeof entry === 'string' || typeof entry === 'number') {
          values.push(String(entry));
        }
      });
    }
  } catch {
    trimmed
      .split(/[\n,]/)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => values.push(token));
  }

  const seen = new Set<string>();
  return values
    .map(normalizeShopifyCollectionIdForPayload)
    .filter((collectionId) => {
      if (!collectionId) return false;
      const key = collectionId.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const EBAY_DRAFT_PAYLOAD_DOCS_EXAMPLE = {
  inventoryItem: {
    sku: 'EXAMPLE-SKU-1',
    product: {
      title: 'Example Product Title',
      description: '<p>Example eBay inventory item description.</p>',
      imageUrls: ['https://example.com/image-1.jpg'],
      brand: 'Example Brand',
      mpn: 'EXAMPLE-MPN',
      aspects: {
        Brand: ['Example Brand'],
      },
    },
    condition: 'USED_EXCELLENT',
    conditionDescription: 'Example condition details.',
    availability: {
      shipToLocationAvailability: {
        quantity: 1,
      },
    },
  },
  offer: {
    sku: 'EXAMPLE-SKU-1',
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: '3276',
    listingDescription: '<p>Example offer description.</p>',
    listingDuration: 'GTC',
    pricingSummary: {
      price: {
        value: '99.99',
        currency: 'USD',
      },
    },
    quantityLimitPerBuyer: 1,
    includeCatalogProductDetails: false,
  },
};

export function ListingApprovalTab({
  viewModel,
  tableReference: propsTableReference,
  tableName: propTableName,
  createShopifyDraftOnApprove = false,
  approvalChannel = 'ebay',
}: ListingApprovalTabProps) {
  type InlineActionNoticeTone = 'info' | 'success' | 'warning' | 'error';
  interface InlineActionNotice {
    id: string;
    tone: InlineActionNoticeTone;
    title: string;
    message: string;
  }

  const describeShopifyCreateError = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { errors?: unknown; error?: unknown; message?: unknown } | undefined;
      if (typeof data?.errors === 'string') return data.errors;
      if (data?.errors && typeof data.errors === 'object') return JSON.stringify(data.errors);
      if (typeof data?.error === 'string') return data.error;
      if (typeof data?.message === 'string') return data.message;
      if (typeof error.message === 'string' && error.message.length > 0) return error.message;
    }
    return error instanceof Error ? error.message : 'Unable to create Shopify draft product or save its ID back to Airtable.';
  };

  const describeCollectionJoinFailure = (detail: string): string => {
    const smartCollectionMatchIterator = detail.matchAll(/(gid:\/\/shopify\/Collection\/\d+):\s*Can't manually add products to a smart collection/gi);
    const smartCollectionIds = Array.from(smartCollectionMatchIterator)
      .map((match) => match[1])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    if (smartCollectionIds.length > 0) {
      return [
        'Some selected collections are smart collections, and Shopify does not allow manual product assignment to smart collections.',
        `Remove or replace these IDs in Airtable Collections: ${smartCollectionIds.join(', ')}.`,
        'The listing was saved, but those collection joins were skipped.',
      ].join(' ');
    }

    return [
      'Shopify rejected one or more collection joins after the listing save/update succeeded.',
      'This usually means invalid, stale, or non-manually-assignable collection IDs.',
      `Details: ${detail}`,
    ].join(' ');
  };

  const { selectedRecordId, onSelectRecord, onBackToList } = viewModel;
  const tableReference = propsTableReference
    || (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim()
    || DEFAULT_APPROVAL_TABLE_REFERENCE;
  const tableName = propTableName
    || (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim()
    || (import.meta.env.VITE_AIRTABLE_TABLE_NAME as string | undefined)?.trim();

  const {
    records,
    loading,
    saving,
    error,
    listingFormatOptions,
    formValues,
    fieldKinds,
    setFormValue,
    hydrateForm,
    loadRecords,
    loadListingFormatOptions,
    saveRecord,
  } = useApprovalStore();
  const [shopifyCategoryResolution, setShopifyCategoryResolution] = useState<ShopifyCategoryResolutionState>({
    status: 'idle',
    match: null,
    error: '',
  });
  const [creatingShopifyListing, setCreatingShopifyListing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [bodyHtmlPreview, setBodyHtmlPreview] = useState('');
  const [inlineActionNotices, setInlineActionNotices] = useState<InlineActionNotice[]>([]);

  const pushInlineActionNotice = (tone: InlineActionNoticeTone, title: string, message: string) => {
    const id = `inline-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setInlineActionNotices((current) => ([
      { id, tone, title, message },
      ...current,
    ].slice(0, 8)));
  };

  const actualFieldNames = useMemo(() => {
    const names = new Set<string>();
    records.forEach((record) => {
      Object.keys(record.fields).forEach((fieldName) => names.add(fieldName));
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const allFieldNames = useMemo(() => {
    const names = new Set<string>(actualFieldNames);

    if (approvalChannel === 'shopify') {
      const existingNames = Array.from(names);
      const existingLower = new Set(existingNames.map((name) => name.toLowerCase()));
      const preferredTitleField = existingNames.find((name) =>
        SHOPIFY_TITLE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_TITLE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));

      if (preferredTitleField) {
        names.add(preferredTitleField);
      }

      const preferredPriceField = existingNames.find((name) =>
        SHOPIFY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_PRICE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));

      if (preferredPriceField) {
        names.add(preferredPriceField);
      }

      const preferredProductTypeField = existingNames.find((name) =>
        SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));

      if (preferredProductTypeField) {
        names.add(preferredProductTypeField);
      }

      names.add('Collections');

      const preferredImageField = existingNames.find((name) =>
        SHOPIFY_IMAGE_LIST_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_IMAGE_LIST_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));

      if (preferredImageField) {
        names.add(preferredImageField);
      }

      const preferredDescriptionField = existingNames.find((name) =>
        SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));

      if (preferredDescriptionField) {
        names.add(preferredDescriptionField);
      }

      const preferredKeyFeaturesField = existingNames.find((name) =>
        SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));

      if (preferredKeyFeaturesField) {
        names.add(preferredKeyFeaturesField);
      }
    }

    if (approvalChannel === 'ebay') {
      const existingNames = Array.from(names);
      const existingLower = new Set(existingNames.map((name) => name.toLowerCase()));

      const preferredTitleField = existingNames.find((name) =>
        EBAY_TITLE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_TITLE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredTitleField) names.add(preferredTitleField);

      const preferredPriceField = existingNames.find((name) =>
        EBAY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_PRICE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredPriceField) names.add(preferredPriceField);

      const preferredImageField = existingNames.find((name) =>
        EBAY_IMAGE_LIST_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_IMAGE_LIST_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredImageField) names.add(preferredImageField);

      const preferredDescriptionField = existingNames.find((name) =>
        EBAY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DESCRIPTION_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDescriptionField) names.add(preferredDescriptionField);

      const preferredBodyHtmlField = existingNames.find((name) =>
        EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_BODY_HTML_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredBodyHtmlField) names.add(preferredBodyHtmlField);

      const preferredKeyFeaturesField = existingNames.find((name) =>
        EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredKeyFeaturesField) names.add(preferredKeyFeaturesField);

      const preferredPrimaryCategoryField = existingNames.find((name) =>
        EBAY_PRIMARY_CATEGORY_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredPrimaryCategoryField) names.add(preferredPrimaryCategoryField);

      const preferredSecondaryCategoryField = existingNames.find((name) =>
        EBAY_SECONDARY_CATEGORY_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredSecondaryCategoryField) names.add(preferredSecondaryCategoryField);

      const preferredCategoriesField = existingNames.find((name) =>
        EBAY_CATEGORIES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredCategoriesField) names.add(preferredCategoriesField);

      const hasAnyCategoryField = Array.from(names).some((name) => {
        const normalized = name.trim().toLowerCase();
        return normalized === 'categories'
          || normalized === 'category ids'
          || normalized === 'category_ids'
          || normalized === 'primary category'
          || normalized === 'primary category id'
          || normalized === 'primary_category'
          || normalized === 'primary_category_id'
          || normalized === 'secondary category'
          || normalized === 'secondary category id'
          || normalized === 'secondary_category'
          || normalized === 'secondary_category_id';
      });

      if (!hasAnyCategoryField) {
        // Airtable omits empty fields from record payloads, so expose a safe
        // category editor fallback without adding non-existent eBay alias fields.
        names.add('Categories');
      }
    }

    names.add(CONDITION_FIELD);

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [actualFieldNames, approvalChannel]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

  useEffect(() => {
    setInlineActionNotices([]);
  }, [selectedRecordId]);

  const mergedDraftSourceFields = useMemo(() => {
    if (!selectedRecord) return null;

    const merged: Record<string, unknown> = {
      ...selectedRecord.fields,
    };

    Object.entries(formValues).forEach(([fieldName, rawValue]) => {
      const kind = fieldKinds[fieldName] ?? 'text';
      merged[fieldName] = fromFormValue(rawValue, kind);
    });

    return merged;
  }, [selectedRecord, formValues, fieldKinds]);

  const normalizedShopifyDraftProduct = useMemo(() => {
    if (approvalChannel !== 'shopify' || !createShopifyDraftOnApprove || !mergedDraftSourceFields) return null;
    const draftProduct = buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields);
    return normalizeShopifyProductForUpsert(draftProduct);
  }, [approvalChannel, createShopifyDraftOnApprove, mergedDraftSourceFields]);

  const currentPageDraftProduct = useMemo(() => {
    if (approvalChannel !== 'shopify' || !mergedDraftSourceFields) return null;
    return buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields);
  }, [approvalChannel, mergedDraftSourceFields]);

  const currentPageBodyHtml = useMemo(
    () => currentPageDraftProduct?.body_html ?? '',
    [currentPageDraftProduct],
  );

  const currentPageBodyHtmlResolution = useMemo(() => {
    if (approvalChannel !== 'shopify' || !mergedDraftSourceFields) {
      return {
        sourceFieldName: '',
        sourceType: 'draft-product',
        value: currentPageBodyHtml,
      };
    }

    const entries = Object.entries(mergedDraftSourceFields);
    for (const candidate of SHOPIFY_BODY_HTML_FIELD_CANDIDATES) {
      const direct = mergedDraftSourceFields[candidate];
      if (typeof direct === 'string' && direct.trim().length > 0) {
        return {
          sourceFieldName: candidate,
          sourceType: 'exact',
          value: direct,
        };
      }

      const normalizedCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedCandidate);
      if (match && typeof match[1] === 'string' && match[1].trim().length > 0) {
        return {
          sourceFieldName: match[0],
          sourceType: 'normalized',
          value: match[1],
        };
      }
    }

    const fuzzyHtml = entries.find(([key, value]) => {
      if (typeof value !== 'string' || value.trim().length === 0) return false;
      const normalized = key.toLowerCase();
      return normalized.includes('body html') || normalized.includes('description html') || normalized.includes('body_html');
    });
    if (fuzzyHtml) {
      return {
        sourceFieldName: fuzzyHtml[0],
        sourceType: 'fuzzy',
        value: fuzzyHtml[1] as string,
      };
    }

    return {
      sourceFieldName: '',
      sourceType: 'draft-product',
      value: currentPageBodyHtml,
    };
  }, [approvalChannel, currentPageBodyHtml, mergedDraftSourceFields]);

  const currentPageResolvedBodyHtml = currentPageBodyHtmlResolution.value;

  const currentPageProductDescriptionResolution = useMemo(() => {
    if (approvalChannel !== 'shopify' || !mergedDraftSourceFields) {
      return {
        sourceFieldName: '',
        sourceType: 'none',
        value: '',
      };
    }

    const entries = Object.entries(mergedDraftSourceFields);
    for (const candidate of SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES) {
      const direct = mergedDraftSourceFields[candidate];
      if (typeof direct === 'string' && direct.trim().length > 0) {
        return {
          sourceFieldName: candidate,
          sourceType: 'exact',
          value: direct,
        };
      }

      const normalizedCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedCandidate);
      if (match && typeof match[1] === 'string' && match[1].trim().length > 0) {
        return {
          sourceFieldName: match[0],
          sourceType: 'normalized',
          value: match[1],
        };
      }
    }

    const fuzzyDescription = entries.find(([key, value]) => {
      if (typeof value !== 'string' || value.trim().length === 0) return false;
      const normalized = key.toLowerCase();
      const isDescriptionLike = normalized.includes('description');
      const isHtmlLike = normalized.includes('html') || normalized.includes('body html');
      const isKeyFeaturesLike = normalized.includes('key feature') || normalized.includes('features');
      return isDescriptionLike && !isHtmlLike && !isKeyFeaturesLike;
    });
    if (fuzzyDescription) {
      return {
        sourceFieldName: fuzzyDescription[0],
        sourceType: 'fuzzy',
        value: fuzzyDescription[1] as string,
      };
    }

    return {
      sourceFieldName: '',
      sourceType: 'none',
      value: '',
    };
  }, [approvalChannel, mergedDraftSourceFields]);

  const currentPageProductDescription = currentPageProductDescriptionResolution.value;

  const currentPageProductCategoryResolution = useMemo(() => {
    if (approvalChannel !== 'shopify' || !mergedDraftSourceFields) {
      return {
        sourceFieldName: '',
        sourceType: 'none',
        value: currentPageDraftProduct?.product_type ?? '',
      };
    }

    const entries = Object.entries(mergedDraftSourceFields);
    for (const candidate of SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES) {
      const direct = mergedDraftSourceFields[candidate];
      if (typeof direct === 'string' && direct.trim().length > 0) {
        return {
          sourceFieldName: candidate,
          sourceType: 'exact',
          value: direct,
        };
      }

      const normalizedCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedCandidate);
      if (match && typeof match[1] === 'string' && match[1].trim().length > 0) {
        return {
          sourceFieldName: match[0],
          sourceType: 'normalized',
          value: match[1],
        };
      }
    }

    const fuzzyCategory = entries.find(([key, value]) => {
      if (typeof value !== 'string' || value.trim().length === 0) return false;
      const normalized = key.toLowerCase();
      return normalized.includes('category') || normalized.includes('product type');
    });
    if (fuzzyCategory) {
      return {
        sourceFieldName: fuzzyCategory[0],
        sourceType: 'fuzzy',
        value: fuzzyCategory[1] as string,
      };
    }

    return {
      sourceFieldName: '',
      sourceType: 'draft-product',
      value: currentPageDraftProduct?.product_type ?? '',
    };
  }, [approvalChannel, mergedDraftSourceFields, currentPageDraftProduct]);

  const currentPageProductCategory = currentPageProductCategoryResolution.value;

  const currentPageCategoryIdResolution = useMemo(() => {
    if (approvalChannel !== 'shopify' || !mergedDraftSourceFields) {
      return {
        sourceFieldName: '',
        sourceType: 'none',
        value: '',
      };
    }

    const entries = Object.entries(mergedDraftSourceFields);
    for (const candidate of SHOPIFY_GRAPHQL_CATEGORY_ID_FIELD_CANDIDATES) {
      const direct = mergedDraftSourceFields[candidate];
      if (typeof direct === 'string' && direct.trim().length > 0) {
        return {
          sourceFieldName: candidate,
          sourceType: 'exact',
          value: direct,
        };
      }

      const normalizedCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedCandidate);
      if (match && typeof match[1] === 'string' && match[1].trim().length > 0) {
        return {
          sourceFieldName: match[0],
          sourceType: 'normalized',
          value: match[1],
        };
      }
    }

    return {
      sourceFieldName: '',
      sourceType: 'none',
      value: '',
    };
  }, [approvalChannel, mergedDraftSourceFields]);

  const shopifyCategoryLookupValue = currentPageCategoryIdResolution.value || currentPageProductCategory;

  useEffect(() => {
    if (approvalChannel !== 'shopify') {
      setShopifyCategoryResolution({
        status: 'idle',
        match: null,
        error: '',
      });
      return;
    }

    const lookupValue = shopifyCategoryLookupValue.trim();
    if (!lookupValue) {
      setShopifyCategoryResolution({
        status: 'idle',
        match: null,
        error: '',
      });
      return;
    }

    let cancelled = false;
    setShopifyCategoryResolution({
      status: 'resolving',
      match: null,
      error: '',
    });

    const resolveCategory = async () => {
      try {
        const match = await shopifyService.resolveTaxonomyCategory(lookupValue);
        if (cancelled) return;

        if (match) {
          setShopifyCategoryResolution({
            status: 'resolved',
            match,
            error: '',
          });
          return;
        }

        setShopifyCategoryResolution({
          status: 'unresolved',
          match: null,
          error: '',
        });
      } catch (resolveError) {
        if (cancelled) return;
        setShopifyCategoryResolution({
          status: 'error',
          match: null,
          error: resolveError instanceof Error ? resolveError.message : 'Unable to resolve Shopify taxonomy category.',
        });
      }
    };

    void resolveCategory();

    return () => {
      cancelled = true;
    };
  }, [approvalChannel, shopifyCategoryLookupValue]);

  const finalShopifyCreatePayload = useMemo(() => {
    if (approvalChannel !== 'shopify' || !createShopifyDraftOnApprove || !selectedRecord) return null;

    const baseProduct = normalizedShopifyDraftProduct
      ?? normalizeShopifyProductForUpsert(
        buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? selectedRecord.fields),
      );
    const baseProductRecord = (baseProduct as unknown as Record<string, unknown>) ?? {};
    const { body_html: _ignoredBodyHtml, ...baseProductWithoutBodyHtml } = baseProductRecord;

    return {
      ...baseProductWithoutBodyHtml,
      body_html: (
        currentPageResolvedBodyHtml
        || (typeof baseProductRecord.body_html === 'string' ? baseProductRecord.body_html : '')
      ),
      product_type: (
        trimShopifyProductType(currentPageProductCategory)
        || trimShopifyProductType(typeof baseProductWithoutBodyHtml.product_type === 'string' ? baseProductWithoutBodyHtml.product_type : '')
      ),
    } as ShopifyProduct;
  }, [
    approvalChannel,
    createShopifyDraftOnApprove,
    selectedRecord,
    normalizedShopifyDraftProduct,
    mergedDraftSourceFields,
    currentPageProductCategory,
    currentPageResolvedBodyHtml,
  ]);

  const currentPageCollectionIds = useMemo(() => {
    if (approvalChannel !== 'shopify' || !selectedRecord) return [] as string[];
    const previewCollections = parseCollectionIdsFromFormPreview(
      formValues[SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD]
      ?? formValues['shopify_graphql_collection_ids'],
    );
    if (previewCollections.length > 0) return previewCollections;

    // Only derive fallback collection IDs from explicit collection fields.
    // This keeps payload collections aligned with Airtable/form values and
    // avoids pulling IDs from unrelated legacy fields.
    const explicitCollectionSource: Record<string, unknown> = {
      Collections: formValues.Collections ?? selectedRecord.fields.Collections,
      'Shopify Collection IDs': formValues['Shopify Collection IDs'] ?? selectedRecord.fields['Shopify Collection IDs'],
      'Shopify GraphQL Collection IDs': formValues['Shopify GraphQL Collection IDs'] ?? selectedRecord.fields['Shopify GraphQL Collection IDs'],
      'Shopify GraphQL Collections JSON': formValues['Shopify GraphQL Collections JSON'] ?? selectedRecord.fields['Shopify GraphQL Collections JSON'],
      shopify_collection_ids: formValues.shopify_collection_ids ?? selectedRecord.fields.shopify_collection_ids,
      shopify_graphql_collection_ids: formValues.shopify_graphql_collection_ids ?? selectedRecord.fields.shopify_graphql_collection_ids,
      shopify_graphql_collections_json: formValues.shopify_graphql_collections_json ?? selectedRecord.fields.shopify_graphql_collections_json,
    };

    return buildShopifyCollectionIdsFromApprovalFields(explicitCollectionSource);
  }, [approvalChannel, formValues, selectedRecord]);

  const effectiveShopifyCreatePayload = useMemo(() => {
    if (!finalShopifyCreatePayload) return null;

    const rawExistingProductId = formValues['Shopify REST Product ID']?.trim();
    const parsedExistingProductId = Number(rawExistingProductId);
    const existingProductId = Number.isFinite(parsedExistingProductId) && parsedExistingProductId > 0
      ? parsedExistingProductId
      : undefined;
    const explicitCategoryId = currentPageCategoryIdResolution.value.trim();
    const previewCategoryId = explicitCategoryId
      || shopifyCategoryResolution.match?.id
      || (shopifyCategoryLookupValue.trim() ? '<resolved-from-taxonomy-lookup>' : undefined);

    return buildShopifyUnifiedProductSetRequest(finalShopifyCreatePayload, {
      categoryId: previewCategoryId,
      collectionIds: currentPageCollectionIds,
      existingProductId,
    });
  }, [
    currentPageCollectionIds,
    currentPageCategoryIdResolution.value,
    finalShopifyCreatePayload,
    formValues,
    shopifyCategoryLookupValue,
    shopifyCategoryResolution.match,
  ]);

  const shopifyDraftCreatePayloadJson = useMemo(() => {
    if (!effectiveShopifyCreatePayload) return '';
    try {
      const previewVariables: ShopifyUnifiedProductSetRequest = {
        ...effectiveShopifyCreatePayload,
        input: {
          ...effectiveShopifyCreatePayload.input,
          tags: effectiveShopifyCreatePayload.input.tags ?? [],
          collectionsToJoin: effectiveShopifyCreatePayload.input.collectionsToJoin ?? [],
        },
      };

      return JSON.stringify({
        operationName: 'ProductSet',
        query: SHOPIFY_PRODUCT_SET_MUTATION,
        variables: previewVariables,
      }, null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize payload"\n}';
    }
  }, [effectiveShopifyCreatePayload]);

  const shopifyPayloadDebug = useMemo(() => {
    if (!effectiveShopifyCreatePayload) {
      return {
        tags: [] as string[],
        collectionsToJoin: [] as string[],
      };
    }

    return {
      tags: effectiveShopifyCreatePayload.input.tags ?? [],
      collectionsToJoin: effectiveShopifyCreatePayload.input.collectionsToJoin ?? [],
    };
  }, [effectiveShopifyCreatePayload]);

  const shopifyCategorySyncPreviewJson = useMemo(() => {
    if (approvalChannel !== 'shopify') return '';
    if (!shopifyCategoryLookupValue.trim()) return '';
    if (currentPageCategoryIdResolution.value.trim() || shopifyCategoryResolution.match?.id) return '';

    const preview = {
      operationName: 'SearchTaxonomyCategories',
      query: SHOPIFY_SEARCH_TAXONOMY_CATEGORIES_QUERY,
      variables: {
        search: shopifyCategoryLookupValue,
        first: 10,
      },
      note: 'Only needed when the current page value is a taxonomy breadcrumb instead of a category GID.',
    };

    try {
      return JSON.stringify(preview, null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize GraphQL preview"\n}';
    }
  }, [approvalChannel, currentPageCategoryIdResolution.value, shopifyCategoryLookupValue, shopifyCategoryResolution.match]);

  const resolveShopifyCategoryId = async (): Promise<string | undefined> => {
    const explicitCategoryId = currentPageCategoryIdResolution.value.trim();
    if (explicitCategoryId) return explicitCategoryId;

    const lookupValue = shopifyCategoryLookupValue.trim();
    if (!lookupValue) return undefined;

    try {
      const match = shopifyCategoryResolution.match ?? await shopifyService.resolveTaxonomyCategory(lookupValue);
      if (match) {
        if (shopifyCategoryResolution.match?.id !== match.id) {
          setShopifyCategoryResolution({
            status: 'resolved',
            match,
            error: '',
          });
        }
        return match.id;
      }

      setShopifyCategoryResolution({
        status: 'unresolved',
        match: null,
        error: '',
      });
      pushInlineActionNotice('warning', 'Shopify category not resolved', `Could not resolve a Shopify taxonomy category from "${lookupValue}". Continuing without category assignment.`);
      return undefined;
    } catch (categoryError) {
      setShopifyCategoryResolution({
        status: 'error',
        match: null,
        error: categoryError instanceof Error ? categoryError.message : 'Unable to resolve Shopify taxonomy category.',
      });
      pushInlineActionNotice('warning', 'Shopify category resolution failed', `${describeShopifyCreateError(categoryError)} Continuing without category assignment.`);
      return undefined;
    }
  };

  const upsertShopifyProductWithCollectionFallback = async (params: {
    product: ShopifyProduct;
    categoryId?: string;
    collectionIds?: string[];
    existingProductId?: number;
  }) => {
    const { product, categoryId, collectionIds = [], existingProductId } = params;
    const normalizedCollectionIds = Array.from(new Set(
      collectionIds
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ));

    pushInlineActionNotice(
      'info',
      'Collections payload debug',
      normalizedCollectionIds.length > 0 ? normalizedCollectionIds.join(', ') : '(none)',
    );

    const unifiedRequest = buildShopifyUnifiedProductSetRequest(product, {
      categoryId: categoryId ?? undefined,
      collectionIds: normalizedCollectionIds,
      existingProductId,
    });

    const ensureCollectionsApplied = async (productId: number) => {
      if (!Number.isFinite(productId) || productId <= 0 || normalizedCollectionIds.length === 0) return;
      await shopifyService.addProductToCollections(productId, normalizedCollectionIds);
    };

    try {
      if (existingProductId && normalizedCollectionIds.length > 0) {
        const combinedResult = await shopifyService.upsertExistingProductWithCollectionsInSingleMutation(
          unifiedRequest,
          normalizedCollectionIds,
        );

        if (combinedResult.collectionFailures.length > 0) {
          const detail = `Collection assignment failed for ${combinedResult.collectionFailures.length} collection(s): ${combinedResult.collectionFailures.join(' | ')}`;
          const explanation = describeCollectionJoinFailure(detail);
          pushInlineActionNotice('warning', 'Some collections were not applied', explanation);
        }

        return combinedResult.product;
      }

      const upserted = await shopifyService.upsertProductWithUnifiedRequest(unifiedRequest);
      try {
        await ensureCollectionsApplied(upserted.id);
      } catch (collectionApplyError) {
        const detail = describeShopifyCreateError(collectionApplyError);
        const explanation = describeCollectionJoinFailure(detail);
        pushInlineActionNotice('warning', 'Some collections were not applied', explanation);
      }
      return upserted;
    } catch (error) {
      if (normalizedCollectionIds.length === 0) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      const isCollectionError = errorMessage.includes('collection')
        || errorMessage.includes('collectionstojoin')
        || errorMessage.includes('collection id');

      if (!isCollectionError) {
        throw error;
      }

      const retryWithoutCollections = buildShopifyUnifiedProductSetRequest(product, {
        categoryId: categoryId ?? undefined,
        existingProductId,
      });

      const retried = await shopifyService.upsertProductWithUnifiedRequest(retryWithoutCollections);
      try {
        await ensureCollectionsApplied(retried.id);
      } catch (collectionApplyError) {
        const detail = describeShopifyCreateError(collectionApplyError);
        const explanation = describeCollectionJoinFailure(detail);
        pushInlineActionNotice('warning', 'Collections were partially skipped', explanation);
      }
      return retried;
    }
  };

  const ebayDraftPayloadBundle = useMemo(() => {
    if (approvalChannel !== 'ebay' || !mergedDraftSourceFields) return null;
    return buildEbayDraftPayloadBundleFromApprovalFields(mergedDraftSourceFields);
  }, [approvalChannel, mergedDraftSourceFields]);

  const ebayDraftPayloadBundleJson = useMemo(() => {
    if (!ebayDraftPayloadBundle) return '';
    try {
      return JSON.stringify(ebayDraftPayloadBundle, null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize payload"\n}';
    }
  }, [ebayDraftPayloadBundle]);

  const shopifyCreatePayloadDocsJson = useMemo(() => {
    if (approvalChannel !== 'shopify') return '{\n  "input": {}\n}';
    try {
      return JSON.stringify(SHOPIFY_UNIFIED_PRODUCT_SET_DOCS_EXAMPLE, null, 2);
    } catch {
      return '{\n  "input": {}\n}';
    }
  }, [approvalChannel]);

  const ebayPayloadDocsJson = useMemo(() => {
    if (approvalChannel !== 'ebay') return '{\n  "inventoryItem": {},\n  "offer": {}\n}';
    try {
      return JSON.stringify(EBAY_DRAFT_PAYLOAD_DOCS_EXAMPLE, null, 2);
    } catch {
      return '{\n  "inventoryItem": {},\n  "offer": {}\n}';
    }
  }, [approvalChannel]);

  const approvedFieldName = useMemo(() => {
    const match = allFieldNames.find((fieldName) => fieldName.toLowerCase() === 'approved');
    return match ?? 'approved';
  }, [allFieldNames]);

  const resolveFieldName = useMemo(
    () => (candidates: string[], fallback: string) => {
      const candidateSet = new Set(candidates.map((name) => name.toLowerCase()));
      const exact = allFieldNames.find((fieldName) => candidateSet.has(fieldName.toLowerCase()));
      return exact ?? fallback;
    },
    [allFieldNames],
  );

  const titleFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Item Title', 'Shopify Title', 'Shopify REST Title', 'Title', 'Name'], 'Item Title')
      : resolveFieldName([...EBAY_TITLE_FIELD_CANDIDATES], 'Item Title'),
    [approvalChannel, resolveFieldName],
  );

  const formatFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Listing Format', 'Status', 'Shopify Status', 'Shopify REST Status'], 'Listing Format')
      : resolveFieldName([...EBAY_FORMAT_FIELD_CANDIDATES], 'Listing Format'),
    [approvalChannel, resolveFieldName],
  );

  const priceFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'Price'], '')
      : resolveFieldName([...EBAY_PRICE_FIELD_CANDIDATES], ''),
    [approvalChannel, resolveFieldName],
  );

  const vendorFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Vendor', 'Shopify Vendor', 'Vendor', 'Manufacturer', 'Brand'], '')
      : resolveFieldName([...EBAY_VENDOR_FIELD_CANDIDATES], ''),
    [approvalChannel, resolveFieldName],
  );

  const qtyFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Variant 1 Inventory Quantity', 'Shopify Variant 1 Inventory Quantity', 'Quantity', 'Qty'], '')
      : resolveFieldName([...EBAY_QTY_FIELD_CANDIDATES], ''),
    [approvalChannel, resolveFieldName],
  );

  const shopifyRequiredFieldNames = useMemo(() => {
    if (approvalChannel !== 'shopify') return [] as string[];

    const required = [
      resolveFieldName([...SHOPIFY_TITLE_FIELD_CANDIDATES], ''),
      resolveFieldName([...SHOPIFY_PRICE_FIELD_CANDIDATES], ''),
      resolveFieldName([...SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES], ''),
    ].filter((fieldName): fieldName is string => fieldName.trim().length > 0);

    return Array.from(new Set(required));
  }, [approvalChannel, resolveFieldName]);

  const missingShopifyRequiredFieldNames = useMemo(() => {
    if (approvalChannel !== 'shopify' || !selectedRecord) return [] as string[];

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    return shopifyRequiredFieldNames.filter((fieldName) => {
      const rawValue = source[fieldName];
      if (rawValue === null || rawValue === undefined) return true;

      const stringValue = String(rawValue).trim();
      if (!stringValue) return true;

      if (fieldName.toLowerCase().includes('price')) {
        const numericValue = Number(stringValue);
        return !Number.isFinite(numericValue) || numericValue <= 0;
      }

      return false;
    });
  }, [approvalChannel, mergedDraftSourceFields, selectedRecord, shopifyRequiredFieldNames]);

  const missingShopifyRequiredFieldLabels = useMemo(
    () => missingShopifyRequiredFieldNames.map((fieldName) => toApprovalFieldLabel(fieldName)),
    [missingShopifyRequiredFieldNames],
  );

  const hasMissingShopifyRequiredFields = missingShopifyRequiredFieldNames.length > 0;

  const ebayRequiredFieldNames = useMemo(() => {
    if (approvalChannel !== 'ebay') return [] as string[];

    const required = [
      resolveFieldName([...EBAY_TITLE_FIELD_CANDIDATES], ''),
      resolveFieldName([...EBAY_PRICE_FIELD_CANDIDATES], ''),
    ].filter((fieldName): fieldName is string => fieldName.trim().length > 0);

    return Array.from(new Set(required));
  }, [approvalChannel, resolveFieldName]);

  const missingEbayRequiredFieldNames = useMemo(() => {
    if (approvalChannel !== 'ebay' || !selectedRecord) return [] as string[];

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    return ebayRequiredFieldNames.filter((fieldName) => {
      const rawValue = source[fieldName];
      if (rawValue === null || rawValue === undefined) return true;

      const stringValue = String(rawValue).trim();
      if (!stringValue) return true;

      if (fieldName.toLowerCase().includes('price')) {
        const numericValue = Number(stringValue);
        return !Number.isFinite(numericValue) || numericValue <= 0;
      }

      return false;
    });
  }, [approvalChannel, mergedDraftSourceFields, selectedRecord, ebayRequiredFieldNames]);

  const currentEbayListingFormat = useMemo(() => {
    if (approvalChannel !== 'ebay' || !selectedRecord) return '';

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    const rawValue = source[formatFieldName];
    return rawValue === null || rawValue === undefined ? '' : String(rawValue);
  }, [approvalChannel, formatFieldName, mergedDraftSourceFields, selectedRecord]);

  const missingEbayRequiredFieldLabels = useMemo(
    () => missingEbayRequiredFieldNames.map((fieldName) => toApprovalFieldLabel(fieldName, { ebayListingFormat: currentEbayListingFormat })),
    [currentEbayListingFormat, missingEbayRequiredFieldNames],
  );

  const hasMissingEbayRequiredFields = missingEbayRequiredFieldNames.length > 0;

  function openRecord(record: AirtableRecord) {
    hydrateForm(record, allFieldNames, approvedFieldName);
    trackWorkflowEvent('approval_record_opened', {
      recordId: record.id,
      tableReference,
    });
    onSelectRecord(record.id);
  }

  const createNewShopifyListing = async () => {
    if (approvalChannel !== 'shopify') return;
    if (!tableReference.trim()) return;

    const defaultTitle = `New Shopify Listing ${new Date().toISOString().slice(0, 10)}`;
    const titleCandidates = Array.from(new Set([
      titleFieldName,
      ...SHOPIFY_TITLE_FIELD_CANDIDATES,
    ])).filter((fieldName) => fieldName.trim().length > 0);

    setCreatingShopifyListing(true);
    try {
      let createdRecord: AirtableRecord | null = null;
      let lastError: unknown = null;

      for (const titleField of titleCandidates) {
        try {
          createdRecord = await airtableService.createRecordFromReference(
            tableReference,
            tableName,
            {
              [titleField]: defaultTitle,
            },
            { typecast: true },
          );
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!createdRecord) {
        throw lastError ?? new Error('Unable to create a new Shopify listing row in Airtable.');
      }

      await loadRecords(tableReference, tableName);
      onSelectRecord(createdRecord.id);

      pushInlineActionNotice('success', 'New Shopify listing created', 'A new Airtable row is ready. Fill the required Shopify fields, save, then approve.');

    } catch (createError) {
      pushInlineActionNotice('error', 'Unable to create Shopify listing', describeShopifyCreateError(createError));
    } finally {
      setCreatingShopifyListing(false);
    }
  };

  const hasTableReference = tableReference.trim().length > 0;

  useEffect(() => {
    if (!hasTableReference) return;
    void loadRecords(tableReference, tableName);
    void loadListingFormatOptions();
  }, [hasTableReference, loadListingFormatOptions, loadRecords, tableName, tableReference]);

  useEffect(() => {
    if (!selectedRecord) return;
    hydrateForm(selectedRecord, allFieldNames, approvedFieldName);
  }, [selectedRecord?.id, records]);

  const approvedValue = selectedRecord?.fields[approvedFieldName];
  const isApproved = approvedValue === true
    || String(approvedValue ?? '').toLowerCase() === 'true'
    || String(approvedValue ?? '').toLowerCase() === 'yes';

  const changedFieldNames = useMemo(() => {
    if (!selectedRecord) return [] as string[];

    return Object.entries(formValues)
      .filter(([fieldName, currentValue]) => {
        if (fieldName === SHIPPING_SERVICE_FIELD) return false;
        if (fieldName === CONDITION_FIELD) return false;
        const normalizedFieldName = fieldName.trim().toLowerCase();
        if (normalizedFieldName === 'shopify rest product id' || normalizedFieldName === 'shopify product id') return false;
        if (approvalChannel === 'shopify' && isVendorFieldName(fieldName)) return false;
        if (approvalChannel === 'shopify' && isShopifyGraphqlCollectionIdsFieldName(fieldName)) return false;
        const originalValue = toFormValue(selectedRecord.fields[fieldName]);
        return currentValue !== originalValue;
      })
      .map(([fieldName]) => fieldName);
  }, [approvalChannel, formValues, selectedRecord]);

  const hasUnsavedChanges = changedFieldNames.length > 0;
  const hasExistingShopifyRestProductId = useMemo(() => {
    if (approvalChannel !== 'shopify') return false;

    const rawExistingProductId = formValues['Shopify REST Product ID']?.trim() ?? '';
    if (!rawExistingProductId) return false;

    const parsedExistingProductId = Number(rawExistingProductId);
    return Number.isFinite(parsedExistingProductId) && parsedExistingProductId > 0;
  }, [approvalChannel, formValues]);

  const canUpdateApprovedShopifyListing = approvalChannel === 'shopify'
    && isApproved
    && hasExistingShopifyRestProductId;

  const syncExistingShopifyListing = async (record: AirtableRecord, productId: number) => {
    const updatePayload = finalShopifyCreatePayload
      ?? normalizeShopifyProductForUpsert(
        buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? record.fields),
      );
    const categoryId = await resolveShopifyCategoryId();
    await upsertShopifyProductWithCollectionFallback({
      product: updatePayload,
      categoryId,
      collectionIds: currentPageCollectionIds,
      existingProductId: productId,
    });
  };

  if (selectedRecord) {
    return (
      <section className={panelSurfaceClass}>

        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <button
            type="button"
            className={secondaryActionButtonClass}
            onClick={onBackToList}
            disabled={saving}
          >
            Back to Listings
          </button>
          <div>
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Listing Update</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[1.08rem] font-semibold text-[var(--ink)]">{displayValue(selectedRecord.fields[titleFieldName])}</h3>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] ${
                isApproved
                  ? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-200'
                  : 'border border-amber-400/35 bg-amber-500/20 text-amber-200'
              }`}>
                {isApproved ? 'Approved' : 'Unapproved'}
              </span>
            </div>
            <p className="m-0 mt-1 text-sm text-[var(--muted)]">Record ID: <code>{selectedRecord.id}</code></p>
          </div>
        </div>

        {error && (
          <section className={`${errorSurfaceClass} mb-4`}>
            <p className="m-0 font-bold text-[var(--error-text)]">Save Error</p>
            <p className="mt-2 text-[var(--error-text)]/85">{error}</p>
          </section>
        )}

        <ApprovalFormFields
          recordId={selectedRecord.id}
          approvalChannel={approvalChannel}
          forceShowShopifyCollectionsEditor={approvalChannel === 'shopify'}
          allFieldNames={allFieldNames}
          writableFieldNames={Object.keys(selectedRecord.fields)}
          requiredFieldNames={approvalChannel === 'shopify' ? shopifyRequiredFieldNames : approvalChannel === 'ebay' ? ebayRequiredFieldNames : []}
          approvedFieldName={approvedFieldName}
          formValues={formValues}
          fieldKinds={fieldKinds}
          listingFormatOptions={listingFormatOptions}
          saving={saving}
          setFormValue={setFormValue}
          suppressImageScalarFields={approvalChannel === 'shopify' || approvalChannel === 'ebay'}
          originalFieldValues={Object.fromEntries(
            Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
          )}
          onBodyHtmlPreviewChange={setBodyHtmlPreview}
        />

        {hasUnsavedChanges && (
          <section className="mt-4 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2">
            <p className="m-0 text-sm font-semibold text-amber-200">
              Fields changed ({changedFieldNames.length}). Save page data before approving.
            </p>
            <p className="m-0 mt-1 text-xs text-amber-200/85">
              {changedFieldNames.join(', ')}
            </p>
          </section>
        )}

        {approvalChannel === 'shopify' && hasMissingShopifyRequiredFields && (
          <section className="mt-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2">
            <p className="m-0 text-sm font-semibold text-rose-200">
              Shopify required fields are missing ({missingShopifyRequiredFieldNames.length}).
            </p>
            <p className="m-0 mt-1 text-xs text-rose-200/85">
              Complete before approving: {missingShopifyRequiredFieldLabels.join(', ')}
            </p>
          </section>
        )}

        {approvalChannel === 'ebay' && hasMissingEbayRequiredFields && (
          <section className="mt-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2">
            <p className="m-0 text-sm font-semibold text-rose-200">
              eBay required fields are missing ({missingEbayRequiredFieldNames.length}).
            </p>
            <p className="m-0 mt-1 text-xs text-rose-200/85">
              Complete before approving: {missingEbayRequiredFieldLabels.join(', ')}
            </p>
          </section>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className={secondaryActionButtonClass}
            onClick={() => {
              if (!selectedRecord) return;
              const confirmed = window.confirm('Reset page fields to the current Airtable values?');
              if (!confirmed) return;
              hydrateForm(selectedRecord, allFieldNames, approvedFieldName);
              pushInlineActionNotice('info', 'Page data reset', 'Form values were restored to current Airtable values.');
            }}
            disabled={saving || !hasUnsavedChanges}
          >
            Reset data
          </button>
          <button
            type="button"
            className={primaryActionButtonClass}
            onClick={() => {
              const confirmed = window.confirm('Are you sure you want to save the listing details?');
              if (!confirmed) return;
              if (!selectedRecord) return;
              trackWorkflowEvent('approval_saved', {
                recordId: selectedRecord.id,
                tableReference,
              });

              const runSave = async () => {
                const saveSucceeded = await saveRecord(
                  false,
                  selectedRecord,
                  tableReference,
                  tableName,
                  actualFieldNames,
                  approvedFieldName,
                  () => undefined,
                  'full',
                );

                if (saveSucceeded) {
                  pushInlineActionNotice('success', 'Listing updated', 'Listing changes were saved to Airtable.');
                } else {
                  pushInlineActionNotice('error', 'Save failed', 'Could not save listing changes to Airtable. Review the error section and try again.');
                }
              };

              void runSave();
            }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Updates'}
          </button>
          <button
            type="button"
            className={accentActionButtonClass}
            onClick={() => {
              if (approving) return;

              if (canUpdateApprovedShopifyListing) {
                const confirmed = window.confirm('Are you sure you want to update this Shopify listing?');
                if (!confirmed) return;
                if (!selectedRecord) return;

                const runUpdate = async () => {
                  setApproving(true);
                  try {
                    const existingProductId = formValues['Shopify REST Product ID']?.trim();
                    const parsedExistingId = Number(existingProductId);
                    if (!Number.isFinite(parsedExistingId) || parsedExistingId <= 0) {
                      pushInlineActionNotice('error', 'Listing update failed', 'A valid Shopify REST Product ID is required to update an approved listing.');
                      return;
                    }

                    await syncExistingShopifyListing(selectedRecord, parsedExistingId);
                    pushInlineActionNotice('success', 'Shopify listing updated', `Listing #${existingProductId} was updated with the latest saved fields.`);
                  } catch (updateError) {
                    pushInlineActionNotice('error', 'Shopify listing update failed', describeShopifyCreateError(updateError));
                  } finally {
                    setApproving(false);
                  }
                };

                void runUpdate();
                return;
              }

              if (approvalChannel === 'shopify' && hasMissingShopifyRequiredFields) {
                pushInlineActionNotice('warning', 'Required Shopify fields missing', `Complete required fields before approving: ${missingShopifyRequiredFieldLabels.join(', ')}`);
                return;
              }

              if (approvalChannel === 'ebay' && hasMissingEbayRequiredFields) {
                pushInlineActionNotice('warning', 'Required eBay fields missing', `Complete required fields before approving: ${missingEbayRequiredFieldLabels.join(', ')}`);
                return;
              }

              const confirmed = window.confirm('Are you sure you want to approve this listing for publishing?');
              if (!confirmed) return;
              if (!selectedRecord) return;

              const SHOPIFY_PRODUCT_ID_FIELD = 'Shopify REST Product ID';

              const runApproval = async () => {
                setApproving(true);
                try {
                  if (createShopifyDraftOnApprove) {
                    const existingProductId = formValues[SHOPIFY_PRODUCT_ID_FIELD]?.trim();
                    const createPayload = finalShopifyCreatePayload
                      ?? normalizeShopifyProductForUpsert(
                        buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? selectedRecord.fields),
                      );
                    let shouldCreateDraft = true;

                    if (existingProductId) {
                      const parsedExistingId = Number(existingProductId);

                      if (Number.isFinite(parsedExistingId) && parsedExistingId > 0) {
                        const existingProduct = await shopifyService.getProduct(parsedExistingId);
                        if (existingProduct) {
                          try {
                            await syncExistingShopifyListing(selectedRecord, parsedExistingId);
                            pushInlineActionNotice('success', 'Shopify draft updated', `Draft product #${existingProductId} was updated with the latest listing fields before approval.`);
                          } catch (updateError) {
                            pushInlineActionNotice('error', 'Shopify draft update failed', describeShopifyCreateError(updateError));
                            return;
                          }
                          pushInlineActionNotice('info', 'Shopify draft already exists', `Product #${existingProductId} already existed, so it was updated instead of creating a duplicate draft.`);
                          shouldCreateDraft = false;
                        } else {
                          setFormValue(SHOPIFY_PRODUCT_ID_FIELD, '');
                          pushInlineActionNotice('warning', 'Cleared stale Shopify product ID', `Saved product ID #${existingProductId} was not found in Shopify. Creating a new draft now.`);
                        }
                      } else {
                        setFormValue(SHOPIFY_PRODUCT_ID_FIELD, '');
                      }
                    }

                    if (shouldCreateDraft) {
                      try {
                        const categoryId = await resolveShopifyCategoryId();
                        const createdProduct = await upsertShopifyProductWithCollectionFallback({
                          product: createPayload,
                          categoryId,
                          collectionIds: currentPageCollectionIds,
                        });
                        const productIdStr = String(createdProduct.id);
                        const productIdNum = Number(createdProduct.id);

                        // Write product ID back to Airtable before marking approved so
                        // re-approving this record skips duplicate draft creation.
                        const writebackAttempts: Array<Record<string, string | number>> = Number.isFinite(productIdNum)
                          ? [
                              { [SHOPIFY_PRODUCT_ID_FIELD]: productIdNum },
                              { [SHOPIFY_PRODUCT_ID_FIELD]: productIdStr },
                            ]
                          : [{ [SHOPIFY_PRODUCT_ID_FIELD]: productIdStr }];

                        let writebackError: unknown = null;
                        for (const fields of writebackAttempts) {
                          try {
                            await airtableService.updateRecordFromReference(
                              tableReference,
                              tableName,
                              selectedRecord.id,
                              fields,
                            );
                            writebackError = null;
                            break;
                          } catch (error) {
                            writebackError = error;
                          }
                        }

                        if (writebackError) {
                          pushInlineActionNotice('warning', 'Draft created, ID writeback failed', 'Shopify draft was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.');
                        } else {
                          setFormValue(SHOPIFY_PRODUCT_ID_FIELD, productIdStr);
                        }

                        trackWorkflowEvent('shopify_draft_created_from_approval', {
                          recordId: selectedRecord.id,
                          productId: createdProduct.id,
                        });
                        pushInlineActionNotice('success', 'Shopify draft created', `Draft product #${productIdStr} was created before approval completion.`);
                      } catch (draftError) {
                        trackWorkflowEvent('shopify_draft_create_failed_from_approval', {
                          recordId: selectedRecord.id,
                        });
                        pushInlineActionNotice('error', 'Shopify draft creation failed', describeShopifyCreateError(draftError));
                        return;
                      }
                    }
                  }

                  trackWorkflowEvent('approval_approved', {
                    recordId: selectedRecord.id,
                    tableReference,
                  });
                  const approveSucceeded = await saveRecord(
                    true,
                    selectedRecord,
                    tableReference,
                    tableName,
                    actualFieldNames,
                    approvedFieldName,
                    onBackToList,
                    'approve-only',
                  );

                  if (!approveSucceeded) {
                    pushInlineActionNotice('error', 'Approval failed', 'Could not mark this listing as approved in Airtable.');
                  }
                } finally {
                  setApproving(false);
                }
              };

              void runApproval();
            }}
            disabled={
              saving
              || approving
              || hasUnsavedChanges
              || (!canUpdateApprovedShopifyListing && isApproved)
              || (approvalChannel === 'shopify' && hasMissingShopifyRequiredFields)
              || (approvalChannel === 'ebay' && hasMissingEbayRequiredFields)
            }
          >
            {approving
              ? (canUpdateApprovedShopifyListing ? 'Updating...' : 'Approving...')
              : hasUnsavedChanges
                ? (canUpdateApprovedShopifyListing ? 'Save Updates Before Updating' : 'Save Updates Before Approving')
              : canUpdateApprovedShopifyListing
                ? 'Update Listing'
                : isApproved
                ? 'Already Approved'
                : approvalChannel === 'shopify' && hasMissingShopifyRequiredFields
                  ? 'Complete Required Shopify Fields'
                  : approvalChannel === 'ebay' && hasMissingEbayRequiredFields
                    ? 'Complete Required eBay Fields'
                    : (hasExistingShopifyRestProductId ? 'Update Listing' : 'Approve Listing')}
          </button>
        </div>

        {inlineActionNotices.length > 0 && (
          <div className="mt-3 space-y-2">
            {inlineActionNotices.map((notice) => (
              <section
                key={notice.id}
                className={`rounded-lg border px-3 py-2 ${
                  notice.tone === 'success'
                    ? 'border-emerald-400/35 bg-emerald-500/10'
                    : notice.tone === 'warning'
                      ? 'border-amber-400/35 bg-amber-500/10'
                      : notice.tone === 'error'
                        ? 'border-rose-400/35 bg-rose-500/10'
                        : 'border-sky-400/35 bg-sky-500/10'
                }`}
              >
                <p
                  className={`m-0 text-sm font-semibold ${
                    notice.tone === 'success'
                      ? 'text-emerald-200'
                      : notice.tone === 'warning'
                        ? 'text-amber-200'
                        : notice.tone === 'error'
                          ? 'text-rose-200'
                          : 'text-sky-200'
                  }`}
                >
                  {notice.title}
                </p>
                <p
                  className={`m-0 mt-1 text-xs ${
                    notice.tone === 'success'
                      ? 'text-emerald-200/90'
                      : notice.tone === 'warning'
                        ? 'text-amber-200/90'
                        : notice.tone === 'error'
                          ? 'text-rose-200/90'
                          : 'text-sky-200/90'
                  }`}
                >
                  {notice.message}
                </p>
              </section>
            ))}
          </div>
        )}

        {bodyHtmlPreview && (
          <div className="mt-6 space-y-3">
            <BodyHtmlPreview
              value={bodyHtmlPreview}
              helperText={approvalChannel === 'ebay' ? 'Generated from the current Description and Key Features values. eBay saves the combined HTML into the listing payload.' : undefined}
              emptyStateText={approvalChannel === 'ebay' ? 'Add a description or feature/value pairs to preview the Body HTML saved for the eBay listing.' : undefined}
            />
          </div>
        )}

        {approvalChannel === 'shopify' && createShopifyDraftOnApprove && (
          <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
              Shopify API Requests (Exact Send Path)
            </summary>
            <div className="border-t border-[var(--line)] px-3 py-3">
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                This is the exact GraphQL request envelope used when you click Approve: one <code>productSet</code> mutation plus an optional taxonomy lookup query when the page still has a breadcrumb instead of a category GID.
              </p>
              <div className="mb-2 rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-2 text-xs text-amber-200/90">
                <p className="m-0 font-semibold text-amber-200">Description Source Debug</p>
                <p className="m-0 mt-1">Field: <code>{currentPageProductDescriptionResolution.sourceFieldName || '(none)'}</code></p>
                <p className="m-0 mt-1">Match: <code>{currentPageProductDescriptionResolution.sourceType}</code></p>
                <p className="m-0 mt-1">Resolved Length: <code>{String(currentPageProductDescription.length)}</code></p>
              </div>
              <div className="mb-2 rounded-md border border-sky-400/35 bg-sky-500/10 px-2 py-2 text-xs text-sky-100/90">
                <p className="m-0 font-semibold text-sky-100">Category Sync Debug</p>
                <p className="m-0 mt-1">Category Field: <code>{currentPageProductCategoryResolution.sourceFieldName || '(none)'}</code></p>
                <p className="m-0 mt-1">Category Match: <code>{currentPageProductCategoryResolution.sourceType}</code></p>
                <p className="m-0 mt-1">Category ID Field: <code>{currentPageCategoryIdResolution.sourceFieldName || '(none)'}</code></p>
                <p className="m-0 mt-1">Lookup Value: <code>{shopifyCategoryLookupValue || '(none)'}</code></p>
                <p className="m-0 mt-1">Resolution Status: <code>{shopifyCategoryResolution.status}</code></p>
                <p className="m-0 mt-1">Resolved Category ID: <code>{currentPageCategoryIdResolution.value || shopifyCategoryResolution.match?.id || '(unresolved)'}</code></p>
                <p className="m-0 mt-1">Resolved Category Name: <code>{shopifyCategoryResolution.match?.fullName || shopifyCategoryResolution.error || '(unresolved)'}</code></p>
              </div>
              <div className="mb-2 rounded-md border border-rose-400/35 bg-rose-500/10 px-2 py-2 text-xs text-rose-100/90">
                <p className="m-0 font-semibold text-rose-100">Inventory Quantity Note</p>
                <p className="m-0 mt-1">This unified GraphQL path does not include <code>inventory_quantity</code> because Shopify requires a location ID for inventory quantities and the current token cannot read locations.</p>
              </div>
              <div className="mb-2 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2 py-2 text-xs text-emerald-100/90">
                <p className="m-0 font-semibold text-emerald-100">Payload Field Debug</p>
                <p className="m-0 mt-1">Tags: <code>{shopifyPayloadDebug.tags.length > 0 ? shopifyPayloadDebug.tags.join(', ') : '(none)'}</code></p>
                <p className="m-0 mt-1">Collections: <code>{shopifyPayloadDebug.collectionsToJoin.length > 0 ? shopifyPayloadDebug.collectionsToJoin.join(', ') : '(none)'}</code></p>
              </div>
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">GraphQL <code>productSet</code> request</p>
              <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyDraftCreatePayloadJson || '{\n  "query": "",\n  "variables": {\n    "input": {}\n  }\n}'}</pre>
              {shopifyCategorySyncPreviewJson && (
                <>
                  <p className="m-0 mb-2 mt-3 text-xs text-[var(--muted)]">Optional taxonomy lookup query</p>
                  <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyCategorySyncPreviewJson}</pre>
                </>
              )}
            </div>
          </details>
        )}

        {approvalChannel === 'shopify' && (
          <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
              Shopify GraphQL Request Structure (Docs Example)
            </summary>
            <div className="border-t border-[var(--line)] px-3 py-3">
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                Reference example showing the full GraphQL request envelope sent to Shopify.
              </p>
              <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyCreatePayloadDocsJson}</pre>
            </div>
          </details>
        )}

        {approvalChannel === 'ebay' && (
          <>
            <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                eBay API Draft Payload (Exact Request)
              </summary>
              <div className="border-t border-[var(--line)] px-3 py-3">
                <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                  Live payload preview for eBay Inventory Item and Offer requests using the current page values.
                </p>
                <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{ebayDraftPayloadBundleJson || '{\n  "inventoryItem": {},\n  "offer": {}\n}'}</pre>
              </div>
            </details>

            <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                eBay API Request Structure (Docs Example)
              </summary>
              <div className="border-t border-[var(--line)] px-3 py-3">
                <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                  Reference example for typical Sell Inventory API inventory item and offer request bodies.
                </p>
                <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{ebayPayloadDocsJson}</pre>
              </div>
            </details>
          </>
        )}
      </section>
    );
  }

  return (
    <>
      {!hasTableReference && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Listing approval source is not configured</p>
          <p className="mt-2 text-[var(--error-text)]/85">
            Set the Airtable table reference env variable for this page and refresh.
          </p>
        </section>
      )}

      {error && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Error loading approval workflow</p>
          <p className="mt-2 text-[var(--error-text)]/85">{error}</p>
        </section>
      )}

      {hasTableReference && loading ? (
        <section className={loadingSurfaceClass}>
          <div className={spinnerClass} />
          <p>Loading listing approval queue...</p>
        </section>
      ) : hasTableReference ? (
        <section className={panelSurfaceClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow</p>
              <h3 className="m-0 mt-1 text-[1.08rem] font-semibold text-[var(--ink)]">Listing Update & Approval</h3>
              <p className="m-0 mt-1 text-sm text-[var(--muted)]">
                Source: <code>{tableReference}</code>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {approvalChannel === 'shopify' && (
                <button
                  type="button"
                  className={accentActionButtonClass}
                  onClick={() => {
                    void createNewShopifyListing();
                  }}
                  disabled={loading || saving || creatingShopifyListing}
                >
                  {creatingShopifyListing ? 'Creating Listing...' : 'New Shopify Listing'}
                </button>
              )}
              <button
                type="button"
                className={primaryActionButtonClass}
                onClick={() => {
                  trackWorkflowEvent('approval_queue_refreshed', {
                    tableReference,
                  });
                  void loadRecords(tableReference, tableName);
                }}
              >
                Refresh Queue
              </button>
            </div>
          </div>

          <p className="m-0 mb-4 text-sm text-[var(--muted)]">
            <strong>{records.length}</strong> listing rows loaded.
          </p>

          <ApprovalQueueTable
            records={records}
            approvedFieldName={approvedFieldName}
            requiredFieldNames={approvalChannel === 'shopify' ? shopifyRequiredFieldNames : approvalChannel === 'ebay' ? ebayRequiredFieldNames : []}
            titleFieldName={titleFieldName}
            conditionFieldName=''
            formatFieldName={approvalChannel === 'ebay' ? '' : formatFieldName}
            priceFieldName={approvalChannel === 'shopify' ? '' : priceFieldName}
            vendorFieldName={vendorFieldName}
            qtyFieldName={approvalChannel === 'ebay' ? '' : qtyFieldName}
            openRecord={openRecord}
            onSelectRecord={onSelectRecord}
          />
        </section>
      ) : null}
    </>
  );
}
