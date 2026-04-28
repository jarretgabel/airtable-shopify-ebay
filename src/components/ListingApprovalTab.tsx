import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import { KeyFeaturesEditor } from '@/components/approval/KeyFeaturesEditor';
import { TestingNotesEditor } from '@/components/approval/TestingNotesEditor';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import { upsertShopifyProductWithCollectionFallback as runShopifyCollectionFallbackUpsert } from '@/components/approval/shopifyPublish';
import { getMissingRequiredFieldNames, isMissingRequiredFieldValue } from '@/components/approval/requiredFieldStatus';
import {
  createRecordFromResolvedSource,
  getRecordFromResolvedSource,
  updateRecordFromResolvedSource,
} from '@/services/app-api/airtable';
import { pushApprovalBundleToEbay } from '@/services/ebay/approvalPublish';
import {
  addProductToCollections as addShopifyProductToCollections,
  getProduct as getShopifyProduct,
  resolveTaxonomyCategory as resolveShopifyTaxonomyCategory,
  upsertExistingProductWithCollectionsInSingleMutation as upsertShopifyExistingProductWithCollections,
  upsertProductWithUnifiedRequest as upsertShopifyProduct,
} from '@/services/app-api/shopify';
import {
  buildShopifyUnifiedProductSetRequest,
  normalizeShopifyProductForUpsert,
  type ShopifyTaxonomyCategoryMatch,
  type ShopifyUnifiedProductSetRequest,
} from '@/services/shopify';
import { buildEbayDraftPayloadBundleFromApprovalFields } from '@/services/ebayDraftFromAirtable';
import {
  buildShopifyCollectionIdsFromApprovalFields,
  buildShopifyDraftProductFromApprovalFields,
} from '@/services/shopifyDraftFromAirtable';
import { parseKeyFeatureEntries } from '@/services/shopifyBodyHtml';
import { buildEbayBodyHtmlFromTemplate } from '@/services/ebayBodyHtml';
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
import ebayListingInsertTemplate from '@/templates/ebay/ebay-listing-insert.html?raw';
import ebayListingImpactSlateTemplate from '@/templates/ebay/ebay-listing-impact-slate.html?raw';
import ebayListingImpactLuxeTemplate from '@/templates/ebay/ebay-listing-impact-luxe.html?raw';

interface ListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
  tableReference?: string;
  tableName?: string;
  createShopifyDraftOnApprove?: boolean;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
}

interface ShopifyCategoryResolutionState {
  status: 'idle' | 'resolving' | 'resolved' | 'unresolved' | 'error';
  match: ShopifyTaxonomyCategoryMatch | null;
  error: string;
}

interface ShopifyApprovalNotice {
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

async function resolveShopifyCategoryIdWithFeedback(
  explicitCategoryId: string | undefined,
  lookupValue: string | undefined,
  dependencies: {
    currentState: ShopifyCategoryResolutionState;
    describeError: (error: unknown) => string;
    pushNotice?: (tone: 'warning', title: string, message: string) => void;
    resolveCategory: (nextLookupValue: string) => Promise<ShopifyTaxonomyCategoryMatch | null>;
    setState: (nextState: ShopifyCategoryResolutionState) => void;
  },
): Promise<string | undefined> {
  const normalizedExplicitCategoryId = explicitCategoryId?.trim() || '';
  if (normalizedExplicitCategoryId) return normalizedExplicitCategoryId;

  const normalizedLookupValue = lookupValue?.trim() || '';
  if (!normalizedLookupValue) return undefined;

  const { currentState, describeError, pushNotice, resolveCategory, setState } = dependencies;

  try {
    const match = currentState.match ?? await resolveCategory(normalizedLookupValue);
    if (match) {
      if (currentState.match?.id !== match.id) {
        setState({
          status: 'resolved',
          match,
          error: '',
        });
      }
      return match.id;
    }

    setState({
      status: 'unresolved',
      match: null,
      error: '',
    });
    pushNotice?.('warning', 'Shopify category not resolved', `Could not resolve a Shopify taxonomy category from "${normalizedLookupValue}". Continuing without category assignment.`);
    return undefined;
  } catch (error) {
    setState({
      status: 'error',
      match: null,
      error: error instanceof Error ? error.message : 'Unable to resolve Shopify taxonomy category.',
    });
    pushNotice?.('warning', 'Shopify category resolution failed', `${describeError(error)} Continuing without category assignment.`);
    return undefined;
  }
}

async function createNewShopifyListingRecord(params: {
  defaultTitle: string;
  tableReference: string;
  tableName?: string;
  titleCandidates: string[];
}, dependencies: {
  createRecord: (
    nextTableReference: string,
    nextTableName: string | undefined,
    fields: Record<string, string>,
    options: { typecast: boolean },
  ) => Promise<AirtableRecord>;
}): Promise<AirtableRecord> {
  const { defaultTitle, tableReference, tableName, titleCandidates } = params;
  const { createRecord } = dependencies;

  const normalizedTitleCandidates = Array.from(new Set(
    titleCandidates
      .map((fieldName) => fieldName.trim())
      .filter((fieldName) => fieldName.length > 0),
  ));

  let createdRecord: AirtableRecord | null = null;
  let lastError: unknown = null;

  for (const titleField of normalizedTitleCandidates) {
    try {
      createdRecord = await createRecord(
        tableReference,
        tableName,
        { [titleField]: defaultTitle },
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

  return createdRecord;
}

function buildShopifyProductIdWritebackAttempts(
  fieldName: string,
  productId: number | string,
): Array<Record<string, string | number>> {
  const productIdStr = String(productId);
  const productIdNum = Number(productId);

  return Number.isFinite(productIdNum)
    ? [
        { [fieldName]: productIdNum },
        { [fieldName]: productIdStr },
      ]
    : [{ [fieldName]: productIdStr }];
}

async function writeShopifyProductIdToAirtable(
  params: {
    fieldName: string;
    productId: number | string;
    recordId: string;
    tableReference?: string;
    tableName?: string;
  },
  dependencies: {
    updateRecord: (
      nextTableReference: string | undefined,
      nextTableName: string | undefined,
      recordId: string,
      fields: Record<string, string | number>,
    ) => Promise<unknown>;
  },
): Promise<{ productId: string; wrote: boolean; lastError: unknown | null }> {
  const { fieldName, productId, recordId, tableReference, tableName } = params;
  const { updateRecord } = dependencies;

  const productIdStr = String(productId);
  const writebackAttempts = buildShopifyProductIdWritebackAttempts(fieldName, productId);

  let lastError: unknown | null = null;

  for (const fields of writebackAttempts) {
    try {
      await updateRecord(tableReference, tableName, recordId, fields);
      return {
        productId: productIdStr,
        wrote: true,
        lastError: null,
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    productId: productIdStr,
    wrote: false,
    lastError,
  };
}

async function updateApprovedShopifyListing(
  params: {
    existingProductId: string;
    record: AirtableRecord;
  },
  dependencies: {
    syncExistingShopifyListing: (record: AirtableRecord, productId: number) => Promise<void>;
    describeError: (error: unknown) => string;
  },
): Promise<ShopifyApprovalNotice> {
  const { existingProductId, record } = params;
  const { describeError, syncExistingShopifyListing } = dependencies;

  const normalizedProductId = existingProductId.trim();
  const parsedExistingId = Number(normalizedProductId);

  if (!Number.isFinite(parsedExistingId) || parsedExistingId <= 0) {
    return {
      tone: 'error',
      title: 'Listing update failed',
      message: 'A valid Shopify REST Product ID is required to update an approved listing.',
    };
  }

  try {
    await syncExistingShopifyListing(record, parsedExistingId);
    return {
      tone: 'success',
      title: 'Shopify listing updated',
      message: `Listing #${normalizedProductId} was updated with the latest saved fields.`,
    };
  } catch (error) {
    return {
      tone: 'error',
      title: 'Shopify listing update failed',
      message: describeError(error),
    };
  }
}

async function ensureShopifyDraftBeforeApproval(
  params: {
    existingProductId: string;
    productIdFieldName: string;
    createPayload: ShopifyProduct;
    record: AirtableRecord;
    collectionIds: string[];
    tableReference?: string;
    tableName?: string;
  },
  dependencies: {
    getShopifyProduct: (productId: number) => Promise<unknown>;
    syncExistingShopifyListing: (record: AirtableRecord, productId: number) => Promise<void>;
    describeError: (error: unknown) => string;
    resolveShopifyCategoryId: () => Promise<string | undefined>;
    upsertShopifyProductWithCollectionFallback: (params: {
      product: ShopifyProduct;
      categoryId?: string;
      collectionIds?: string[];
      existingProductId?: number;
    }) => Promise<{ id: number }>;
    writeShopifyProductIdToAirtable: (params: {
      fieldName: string;
      productId: number | string;
      recordId: string;
      tableReference?: string;
      tableName?: string;
    }) => Promise<{ productId: string; wrote: boolean; lastError: unknown | null }>;
  },
): Promise<{
  notices: ShopifyApprovalNotice[];
  nextProductIdFieldValue?: string;
  createdProductId?: number;
  status: 'existing-updated' | 'created' | 'update-failed' | 'creation-failed';
}> {
  const {
    collectionIds,
    createPayload,
    existingProductId,
    productIdFieldName,
    record,
    tableName,
    tableReference,
  } = params;
  const {
    describeError,
    getShopifyProduct,
    resolveShopifyCategoryId,
    syncExistingShopifyListing,
    upsertShopifyProductWithCollectionFallback,
    writeShopifyProductIdToAirtable,
  } = dependencies;

  const normalizedExistingProductId = existingProductId.trim();
  let nextProductIdFieldValue: string | undefined;

  if (normalizedExistingProductId) {
    const parsedExistingId = Number(normalizedExistingProductId);

    if (Number.isFinite(parsedExistingId) && parsedExistingId > 0) {
      const existingProduct = await getShopifyProduct(parsedExistingId);

      if (existingProduct) {
        try {
          await syncExistingShopifyListing(record, parsedExistingId);
          return {
            status: 'existing-updated',
            notices: [
              {
                tone: 'success',
                title: 'Shopify draft updated',
                message: `Draft product #${normalizedExistingProductId} was updated with the latest listing fields before approval.`,
              },
              {
                tone: 'info',
                title: 'Shopify draft already exists',
                message: `Product #${normalizedExistingProductId} already existed, so it was updated instead of creating a duplicate draft.`,
              },
            ],
          };
        } catch (error) {
          return {
            status: 'update-failed',
            notices: [{
              tone: 'error',
              title: 'Shopify draft update failed',
              message: describeError(error),
            }],
          };
        }
      }

      nextProductIdFieldValue = '';
      const categoryId = await resolveShopifyCategoryId();
      try {
        const createdProduct = await upsertShopifyProductWithCollectionFallback({
          product: createPayload,
          categoryId,
          collectionIds,
        });
        const writebackResult = await writeShopifyProductIdToAirtable({
          fieldName: productIdFieldName,
          productId: createdProduct.id,
          recordId: record.id,
          tableReference,
          tableName,
        });

        return {
          status: 'created',
          createdProductId: createdProduct.id,
          nextProductIdFieldValue: writebackResult.wrote ? writebackResult.productId : '',
          notices: [
            {
              tone: 'warning',
              title: 'Cleared stale Shopify product ID',
              message: `Saved product ID #${normalizedExistingProductId} was not found in Shopify. Creating a new draft now.`,
            },
            ...(writebackResult.wrote ? [] : [{
              tone: 'warning' as const,
              title: 'Draft created, ID writeback failed',
              message: 'Shopify draft was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.',
            }]),
            {
              tone: 'success',
              title: 'Shopify draft created',
              message: `Draft product #${writebackResult.productId} was created before approval completion.`,
            },
          ],
        };
      } catch (error) {
        return {
          status: 'creation-failed',
          nextProductIdFieldValue,
          notices: [
            {
              tone: 'warning',
              title: 'Cleared stale Shopify product ID',
              message: `Saved product ID #${normalizedExistingProductId} was not found in Shopify. Creating a new draft now.`,
            },
            {
              tone: 'error',
              title: 'Shopify draft creation failed',
              message: describeError(error),
            },
          ],
        };
      }
    }

    nextProductIdFieldValue = '';
  }

  const categoryId = await resolveShopifyCategoryId();

  try {
    const createdProduct = await upsertShopifyProductWithCollectionFallback({
      product: createPayload,
      categoryId,
      collectionIds,
    });
    const writebackResult = await writeShopifyProductIdToAirtable({
      fieldName: productIdFieldName,
      productId: createdProduct.id,
      recordId: record.id,
      tableReference,
      tableName,
    });

    return {
      status: 'created',
      createdProductId: createdProduct.id,
      nextProductIdFieldValue: writebackResult.wrote ? writebackResult.productId : nextProductIdFieldValue ?? '',
      notices: [
        ...(writebackResult.wrote ? [] : [{
          tone: 'warning' as const,
          title: 'Draft created, ID writeback failed',
          message: 'Shopify draft was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.',
        }]),
        {
          tone: 'success',
          title: 'Shopify draft created',
          message: `Draft product #${writebackResult.productId} was created before approval completion.`,
        },
      ],
    };
  } catch (error) {
    return {
      status: 'creation-failed',
      nextProductIdFieldValue,
      notices: [{
        tone: 'error',
        title: 'Shopify draft creation failed',
        message: describeError(error),
      }],
    };
  }
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

const CONDITION_FIELD_CANDIDATES = [
  '__Condition__',
  'Condition',
  'Item Condition',
  'condition',
  'item_condition',
] as const;

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
  'Shopify Body (HTML)',
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
  'Buy It Now/Starting Price',
  'Buy It Now / Starting Price',
  'Buy It Now/Starting Bid',
  'eBay Offer Price Value',
  'eBay Offer Auction Start Price Value',
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

const EBAY_DURATION_FIELD_CANDIDATES = [
  'eBay Listing Duration',
  'Listing Duration',
] as const;

const EBAY_DOMESTIC_SHIPPING_FEES_FIELD_CANDIDATES = [
  'eBay Domestic Shipping Fees',
  'Domestic Shipping Fees',
  'ebay_domestic_shipping_fees',
  'domestic_shipping_fees',
] as const;

const EBAY_INTERNATIONAL_SHIPPING_FEES_FIELD_CANDIDATES = [
  'eBay International Shipping Fees',
  'International Shipping Fees',
  'ebay_international_shipping_fees',
  'international_shipping_fees',
] as const;

const EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD_CANDIDATES = [
  'eBay Domestic Shipping Flat Fee',
  'Domestic Shipping Flat Fee',
  'eBay Domestic Shipping Flat Fee USD',
  'Domestic Shipping Flat Fee USD',
] as const;

const EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD_CANDIDATES = [
  'eBay International Shipping Flat Fee',
  'International Shipping Flat Fee',
  'eBay International Shipping Flat Fee USD',
  'International Shipping Flat Fee USD',
] as const;

const EBAY_PRIMARY_CATEGORY_FIELD_CANDIDATES = [
  'eBay Offer Primary Category ID',
  'eBay Offer PrimaryCategoryID',
  'ebay_offer_primary_category_id',
  'ebay_offer_primarycategoryid',
  'eBay Offer Category ID',
  'ebay_offer_category_id',
  'Primary Category ID',
  'primary_category_id',
  'Primary Category',
  'primary_category',
] as const;

const EBAY_SECONDARY_CATEGORY_FIELD_CANDIDATES = [
  'eBay Offer Secondary Category ID',
  'ebay_offer_secondary_category_id',
  'Secondary Category',
  'secondary_category',
] as const;

const EBAY_PRIMARY_CATEGORY_NAME_FIELD_CANDIDATES = [
  'Primary Category Name',
  'primary_category_name',
  'eBay Offer Primary Category Name',
  'ebay_offer_primary_category_name',
] as const;

const EBAY_SECONDARY_CATEGORY_NAME_FIELD_CANDIDATES = [
  'Secondary Category Name',
  'secondary_category_name',
  'eBay Offer Secondary Category Name',
  'ebay_offer_secondary_category_name',
] as const;

const EBAY_CATEGORIES_FIELD_CANDIDATES = [
  'categories',
  'Categories',
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
  'eBay Body (HTML)',
  'ebay_body_html',
] as const;

const EBAY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES = [
  'eBay Body HTML Template',
  'eBay Listing Template',
  'eBay Template',
  'Body HTML Template',
  'Listing Template',
  'ebay_body_html_template',
  'ebay_listing_template',
] as const;

type EbayListingTemplateId = 'classic' | 'impact-slate' | 'impact-luxe';

const EBAY_LISTING_TEMPLATE_OPTIONS: ReadonlyArray<{ id: EbayListingTemplateId; label: string }> = [
  { id: 'classic', label: 'Classic Heritage' },
  { id: 'impact-slate', label: 'Impact Slate' },
  { id: 'impact-luxe', label: 'Impact Luxe' },
] as const;

const EBAY_LISTING_TEMPLATE_HTML_BY_ID: Record<EbayListingTemplateId, string> = {
  classic: ebayListingInsertTemplate,
  'impact-slate': ebayListingImpactSlateTemplate,
  'impact-luxe': ebayListingImpactLuxeTemplate,
};

const EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES = [
  'Key Features (Key, Value)',
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

const EBAY_TESTING_NOTES_FIELD_CANDIDATES = [
  'Testing Notes',
  'Testing Notes JSON',
  'eBay Testing Notes',
  'eBay Testing Notes JSON',
  'eBay Body Testing Notes',
  'eBay Body Testing Notes JSON',
  'eBay Listing Testing Notes',
  'eBay Listing Testing Notes JSON',
  'testing_notes',
  'testing_notes_json',
  'ebay_testing_notes',
  'ebay_testing_notes_json',
  'ebay_body_testing_notes',
  'ebay_body_testing_notes_json',
  'ebay_listing_testing_notes',
  'ebay_listing_testing_notes_json',
] as const;

const EBAY_ATTRIBUTES_FIELD_CANDIDATES = [
  'eBay Inventory Product Aspects JSON',
  'eBay Inventory Product Aspects',
  'eBay Inventory Aspects',
  'eBay Product Aspects',
  'eBay Aspects',
  'ebay_inventory_product_aspects_json',
  'ebay_inventory_product_aspects',
  'ebay_inventory_aspects',
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

function normalizeFieldLookupKey(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isTitleLikeFieldName(fieldName: string): boolean {
  return fieldName.trim().toLowerCase().includes('title');
}

function isPriceLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('price')
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price';
}

function isShopifyCategoryLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'type'
    || normalized === 'shopify type'
    || normalized === 'product type'
    || normalized === 'shopify product type'
    || normalized === 'shopify rest product type'
    || normalized === 'shopify category'
    || normalized === 'shopify product category'
    || normalized === 'shopify rest product category'
    || normalized === 'category'
    || normalized === 'product category';
}

function fieldMatchesRequiredGroup(fieldName: string, requiredFieldName: string): boolean {
  const normalizedField = fieldName.toLowerCase();
  const normalizedRequiredField = requiredFieldName.toLowerCase();

  if (normalizedField === normalizedRequiredField) return true;
  if (isTitleLikeFieldName(fieldName) && isTitleLikeFieldName(requiredFieldName)) return true;
  if (isPriceLikeFieldName(fieldName) && isPriceLikeFieldName(requiredFieldName)) return true;
  if (isShopifyCategoryLikeFieldName(fieldName) && isShopifyCategoryLikeFieldName(requiredFieldName)) return true;

  return false;
}

function getRequiredFieldGroupKey(fieldName: string): string {
  if (isTitleLikeFieldName(fieldName)) return 'title';
  if (isPriceLikeFieldName(fieldName)) return 'price';
  if (isShopifyCategoryLikeFieldName(fieldName)) return 'shopify-category';
  return normalizeFieldLookupKey(fieldName);
}

function getDrawerRequiredStatus(
  fieldNames: string[],
  requiredFieldNames: string[],
  source: Record<string, unknown>,
): { hasRequired: boolean; allFilled: boolean } {
  if (fieldNames.length === 0 || requiredFieldNames.length === 0) {
    return { hasRequired: false, allFilled: false };
  }

  const matchedFieldNamesByGroup = new Map<string, string>();

  requiredFieldNames.forEach((requiredFieldName) => {
    const groupKey = getRequiredFieldGroupKey(requiredFieldName);
    if (matchedFieldNamesByGroup.has(groupKey)) return;

    const exactMatch = fieldNames.find((fieldName) => fieldName.toLowerCase() === requiredFieldName.toLowerCase());
    if (exactMatch && !isMissingRequiredFieldValue(exactMatch, source[exactMatch])) {
      matchedFieldNamesByGroup.set(groupKey, exactMatch);
      return;
    }

    const groupedMatches = fieldNames.filter((fieldName) => fieldMatchesRequiredGroup(fieldName, requiredFieldName));
    if (groupedMatches.length === 0) return;

    const firstFilledMatch = groupedMatches.find((fieldName) => !isMissingRequiredFieldValue(fieldName, source[fieldName]));
    matchedFieldNamesByGroup.set(groupKey, firstFilledMatch ?? exactMatch ?? groupedMatches[0]);
  });

  const matchedFieldNames = Array.from(matchedFieldNamesByGroup.values());

  if (matchedFieldNames.length === 0) {
    return { hasRequired: false, allFilled: false };
  }

  return {
    hasRequired: true,
    allFilled: getMissingRequiredFieldNames(source, matchedFieldNames).length === 0,
  };
}

function DrawerStatusIcon({ allFilled }: { allFilled: boolean }) {
  return (
    <span
      className={`inline-flex items-center ${allFilled ? 'text-emerald-200' : 'text-rose-200'}`}
      aria-label={allFilled ? 'All required fields filled' : 'Contains missing required fields'}
      title={allFilled ? 'All required fields filled' : 'Contains missing required fields'}
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        {allFilled ? (
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.78-9.97a.75.75 0 0 0-1.06-1.06L8.75 10.94 7.28 9.47a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z" clipRule="evenodd" />
        ) : (
          <path fillRule="evenodd" d="M10 2.5a1 1 0 0 1 .874.514l6.5 12A1 1 0 0 1 16.5 16.5h-13a1 1 0 0 1-.874-1.486l6.5-12A1 1 0 0 1 10 2.5Zm0 4a1 1 0 0 0-1 1V10a1 1 0 1 0 2 0V7.5a1 1 0 0 0-1-1Zm0 7a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clipRule="evenodd" />
        )}
      </svg>
    </span>
  );
}

function findEbayPriceFieldName(fieldNames: string[]): string {
  const exact = fieldNames.find((name) =>
    EBAY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
  );
  if (exact) return exact;

  const fuzzy = fieldNames.find((name) => {
    const normalized = normalizeFieldLookupKey(name);
    return normalized === 'ebayofferpricevalue'
      || normalized === 'ebayofferauctionstartpricevalue'
      || normalized.includes('buyitnowstartingbid')
      || normalized.includes('buyitnowstartingprice')
      || normalized.includes('startingbid')
      || normalized.includes('startingprice');
  });

  return fuzzy ?? '';
}

function findEbayBodyHtmlFieldName(fieldNames: string[]): string {
  const exact = fieldNames.find((name) =>
    EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
  );
  if (exact) return exact;

  const fuzzy = fieldNames.find((name) => {
    const normalized = normalizeFieldLookupKey(name);
    return normalized === 'bodyhtml'
      || normalized.includes('ebaybodyhtml')
      || normalized.includes('bodyhtml');
  });

  return fuzzy ?? '';
}

function isEbayBodyHtmlFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'ebay body html'
    || normalized === 'ebay_body_html';
}

function isEbayBodyHtmlTemplateFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay body html template'
    || normalized === 'ebay listing template'
    || normalized === 'ebay template'
    || normalized === 'body html template'
    || normalized === 'listing template'
    || normalized === 'ebay_body_html_template'
    || normalized === 'ebay_listing_template';
}

function normalizeEbayListingTemplateId(value: string): EbayListingTemplateId {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'classic';

  if (normalized === 'classic' || normalized.includes('insert') || normalized.includes('legacy') || normalized.includes('heritage')) {
    return 'classic';
  }

  if (normalized === 'impact-slate' || normalized === 'slate' || normalized.includes('impact slate')) {
    return 'impact-slate';
  }

  if (normalized === 'impact-luxe' || normalized === 'luxe' || normalized.includes('impact luxe')) {
    return 'impact-luxe';
  }

  return 'classic';
}

function resolveEbayListingTemplateHtml(templateId: EbayListingTemplateId): string {
  return EBAY_LISTING_TEMPLATE_HTML_BY_ID[templateId] ?? ebayListingInsertTemplate;
}

function isEbayBodyHtmlSyncTriggerFieldName(fieldName: string): boolean {
  const normalized = normalizeFieldLookupKey(fieldName);
  if (!normalized) return false;

  const titleAndDescriptionCandidates = [
    ...EBAY_TITLE_FIELD_CANDIDATES,
    ...EBAY_DESCRIPTION_FIELD_CANDIDATES,
  ];

  if (titleAndDescriptionCandidates.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  if (EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  if (EBAY_TESTING_NOTES_FIELD_CANDIDATES.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  return normalized.includes('keyfeature')
    || normalized.includes('featurevaluepair')
    || normalized.includes('keyvaluepair')
    || normalized.includes('featurepairs')
    || normalized.includes('keypairs')
    || normalized.includes('testingnotes');
}

function isEbayHandlingCostFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized.includes('handling cost')
    || compact.includes('handlingcost');
}

function isEbayGlobalShippingFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  return (normalized.includes('global') && normalized.includes('shipping'))
    || compact.includes('globalshipping')
    || compact.includes('globalshippingprogram');
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

function isShopifyOnlyFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'description') return false;
  if (normalized.includes('key feature')) return false;
  return normalized.includes('shopify')
    || normalized.includes('collection')
    || normalized.includes('published scope')
    || normalized.includes('published at')
    || normalized.includes('template suffix')
    || normalized.includes('metafield')
    || normalized === 'type'
    || normalized === 'product type';
}

function normalizeCombinedFieldName(fieldName: string): string {
  return fieldName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isItemZipCodeField(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'item zip code'
    || normalized === 'zip code'
    || normalized === 'postal code'
    || compact === 'itemzipcode'
    || compact === 'zipcode'
    || compact === 'itempostalcode'
    || compact === 'postalcode'
    || compact === 'locationzipcode'
    || compact === 'locationpostalcode'
    || compact === 'itempostal'
    || compact === 'locationpostal';
}

function isEbayAttributesFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'ebay inventory product aspects json'
    || normalized === 'ebay inventory product aspects'
    || normalized === 'ebay inventory aspects'
    || normalized === 'ebay product aspects'
    || normalized === 'ebay aspects'
    || compact === 'ebayinventoryproductaspectsjson'
    || compact === 'ebayinventoryproductaspects'
    || compact === 'ebayinventoryaspects'
    || compact === 'ebayproductaspects'
    || compact === 'ebayaspects';
}

function isEbayOnlyFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  if (normalized === 'description') return false;
  if (normalized.includes('key feature')) return false;
  if (fieldName === SHIPPING_SERVICE_FIELD) return true;
  return normalized.includes('ebay')
    || normalized.includes('buy it now')
    || normalized.includes('starting bid')
    || normalized.includes('listing duration')
    || normalized.includes('duration')
    || normalized.includes('listing format')
    || normalized.includes('format')
    || normalized === 'status'
    || normalized.includes('shipping service')
    || isItemZipCodeField(fieldName)
    || isEbayAttributesFieldName(fieldName)
    || normalized.includes('primary category')
    || normalized.includes('secondary category')
    || normalized.includes('merchant location')
    || normalized.includes('fulfillment policy')
    || normalized.includes('payment policy')
    || normalized.includes('return policy');
}

function isRemovedCombinedEbayPriceFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized === 'buy it now/starting bid'
    || normalized === 'buy it now / starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized === 'ebay buy it now/starting bid'
    || normalized === 'ebay buy it now / starting bid'
    || normalized === 'ebay buy it now/starting price'
    || normalized === 'ebay buy it now / starting price';
}

function isGenericSharedKeyFeaturesFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json';
}

function normalizeKeyFeatureLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function shouldMoveTestingEntryToSharedKeyFeatures(feature: string): boolean {
  const normalized = normalizeKeyFeatureLabel(feature);
  return normalized === 'brand' || normalized === 'cable size';
}

function shouldSerializeKeyFeatureFieldAsJson(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('json') || normalized.endsWith('_json');
}

function serializeKeyFeatureEntries(
  entries: Array<{ feature: string; value: string }>,
  fieldName: string,
): string {
  const normalizedEntries = entries
    .map((entry) => ({
      feature: entry.feature.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.feature.length > 0 && entry.value.length > 0);

  if (normalizedEntries.length === 0) return '';

  if (shouldSerializeKeyFeatureFieldAsJson(fieldName)) {
    return JSON.stringify(normalizedEntries);
  }

  const escapeCsvCell = (cell: string): string => {
    if (!/[",\n\r]/.test(cell)) return cell;
    return `"${cell.replace(/"/g, '""')}"`;
  };

  return normalizedEntries
    .map((entry) => `${escapeCsvCell(entry.feature)},${escapeCsvCell(entry.value)}`)
    .join('\n');
}

function isHiddenCombinedFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'images (comma separated) 2'
    || compact === 'imagescommaseparated2'
    || normalized === 'shopify approved'
    || normalized === 'ebay approved'
    || compact === 'shopifyapproved'
    || compact === 'ebayapproved'
    || normalized === 'primary category name'
    || normalized === 'secondary category name'
    || normalized === 'ebay offer primary category name'
    || normalized === 'ebay offer secondary category name';
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
  const isCombinedApproval = approvalChannel === 'combined';

  const {
    records,
    loading,
    saving,
    error,
    listingFormatOptions,
    listingDurationOptions,
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
  const [pushingTarget, setPushingTarget] = useState<'shopify' | 'ebay' | 'both' | null>(null);
  const [bodyHtmlPreview, setBodyHtmlPreview] = useState('');
  const [selectedEbayTemplateId, setSelectedEbayTemplateId] = useState<EbayListingTemplateId>('classic');
  const [inlineActionNotices, setInlineActionNotices] = useState<InlineActionNotice[]>([]);
  const [fadingInlineNoticeIds, setFadingInlineNoticeIds] = useState<string[]>([]);
  const inlineNoticeTimersRef = useRef<Record<string, { fade: number; remove: number }>>({});

  const clearInlineNoticeTimer = (id: string) => {
    const timers = inlineNoticeTimersRef.current[id];
    if (timers !== undefined) {
      window.clearTimeout(timers.fade);
      window.clearTimeout(timers.remove);
      delete inlineNoticeTimersRef.current[id];
    }
  };

  const clearAllInlineNoticeTimers = () => {
    Object.values(inlineNoticeTimersRef.current).forEach((timers) => {
      window.clearTimeout(timers.fade);
      window.clearTimeout(timers.remove);
    });
    inlineNoticeTimersRef.current = {};
  };

  const pushInlineActionNotice = (tone: InlineActionNoticeTone, title: string, message: string) => {
    const id = `inline-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setInlineActionNotices((current) => ([
      { id, tone, title, message },
      ...current,
    ].slice(0, 8)));

    clearInlineNoticeTimer(id);
    const fadeTimer = window.setTimeout(() => {
      setFadingInlineNoticeIds((current) => (current.includes(id) ? current : [...current, id]));
    }, 3700);

    const removeTimer = window.setTimeout(() => {
      setInlineActionNotices((current) => current.filter((notice) => notice.id !== id));
      setFadingInlineNoticeIds((current) => current.filter((noticeId) => noticeId !== id));
      clearInlineNoticeTimer(id);
    }, 4000);

    inlineNoticeTimersRef.current[id] = { fade: fadeTimer, remove: removeTimer };
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

    // Add condition field to all approval channels
    const existingNames = Array.from(names);
    const existingLower = new Set(existingNames.map((name) => name.toLowerCase()));
    const preferredConditionField = existingNames.find((name) =>
      CONDITION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
    ) ?? CONDITION_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
    if (preferredConditionField) {
      names.add(preferredConditionField);
    }

    if (approvalChannel === 'shopify' || approvalChannel === 'combined') {
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

    if (approvalChannel === 'ebay' || approvalChannel === 'combined') {
      const existingNames = Array.from(names);
      const existingLower = new Set(existingNames.map((name) => name.toLowerCase()));

      const preferredTitleField = existingNames.find((name) =>
        EBAY_TITLE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_TITLE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredTitleField) names.add(preferredTitleField);

      const preferredPriceField = findEbayPriceFieldName(existingNames)
        || EBAY_PRICE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredPriceField) names.add(preferredPriceField);

      const preferredImageField = existingNames.find((name) =>
        EBAY_IMAGE_LIST_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_IMAGE_LIST_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredImageField) names.add(preferredImageField);

      const preferredDescriptionField = existingNames.find((name) =>
        EBAY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DESCRIPTION_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDescriptionField) names.add(preferredDescriptionField);

      const preferredBodyHtmlField = findEbayBodyHtmlFieldName(existingNames);
      if (preferredBodyHtmlField) names.add(preferredBodyHtmlField);

      const preferredKeyFeaturesField = existingNames.find((name) =>
        EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? (existingLower.has('key features (key, value)') ? null : 'Key Features (Key, Value)');
      if (preferredKeyFeaturesField) names.add(preferredKeyFeaturesField);

      const preferredAttributesField = existingNames.find((name) =>
        EBAY_ATTRIBUTES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_ATTRIBUTES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredAttributesField) names.add(preferredAttributesField);

      const preferredFormatField = existingNames.find((name) =>
        EBAY_FORMAT_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_FORMAT_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredFormatField) names.add(preferredFormatField);

      const preferredDurationField = existingNames.find((name) =>
        EBAY_DURATION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DURATION_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDurationField) names.add(preferredDurationField);

      const preferredDomesticShippingFeesField = existingNames.find((name) =>
        EBAY_DOMESTIC_SHIPPING_FEES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DOMESTIC_SHIPPING_FEES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDomesticShippingFeesField) names.add(preferredDomesticShippingFeesField);

      const preferredInternationalShippingFeesField = existingNames.find((name) =>
        EBAY_INTERNATIONAL_SHIPPING_FEES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_INTERNATIONAL_SHIPPING_FEES_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredInternationalShippingFeesField) names.add(preferredInternationalShippingFeesField);

      const preferredDomesticShippingFlatFeeField = existingNames.find((name) =>
        EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredDomesticShippingFlatFeeField) names.add(preferredDomesticShippingFlatFeeField);

      const preferredInternationalShippingFlatFeeField = existingNames.find((name) =>
        EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredInternationalShippingFlatFeeField) names.add(preferredInternationalShippingFlatFeeField);

      const preferredPrimaryCategoryField = existingNames.find((name) =>
        EBAY_PRIMARY_CATEGORY_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredPrimaryCategoryField) names.add(preferredPrimaryCategoryField);

      const preferredSecondaryCategoryField = existingNames.find((name) =>
        EBAY_SECONDARY_CATEGORY_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredSecondaryCategoryField) names.add(preferredSecondaryCategoryField);

      const preferredPrimaryCategoryNameField = existingNames.find((name) =>
        EBAY_PRIMARY_CATEGORY_NAME_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_PRIMARY_CATEGORY_NAME_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredPrimaryCategoryNameField) names.add(preferredPrimaryCategoryNameField);

      const preferredSecondaryCategoryNameField = existingNames.find((name) =>
        EBAY_SECONDARY_CATEGORY_NAME_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_SECONDARY_CATEGORY_NAME_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));
      if (preferredSecondaryCategoryNameField) names.add(preferredSecondaryCategoryNameField);

      const preferredCategoriesField = existingNames.find((name) =>
        EBAY_CATEGORIES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      );
      if (preferredCategoriesField) names.add(preferredCategoriesField);

      const hasAnyCategoryField = Array.from(names).some((name) => {
        const normalized = name.trim().toLowerCase();
        return normalized === 'categories'
          || normalized === 'category ids'
          || normalized === 'category_ids'
          || normalized === 'ebay offer primary category id'
          || normalized === 'ebay_offer_primary_category_id'
          || normalized === 'ebay_offer_primarycategoryid'
          || normalized === 'ebay offer category id'
          || normalized === 'ebay_offer_category_id'
          || normalized === 'ebay_offer_categoryid'
          || normalized === 'primary category'
          || normalized === 'primary category id'
          || normalized === 'primary_category'
          || normalized === 'primary_category_id'
          || normalized === 'ebay offer secondary category id'
          || normalized === 'ebay_offer_secondary_category_id'
          || normalized === 'ebay_offer_secondarycategoryid'
          || normalized === 'secondary category'
          || normalized === 'secondary category id'
          || normalized === 'secondary_category'
          || normalized === 'secondary_category_id';
      });

      if (!hasAnyCategoryField) {
        // Airtable omits empty fields from record payloads, so expose a safe
        // category editor fallback without adding non-existent eBay alias fields.
        names.add('categories');
      }

      names.add(SHIPPING_SERVICE_FIELD);
    }

    names.add(CONDITION_FIELD);

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [actualFieldNames, approvalChannel]);

  const ebayBodyHtmlTemplateFieldName = useMemo(() => {
    if (approvalChannel !== 'ebay') return undefined;

    const exact = allFieldNames.find((fieldName) =>
      EBAY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    );
    if (exact) return exact;

    return allFieldNames.find((fieldName) => isEbayBodyHtmlTemplateFieldName(fieldName));
  }, [allFieldNames, approvalChannel]);

  useEffect(() => {
    if (approvalChannel !== 'ebay') return;

    const persistedTemplateValue = ebayBodyHtmlTemplateFieldName
      ? (formValues[ebayBodyHtmlTemplateFieldName] ?? '')
      : '';
    if (!persistedTemplateValue.trim()) return;

    const normalizedTemplateId = normalizeEbayListingTemplateId(persistedTemplateValue);
    setSelectedEbayTemplateId((current) => (current === normalizedTemplateId ? current : normalizedTemplateId));
  }, [approvalChannel, ebayBodyHtmlTemplateFieldName, formValues]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

  const selectedRecordFieldNames = useMemo(() => {
    const names = new Set<string>(allFieldNames);
    Object.keys(selectedRecord?.fields ?? {}).forEach((fieldName) => names.add(fieldName));
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [allFieldNames, selectedRecord]);

  const combinedDescriptionFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    const exact = selectedRecordFieldNames.find((fieldName) => fieldName.trim().toLowerCase() === 'description');
    if (exact) return exact;
    return selectedRecordFieldNames.find((fieldName) =>
      SHOPIFY_BODY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase())
      || EBAY_DESCRIPTION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    ) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedSharedKeyFeaturesFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    const exact = selectedRecordFieldNames.find((fieldName) => isGenericSharedKeyFeaturesFieldName(fieldName));
    if (exact) return exact;

    const shopifySpecific = selectedRecordFieldNames.find((fieldName) =>
      SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase())
      && !EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    );
    if (shopifySpecific) return shopifySpecific;

    return selectedRecordFieldNames.find((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      if (normalized.includes('ebay')) return false;
      return normalized.includes('key feature') || normalized === 'features' || normalized === 'features json';
    }) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedSharedKeyFeaturesSyncFieldNames = useMemo(() => {
    if (!isCombinedApproval || !combinedSharedKeyFeaturesFieldName) return [];

    return selectedRecordFieldNames.filter((fieldName) => {
      if (fieldName === combinedSharedKeyFeaturesFieldName) return false;

      const normalized = fieldName.trim().toLowerCase();
      if (normalized.includes('ebay')) return false;

      return SHOPIFY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)
        || normalized.includes('key feature')
        || normalized === 'features'
        || normalized === 'features json';
    });
  }, [combinedSharedKeyFeaturesFieldName, isCombinedApproval, selectedRecordFieldNames]);

  const combinedShopifyBodyHtmlFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    return selectedRecordFieldNames.find((fieldName) =>
      SHOPIFY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    ) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedEbayBodyHtmlFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    return findEbayBodyHtmlFieldName(selectedRecordFieldNames);
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedShopifyBodyHtmlValue = useMemo(
    () => (combinedShopifyBodyHtmlFieldName ? (formValues[combinedShopifyBodyHtmlFieldName] ?? '') : ''),
    [combinedShopifyBodyHtmlFieldName, formValues],
  );

  const combinedEbayBodyHtmlValue = useMemo(
    () => (combinedEbayBodyHtmlFieldName ? (formValues[combinedEbayBodyHtmlFieldName] ?? '') : ''),
    [combinedEbayBodyHtmlFieldName, formValues],
  );

  const combinedEbayTitleFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    return selectedRecordFieldNames.find((fieldName) =>
      EBAY_TITLE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    ) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedEbayTestingNotesFieldName = useMemo(() => {
    if (!isCombinedApproval) return '';
    const testingNotesField = selectedRecordFieldNames.find((fieldName) =>
      EBAY_TESTING_NOTES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    );
    if (testingNotesField) return testingNotesField;

    return selectedRecordFieldNames.find((fieldName) =>
      !isGenericSharedKeyFeaturesFieldName(fieldName)
      && EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === fieldName.toLowerCase()),
    ) ?? '';
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedEbayGeneratedBodyHtml = useMemo(() => {
    if (!isCombinedApproval) return '';

    const templateId = normalizeEbayListingTemplateId(selectedEbayTemplateId);
    const templateHtml = resolveEbayListingTemplateHtml(templateId);
    const titleValue = combinedEbayTitleFieldName ? (formValues[combinedEbayTitleFieldName] ?? '') : '';
    const descriptionValue = combinedDescriptionFieldName ? (formValues[combinedDescriptionFieldName] ?? '') : '';
    const keyFeaturesValue = combinedSharedKeyFeaturesFieldName ? (formValues[combinedSharedKeyFeaturesFieldName] ?? '') : '';
    const testingNotesValue = combinedEbayTestingNotesFieldName ? (formValues[combinedEbayTestingNotesFieldName] ?? '') : '';

    return buildEbayBodyHtmlFromTemplate(
      templateHtml,
      titleValue,
      descriptionValue,
      keyFeaturesValue,
      testingNotesValue,
    );
  }, [
    combinedDescriptionFieldName,
    combinedEbayTestingNotesFieldName,
    combinedSharedKeyFeaturesFieldName,
    combinedEbayTitleFieldName,
    formValues,
    isCombinedApproval,
    selectedEbayTemplateId,
  ]);

  useEffect(() => {
    if (!isCombinedApproval) return;
    if (!combinedSharedKeyFeaturesFieldName || !combinedEbayTestingNotesFieldName) return;

    const sharedEntries = parseKeyFeatureEntries(formValues[combinedSharedKeyFeaturesFieldName] ?? '');
    const ebayEntries = parseKeyFeatureEntries(formValues[combinedEbayTestingNotesFieldName] ?? '');
    const transferredEntries = ebayEntries.filter((entry) => shouldMoveTestingEntryToSharedKeyFeatures(entry.feature));

    if (transferredEntries.length === 0) return;

    const remainingEbayEntries = ebayEntries.filter((entry) => !shouldMoveTestingEntryToSharedKeyFeatures(entry.feature));
    const mergedSharedEntries = [...sharedEntries];

    for (const transferredEntry of transferredEntries) {
      const existingIndex = mergedSharedEntries.findIndex(
        (entry) => normalizeKeyFeatureLabel(entry.feature) === normalizeKeyFeatureLabel(transferredEntry.feature),
      );

      if (existingIndex === -1) {
        mergedSharedEntries.push(transferredEntry);
        continue;
      }

      mergedSharedEntries[existingIndex] = transferredEntry;
    }

    const nextSharedValue = serializeKeyFeatureEntries(mergedSharedEntries, combinedSharedKeyFeaturesFieldName);
  const nextEbayValue = serializeKeyFeatureEntries(remainingEbayEntries, combinedEbayTestingNotesFieldName);

    if ((formValues[combinedSharedKeyFeaturesFieldName] ?? '') !== nextSharedValue) {
      setFormValue(combinedSharedKeyFeaturesFieldName, nextSharedValue);
    }

    if ((formValues[combinedEbayTestingNotesFieldName] ?? '') !== nextEbayValue) {
      setFormValue(combinedEbayTestingNotesFieldName, nextEbayValue);
    }
  }, [
    combinedEbayTestingNotesFieldName,
    combinedSharedKeyFeaturesFieldName,
    formValues,
    isCombinedApproval,
    setFormValue,
  ]);

  useEffect(() => {
    if (!isCombinedApproval || !combinedEbayBodyHtmlFieldName) return;
    if (!combinedEbayGeneratedBodyHtml.trim()) return;

    const current = formValues[combinedEbayBodyHtmlFieldName] ?? '';
    if (current !== combinedEbayGeneratedBodyHtml) {
      setFormValue(combinedEbayBodyHtmlFieldName, combinedEbayGeneratedBodyHtml);
    }
  }, [
    combinedEbayBodyHtmlFieldName,
    combinedEbayGeneratedBodyHtml,
    formValues,
    isCombinedApproval,
    setFormValue,
  ]);

  const combinedShopifyOnlyFieldNames = useMemo(() => {
    if (!isCombinedApproval) return [] as string[];
    const normalizedShopifyPriceCandidates = new Set(SHOPIFY_PRICE_FIELD_CANDIDATES.map((candidate) => candidate.toLowerCase()));
    const shopifyPriceFields = selectedRecordFieldNames.filter((fieldName) =>
      normalizedShopifyPriceCandidates.has(fieldName.toLowerCase()),
    );

    const chosenShopifyPriceFieldName = (() => {
      if (shopifyPriceFields.length <= 1) return '';

      const firstWithValue = shopifyPriceFields.find((fieldName) => {
        const currentValue = formValues[fieldName];
        if (typeof currentValue === 'string' && currentValue.trim().length > 0) return true;

        const recordValue = selectedRecord?.fields[fieldName];
        return toFormValue(recordValue).trim().length > 0;
      });

      return firstWithValue ?? shopifyPriceFields[0] ?? '';
    })();

    return selectedRecordFieldNames.filter((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      if (isHiddenCombinedFieldName(fieldName)) return false;
      if (!isShopifyOnlyFieldName(fieldName) || isEbayOnlyFieldName(fieldName)) return false;
      if (chosenShopifyPriceFieldName && shopifyPriceFields.includes(fieldName) && fieldName !== chosenShopifyPriceFieldName) return false;
      if (normalized === 'product type') return false;
      if (SHOPIFY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      return true;
    });
  }, [formValues, isCombinedApproval, selectedRecord, selectedRecordFieldNames]);

  const combinedEbayOnlyFieldNames = useMemo(() => {
    if (!isCombinedApproval) return [] as string[];
    return selectedRecordFieldNames.filter((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      if (isRemovedCombinedEbayPriceFieldName(fieldName)) return false;
      if (isHiddenCombinedFieldName(fieldName)) return false;
      if (!isEbayOnlyFieldName(fieldName) || isShopifyOnlyFieldName(fieldName)) return false;
      if (normalized.includes('primary category') || normalized.includes('secondary category')) return false;
      if (EBAY_FORMAT_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_DURATION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      return true;
    });
  }, [isCombinedApproval, selectedRecordFieldNames]);

  const combinedSharedFieldNames = useMemo(() => {
    if (!isCombinedApproval) return allFieldNames;
    const shopifyOnlySet = new Set(combinedShopifyOnlyFieldNames.map((fieldName) => fieldName.toLowerCase()));
    const ebayOnlySet = new Set(combinedEbayOnlyFieldNames.map((fieldName) => fieldName.toLowerCase()));
    const conditionCandidateSet = new Set(CONDITION_FIELD_CANDIDATES.map((fieldName) => fieldName.toLowerCase()));
    return selectedRecordFieldNames.filter((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      if (isRemovedCombinedEbayPriceFieldName(fieldName)) return false;
      const isCombinedEbayPriceField = EBAY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)
        || normalized.includes('buy it now')
        || normalized.includes('starting bid')
        || normalized === 'ebay offer price value'
        || normalized === 'ebay offer auction start price value';
      if (isHiddenCombinedFieldName(fieldName)) return false;
      if (shopifyOnlySet.has(normalized) || ebayOnlySet.has(normalized)) return false;
      if (isItemZipCodeField(fieldName)) return false;
      if (isCombinedEbayPriceField) return false;
      if (EBAY_FORMAT_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_DURATION_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_CATEGORIES_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (normalized === 'template name') return false;
      if (combinedDescriptionFieldName && normalized === combinedDescriptionFieldName.toLowerCase()) return false;
      if (combinedSharedKeyFeaturesFieldName && normalized === combinedSharedKeyFeaturesFieldName.toLowerCase()) return false;
      if (SHOPIFY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      if (EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)) return false;
      // Exclude duplicate real condition fields (but keep the synthetic CONDITION_FIELD) to avoid duplicates
      if (conditionCandidateSet.has(normalized) && allFieldNames.includes(CONDITION_FIELD) && fieldName !== CONDITION_FIELD) return false;
      return true;
    });
  }, [allFieldNames, combinedDescriptionFieldName, combinedEbayOnlyFieldNames, combinedSharedKeyFeaturesFieldName, combinedShopifyOnlyFieldNames, isCombinedApproval, selectedRecordFieldNames]);

  useEffect(() => {
    clearAllInlineNoticeTimers();
    setInlineActionNotices([]);
    setFadingInlineNoticeIds([]);
  }, [selectedRecordId]);

  useEffect(() => () => {
    clearAllInlineNoticeTimers();
  }, []);

  const mergedDraftSourceFields = useMemo(() => {
    if (!selectedRecord) return null;

    const merged: Record<string, unknown> = {
      ...selectedRecord.fields,
    };

    Object.entries(formValues).forEach(([fieldName, rawValue]) => {
      const kind = fieldKinds[fieldName] ?? 'text';
      merged[fieldName] = fromFormValue(rawValue, kind);
    });

    Object.keys(merged).forEach((fieldName) => {
      if (isCombinedApproval && isRemovedCombinedEbayPriceFieldName(fieldName)) {
        delete merged[fieldName];
        return;
      }
      if (isEbayHandlingCostFieldName(fieldName)) {
        merged[fieldName] = 0;
      }
      if (isEbayGlobalShippingFieldName(fieldName)) {
        merged[fieldName] = true;
      }
    });

    return merged;
  }, [fieldKinds, formValues, isCombinedApproval, selectedRecord]);

  const isShopifyPayloadPreviewContext = approvalChannel === 'shopify' || approvalChannel === 'combined';
  const isEbayPayloadPreviewContext = approvalChannel === 'ebay' || approvalChannel === 'combined';

  const normalizedShopifyDraftProduct = useMemo(() => {
    if (!isShopifyPayloadPreviewContext || !mergedDraftSourceFields) return null;
    const draftProduct = buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields);
    return normalizeShopifyProductForUpsert(draftProduct);
  }, [isShopifyPayloadPreviewContext, mergedDraftSourceFields]);

  const currentPageDraftProduct = useMemo(() => {
    if (!isShopifyPayloadPreviewContext || !mergedDraftSourceFields) return null;
    return buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields);
  }, [isShopifyPayloadPreviewContext, mergedDraftSourceFields]);

  const currentPageBodyHtml = useMemo(
    () => currentPageDraftProduct?.body_html ?? '',
    [currentPageDraftProduct],
  );

  const currentPageBodyHtmlResolution = useMemo(() => {
    if (!isShopifyPayloadPreviewContext || !mergedDraftSourceFields) {
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
  }, [currentPageBodyHtml, isShopifyPayloadPreviewContext, mergedDraftSourceFields]);

  const currentPageResolvedBodyHtml = currentPageBodyHtmlResolution.value;

  const currentPageProductDescriptionResolution = useMemo(() => {
    if (!isShopifyPayloadPreviewContext || !mergedDraftSourceFields) {
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
  }, [isShopifyPayloadPreviewContext, mergedDraftSourceFields]);

  const currentPageProductDescription = currentPageProductDescriptionResolution.value;

  const currentPageProductCategoryResolution = useMemo(() => {
    if (!isShopifyPayloadPreviewContext || !mergedDraftSourceFields) {
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
  }, [isShopifyPayloadPreviewContext, mergedDraftSourceFields, currentPageDraftProduct]);

  const currentPageProductCategory = currentPageProductCategoryResolution.value;

  const currentPageCategoryIdResolution = useMemo(() => {
    if (!isShopifyPayloadPreviewContext || !mergedDraftSourceFields) {
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
  }, [isShopifyPayloadPreviewContext, mergedDraftSourceFields]);

  const shopifyCategoryLookupValue = currentPageCategoryIdResolution.value || currentPageProductCategory;

  useEffect(() => {
    if (!isShopifyPayloadPreviewContext) {
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
        const match = await resolveShopifyTaxonomyCategory(lookupValue);
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
  }, [isShopifyPayloadPreviewContext, shopifyCategoryLookupValue]);

  const finalShopifyCreatePayload = useMemo(() => {
    if (!isShopifyPayloadPreviewContext || !selectedRecord) return null;

    const baseProduct = normalizedShopifyDraftProduct
      ?? normalizeShopifyProductForUpsert(
        buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? selectedRecord.fields),
      );
    const baseProductRecord = (baseProduct as unknown as Record<string, unknown>) ?? {};
    const { body_html, ...baseProductWithoutBodyHtml } = baseProductRecord;

    return {
      ...baseProductWithoutBodyHtml,
      body_html: (
        currentPageResolvedBodyHtml
        || (typeof body_html === 'string' ? body_html : '')
      ),
      product_type: (
        trimShopifyProductType(currentPageProductCategory)
        || trimShopifyProductType(typeof baseProductWithoutBodyHtml.product_type === 'string' ? baseProductWithoutBodyHtml.product_type : '')
      ),
    } as ShopifyProduct;
  }, [
    isShopifyPayloadPreviewContext,
    selectedRecord,
    normalizedShopifyDraftProduct,
    mergedDraftSourceFields,
    currentPageProductCategory,
    currentPageResolvedBodyHtml,
  ]);

  const currentPageCollectionIds = useMemo(() => {
    if (!isShopifyPayloadPreviewContext || !selectedRecord) return [] as string[];
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
  }, [formValues, isShopifyPayloadPreviewContext, selectedRecord]);

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
    if (!isShopifyPayloadPreviewContext) return '';
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
  }, [currentPageCategoryIdResolution.value, isShopifyPayloadPreviewContext, shopifyCategoryLookupValue, shopifyCategoryResolution.match]);

  const resolveShopifyCategoryId = async (): Promise<string | undefined> => {
    return resolveShopifyCategoryIdWithFeedback(
      currentPageCategoryIdResolution.value,
      shopifyCategoryLookupValue,
      {
        currentState: shopifyCategoryResolution,
        describeError: describeShopifyCreateError,
        pushNotice: pushInlineActionNotice,
        resolveCategory: resolveShopifyTaxonomyCategory,
        setState: setShopifyCategoryResolution,
      },
    );
  };

  const upsertShopifyProductWithCollectionFallback = async (params: {
    product: ShopifyProduct;
    categoryId?: string;
    collectionIds?: string[];
    existingProductId?: number;
  }) => runShopifyCollectionFallbackUpsert(params, {
    addProductToCollections: addShopifyProductToCollections,
    buildRequest: buildShopifyUnifiedProductSetRequest,
    describeCollectionJoinFailure,
    describeError: describeShopifyCreateError,
    pushNotice: pushInlineActionNotice,
    upsertExistingProductWithCollections: upsertShopifyExistingProductWithCollections,
    upsertProduct: upsertShopifyProduct,
  });

  const ebayDraftPayloadBundle = useMemo(() => {
    if (!isEbayPayloadPreviewContext || !mergedDraftSourceFields) return null;
    return buildEbayDraftPayloadBundleFromApprovalFields(mergedDraftSourceFields);
  }, [isEbayPayloadPreviewContext, mergedDraftSourceFields]);

  const ebayDraftPayloadBundleJson = useMemo(() => {
    if (!ebayDraftPayloadBundle) return '';
    try {
      return JSON.stringify(ebayDraftPayloadBundle, null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize payload"\n}';
    }
  }, [ebayDraftPayloadBundle]);

  const shopifyCreatePayloadDocsJson = useMemo(() => {
    try {
      return JSON.stringify(SHOPIFY_UNIFIED_PRODUCT_SET_DOCS_EXAMPLE, null, 2);
    } catch {
      return '{\n  "input": {}\n}';
    }
  }, []);

  const ebayPayloadDocsJson = useMemo(() => {
    try {
      return JSON.stringify(EBAY_DRAFT_PAYLOAD_DOCS_EXAMPLE, null, 2);
    } catch {
      return '{\n  "inventoryItem": {},\n  "offer": {}\n}';
    }
  }, []);

  const approvedFieldName = useMemo(() => {
    const candidateNames = approvalChannel === 'shopify'
      ? ['Shopify Approved', 'Approved']
      : approvalChannel === 'ebay'
        ? ['Approved', 'eBay Approved', 'Shopify Approved']
        : ['Approved', 'Shopify Approved', 'eBay Approved'];

    const candidateSet = new Set(candidateNames.map((name) => name.toLowerCase()));
    const match = allFieldNames.find((fieldName) => candidateSet.has(fieldName.toLowerCase()));
    return match ?? candidateNames[0];
  }, [allFieldNames, approvalChannel]);

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
      : findEbayPriceFieldName(Object.keys(selectedRecord?.fields ?? {})),
    [approvalChannel, resolveFieldName, selectedRecord],
  );

  const ebayBodyHtmlSaveFieldName = useMemo(
    () => approvalChannel === 'ebay'
      ? findEbayBodyHtmlFieldName(Object.keys(selectedRecord?.fields ?? {}))
      : '',
    [approvalChannel, selectedRecord],
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
    const required = [
      resolveFieldName([...SHOPIFY_TITLE_FIELD_CANDIDATES], ''),
      resolveFieldName([...SHOPIFY_PRICE_FIELD_CANDIDATES], ''),
      resolveFieldName([...SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES], ''),
    ].filter((fieldName): fieldName is string => fieldName.trim().length > 0);

    return Array.from(new Set(required));
  }, [resolveFieldName]);

  const missingShopifyRequiredFieldNames = useMemo(() => {
    if ((approvalChannel !== 'shopify' && approvalChannel !== 'combined') || !selectedRecord) return [] as string[];

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    return getMissingRequiredFieldNames(source, shopifyRequiredFieldNames);
  }, [approvalChannel, mergedDraftSourceFields, selectedRecord, shopifyRequiredFieldNames]);

  const missingShopifyRequiredFieldLabels = useMemo(
    () => missingShopifyRequiredFieldNames.map((fieldName) => toApprovalFieldLabel(fieldName)),
    [missingShopifyRequiredFieldNames],
  );

  const hasMissingShopifyRequiredFields = missingShopifyRequiredFieldNames.length > 0;

  const ebayRequiredFieldNames = useMemo(() => {
    const required = [
      resolveFieldName([...EBAY_TITLE_FIELD_CANDIDATES], ''),
      resolveFieldName([...EBAY_PRICE_FIELD_CANDIDATES], ''),
    ].filter((fieldName): fieldName is string => fieldName.trim().length > 0);

    return Array.from(new Set(required));
  }, [resolveFieldName]);

  const missingEbayRequiredFieldNames = useMemo(() => {
    if ((approvalChannel !== 'ebay' && approvalChannel !== 'combined') || !selectedRecord) return [] as string[];

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    return getMissingRequiredFieldNames(source, ebayRequiredFieldNames);
  }, [approvalChannel, mergedDraftSourceFields, selectedRecord, ebayRequiredFieldNames]);

  const currentEbayListingFormat = useMemo(() => {
    if ((approvalChannel !== 'ebay' && approvalChannel !== 'combined') || !selectedRecord) return '';

    const source = mergedDraftSourceFields ?? selectedRecord.fields;
    const rawValue = source[formatFieldName];
    return rawValue === null || rawValue === undefined ? '' : String(rawValue);
  }, [approvalChannel, formatFieldName, mergedDraftSourceFields, selectedRecord]);

  const missingEbayRequiredFieldLabels = useMemo(
    () => missingEbayRequiredFieldNames.map((fieldName) => toApprovalFieldLabel(fieldName, { ebayListingFormat: currentEbayListingFormat })),
    [currentEbayListingFormat, missingEbayRequiredFieldNames],
  );

  const hasMissingEbayRequiredFields = missingEbayRequiredFieldNames.length > 0;
  const combinedRequiredFieldNames = useMemo(
    () => Array.from(new Set([...shopifyRequiredFieldNames, ...ebayRequiredFieldNames])),
    [ebayRequiredFieldNames, shopifyRequiredFieldNames],
  );
  const drawerSourceFields = useMemo(
    () => mergedDraftSourceFields ?? selectedRecord?.fields ?? {},
    [mergedDraftSourceFields, selectedRecord],
  );
  const sharedDrawerRequiredStatus = useMemo(
    () => getDrawerRequiredStatus(combinedSharedFieldNames, combinedRequiredFieldNames, drawerSourceFields),
    [combinedRequiredFieldNames, combinedSharedFieldNames, drawerSourceFields],
  );
  const shopifyDrawerRequiredStatus = useMemo(
    () => getDrawerRequiredStatus(combinedShopifyOnlyFieldNames, shopifyRequiredFieldNames, drawerSourceFields),
    [combinedShopifyOnlyFieldNames, drawerSourceFields, shopifyRequiredFieldNames],
  );
  const ebayDrawerRequiredStatus = useMemo(
    () => getDrawerRequiredStatus(combinedEbayOnlyFieldNames, ebayRequiredFieldNames, drawerSourceFields),
    [combinedEbayOnlyFieldNames, drawerSourceFields, ebayRequiredFieldNames],
  );
  const formRequiredFieldNames = approvalChannel === 'shopify'
    ? shopifyRequiredFieldNames
    : approvalChannel === 'ebay'
      ? ebayRequiredFieldNames
      : combinedRequiredFieldNames;
  const formShopifyRequiredFieldNames = approvalChannel === 'ebay' ? [] : shopifyRequiredFieldNames;
  const formEbayRequiredFieldNames = approvalChannel === 'shopify' ? [] : ebayRequiredFieldNames;

  function openRecord(record: AirtableRecord) {
    const hydrateFieldNames = Array.from(new Set([
      ...allFieldNames,
      ...Object.keys(record.fields),
    ])).sort((left, right) => left.localeCompare(right));
    hydrateForm(record, hydrateFieldNames, approvedFieldName);
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
      const createdRecord = await createNewShopifyListingRecord({
        defaultTitle,
        tableReference,
        tableName,
        titleCandidates,
      }, {
        createRecord: createRecordFromResolvedSource,
      });

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

    let cancelled = false;

    const hydrateFromBestAvailableRecord = async () => {
      try {
        const fullRecord = await getRecordFromResolvedSource(
          tableReference,
          tableName,
          selectedRecord.id,
        );

        if (cancelled) return;

        const mergedRecord: AirtableRecord = {
          ...selectedRecord,
          ...fullRecord,
          fields: {
            ...selectedRecord.fields,
            ...fullRecord.fields,
          },
        };

        const hydrateFieldNames = Array.from(new Set([
          ...allFieldNames,
          ...Object.keys(mergedRecord.fields),
        ])).sort((left, right) => left.localeCompare(right));

        hydrateForm(mergedRecord, hydrateFieldNames, approvedFieldName);
      } catch {
        if (cancelled) return;
        const hydrateFieldNames = Array.from(new Set([
          ...allFieldNames,
          ...Object.keys(selectedRecord.fields),
        ])).sort((left, right) => left.localeCompare(right));

        hydrateForm(selectedRecord, hydrateFieldNames, approvedFieldName);
      }
    };

    void hydrateFromBestAvailableRecord();

    return () => {
      cancelled = true;
    };
  }, [allFieldNames, approvedFieldName, hydrateForm, selectedRecord, tableName, tableReference]);

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
        if (approvalChannel === 'ebay' && isEbayBodyHtmlFieldName(fieldName)) return false;
        const normalizedFieldName = fieldName.trim().toLowerCase();
        if (normalizedFieldName === 'primary category name' || normalizedFieldName === 'secondary category name') return false;
        if (normalizedFieldName === 'shopify rest product id' || normalizedFieldName === 'shopify product id') return false;
        if (approvalChannel === 'shopify' && isVendorFieldName(fieldName)) return false;
        if (approvalChannel === 'shopify' && isShopifyGraphqlCollectionIdsFieldName(fieldName)) return false;
        const originalValue = toFormValue(selectedRecord.fields[fieldName]);
        return currentValue !== originalValue;
      })
      .map(([fieldName]) => fieldName);
  }, [approvalChannel, formValues, selectedRecord]);

  const shouldForceEbayBodyHtmlSave = useMemo(
    () => approvalChannel === 'ebay' && changedFieldNames.some((fieldName) => isEbayBodyHtmlSyncTriggerFieldName(fieldName)),
    [approvalChannel, changedFieldNames],
  );

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

  const pushShopifyDisabled = (approvalChannel !== 'combined' && approvalChannel !== 'shopify') || hasMissingShopifyRequiredFields;
  const pushEbayDisabled = (approvalChannel !== 'combined' && approvalChannel !== 'ebay') || hasMissingEbayRequiredFields;
  const pushBothDisabled = approvalChannel !== 'combined' || hasMissingShopifyRequiredFields || hasMissingEbayRequiredFields;

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

  const pushCurrentListingToShopify = async (record: AirtableRecord): Promise<{ productId: string; mode: 'created' | 'updated' }> => {
    const shopifyProductIdField = 'Shopify REST Product ID';
    const existingProductId = formValues[shopifyProductIdField]?.trim();
    const createPayload = finalShopifyCreatePayload
      ?? normalizeShopifyProductForUpsert(
        buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? record.fields),
      );

    if (existingProductId) {
      const parsedExistingId = Number(existingProductId);

      if (Number.isFinite(parsedExistingId) && parsedExistingId > 0) {
        const existingProduct = await getShopifyProduct(parsedExistingId);
        if (existingProduct) {
          await syncExistingShopifyListing(record, parsedExistingId);
          return { productId: existingProductId, mode: 'updated' };
        }

        setFormValue(shopifyProductIdField, '');
      }
    }

    const categoryId = await resolveShopifyCategoryId();
    const createdProduct = await upsertShopifyProductWithCollectionFallback({
      product: createPayload,
      categoryId,
      collectionIds: currentPageCollectionIds,
    });
    const writebackResult = await writeShopifyProductIdToAirtable({
      fieldName: shopifyProductIdField,
      productId: createdProduct.id,
      recordId: record.id,
      tableReference,
      tableName,
    }, {
      updateRecord: updateRecordFromResolvedSource,
    });

    if (!writebackResult.wrote) {
      pushInlineActionNotice('warning', 'Shopify publish succeeded, ID writeback failed', 'The Shopify listing was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.');
    } else {
      setFormValue(shopifyProductIdField, writebackResult.productId);
    }

    return { productId: writebackResult.productId, mode: 'created' };
  };

  const pushCurrentListingToEbay = async (): Promise<{ sku: string; offerId: string; listingId: string; mode: 'created' | 'updated' }> => {
    if (!ebayDraftPayloadBundle) {
      throw new Error('eBay payload preview is unavailable for this record.');
    }

    const result = await pushApprovalBundleToEbay(ebayDraftPayloadBundle);
    return {
      sku: result.sku,
      offerId: result.offerId,
      listingId: result.listingId,
      mode: result.wasExistingOffer ? 'updated' : 'created',
    };
  };

  const runCombinedPush = async (target: 'shopify' | 'ebay' | 'both') => {
    if (!selectedRecord) return;

    if (hasUnsavedChanges) {
      pushInlineActionNotice('warning', 'Save updates first', 'Save page data before publishing to Shopify or eBay.');
      return;
    }

    if ((target === 'shopify' || target === 'both') && hasMissingShopifyRequiredFields) {
      pushInlineActionNotice('warning', 'Required Shopify fields missing', `Complete required Shopify fields before publishing: ${missingShopifyRequiredFieldLabels.join(', ')}`);
      return;
    }

    if ((target === 'ebay' || target === 'both') && hasMissingEbayRequiredFields) {
      pushInlineActionNotice('warning', 'Required eBay fields missing', `Complete required eBay fields before publishing: ${missingEbayRequiredFieldLabels.join(', ')}`);
      return;
    }

    const confirmed = window.confirm(
      target === 'both'
        ? 'Publish this listing to both Shopify and eBay using the current page values?'
        : `Publish this listing to ${target === 'shopify' ? 'Shopify' : 'eBay'} using the current page values?`,
    );
    if (!confirmed) return;

    setPushingTarget(target);
    try {
      if (target === 'shopify' || target === 'both') {
        const shopifyResult = await pushCurrentListingToShopify(selectedRecord);
        pushInlineActionNotice(
          'success',
          shopifyResult.mode === 'updated' ? 'Shopify listing updated' : 'Shopify listing created',
          `Shopify product #${shopifyResult.productId} was ${shopifyResult.mode}.`,
        );
      }

      if (target === 'ebay' || target === 'both') {
        const ebayResult = await pushCurrentListingToEbay();
        pushInlineActionNotice(
          'success',
          ebayResult.mode === 'updated' ? 'eBay listing updated' : 'eBay listing published',
          `SKU ${ebayResult.sku} is live as listing ${ebayResult.listingId} via offer ${ebayResult.offerId}.`,
        );
      }
    } catch (pushError) {
      const message = pushError instanceof Error ? pushError.message : 'Unable to push this listing.';
      pushInlineActionNotice('error', 'Publish failed', message);
    } finally {
      setPushingTarget(null);
    }
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

        {isCombinedApproval ? (
          <div className="space-y-4">
            <details className="rounded-lg border border-[var(--line)] bg-white/5" open>
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                <span className="inline-flex items-center gap-2">
                  <span>Shared Fields</span>
                  {sharedDrawerRequiredStatus.hasRequired && <DrawerStatusIcon allFilled={sharedDrawerRequiredStatus.allFilled} />}
                </span>
              </summary>
              <div className="border-t border-[var(--line)] px-3 py-3 space-y-4">
                {combinedDescriptionFieldName && (
                  <label className="flex flex-col gap-2">
                    <span className="mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Description</span>
                    <textarea
                      className="min-h-[120px] w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70"
                      value={formValues[combinedDescriptionFieldName] ?? ''}
                      onChange={(event) => setFormValue(combinedDescriptionFieldName, event.target.value)}
                      disabled={saving}
                    />
                  </label>
                )}

                <ApprovalFormFields
                  recordId={selectedRecord.id}
                  approvalChannel="combined"
                  isCombinedApproval
                  allFieldNames={combinedSharedFieldNames}
                  writableFieldNames={Object.keys(selectedRecord.fields)}
                  requiredFieldNames={combinedRequiredFieldNames}
                  shopifyRequiredFieldNames={shopifyRequiredFieldNames}
                  ebayRequiredFieldNames={ebayRequiredFieldNames}
                  approvedFieldName={approvedFieldName}
                  formValues={formValues}
                  fieldKinds={fieldKinds}
                  listingFormatOptions={listingFormatOptions}
                  listingDurationOptions={listingDurationOptions}
                  saving={saving}
                  setFormValue={setFormValue}
                  suppressImageScalarFields
                  originalFieldValues={Object.fromEntries(
                    Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
                  )}
                />

                {combinedSharedKeyFeaturesFieldName && (
                  <KeyFeaturesEditor
                    keyFeaturesFieldName={combinedSharedKeyFeaturesFieldName}
                    keyFeaturesValue={formValues[combinedSharedKeyFeaturesFieldName] ?? ''}
                    setFormValue={setFormValue}
                    syncFieldNames={combinedSharedKeyFeaturesSyncFieldNames}
                    disabled={saving}
                  />
                )}

                {combinedEbayTestingNotesFieldName && (
                  <TestingNotesEditor
                    fieldName={combinedEbayTestingNotesFieldName}
                    value={formValues[combinedEbayTestingNotesFieldName] ?? ''}
                    setFormValue={setFormValue}
                    disabled={saving}
                    label="Testing Notes"
                  />
                )}

              </div>
            </details>

            <details className="rounded-lg border border-[var(--line)] bg-white/5" open>
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                <span className="inline-flex items-center gap-2">
                  <span>Shopify-Specific Fields</span>
                  {shopifyDrawerRequiredStatus.hasRequired && <DrawerStatusIcon allFilled={shopifyDrawerRequiredStatus.allFilled} />}
                </span>
              </summary>
              <div className="border-t border-[var(--line)] px-3 py-3">
                <ApprovalFormFields
                  recordId={selectedRecord.id}
                  approvalChannel="shopify"
                  forceShowShopifyCollectionsEditor
                  allFieldNames={combinedShopifyOnlyFieldNames}
                  writableFieldNames={Object.keys(selectedRecord.fields)}
                  requiredFieldNames={shopifyRequiredFieldNames}
                  shopifyRequiredFieldNames={shopifyRequiredFieldNames}
                  ebayRequiredFieldNames={[]}
                  approvedFieldName={approvedFieldName}
                  formValues={formValues}
                  fieldKinds={fieldKinds}
                  listingFormatOptions={listingFormatOptions}
                  listingDurationOptions={listingDurationOptions}
                  saving={saving}
                  setFormValue={setFormValue}
                  suppressImageScalarFields
                  originalFieldValues={Object.fromEntries(
                    Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
                  )}
                  selectedEbayTemplateId={selectedEbayTemplateId}
                  onEbayTemplateIdChange={setSelectedEbayTemplateId}
                />

                <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">Shopify Body (HTML)</summary>
                  <div className="border-t border-[var(--line)] px-3 py-3">
                    <p className="m-0 mb-2 text-xs text-[var(--muted)]">Read-only HTML from Airtable field.</p>
                    {!combinedShopifyBodyHtmlFieldName && (
                      <p className="m-0 mb-2 text-xs text-[var(--muted)]">No Shopify Body HTML field was found for this record.</p>
                    )}
                    <pre className="m-0 max-h-[260px] overflow-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{combinedShopifyBodyHtmlValue}</pre>
                  </div>
                </details>

                <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">Shopify Body Rendered</summary>
                  <div className="border-t border-[var(--line)] px-3 py-3">
                    <BodyHtmlPreview value={combinedShopifyBodyHtmlValue} previewOnly />
                  </div>
                </details>

                <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                    Shopify Create Listing API Payload (Exact Request)
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

                <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                    Shopify Create Listing API Payload (Docs Example)
                  </summary>
                  <div className="border-t border-[var(--line)] px-3 py-3">
                    <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                      Reference example showing the expected GraphQL request envelope sent to Shopify for create/update listing.
                    </p>
                    <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyCreatePayloadDocsJson}</pre>
                  </div>
                </details>
              </div>
            </details>

            <details className="rounded-lg border border-[var(--line)] bg-white/5" open>
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                <span className="inline-flex items-center gap-2">
                  <span>eBay-Specific Fields</span>
                  {ebayDrawerRequiredStatus.hasRequired && <DrawerStatusIcon allFilled={ebayDrawerRequiredStatus.allFilled} />}
                </span>
              </summary>
              <div className="border-t border-[var(--line)] px-3 py-3">
                <ApprovalFormFields
                  recordId={selectedRecord.id}
                  approvalChannel="ebay"
                  hideEbayAdvancedOptions
                  allFieldNames={combinedEbayOnlyFieldNames}
                  writableFieldNames={Object.keys(selectedRecord.fields)}
                  requiredFieldNames={ebayRequiredFieldNames}
                  shopifyRequiredFieldNames={[]}
                  ebayRequiredFieldNames={ebayRequiredFieldNames}
                  approvedFieldName={approvedFieldName}
                  formValues={formValues}
                  fieldKinds={fieldKinds}
                  listingFormatOptions={listingFormatOptions}
                  listingDurationOptions={listingDurationOptions}
                  saving={saving}
                  setFormValue={setFormValue}
                  suppressImageScalarFields
                  originalFieldValues={Object.fromEntries(
                    Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
                  )}
                  onBodyHtmlPreviewChange={setBodyHtmlPreview}
                  selectedEbayTemplateId={selectedEbayTemplateId}
                  onEbayTemplateIdChange={setSelectedEbayTemplateId}
                />

                <ApprovalFormFields
                  recordId={selectedRecord.id}
                  approvalChannel="ebay"
                  showOnlyEbayAdvancedOptions
                  allFieldNames={combinedEbayOnlyFieldNames}
                  writableFieldNames={Object.keys(selectedRecord.fields)}
                  requiredFieldNames={ebayRequiredFieldNames}
                  shopifyRequiredFieldNames={[]}
                  ebayRequiredFieldNames={ebayRequiredFieldNames}
                  approvedFieldName={approvedFieldName}
                  formValues={formValues}
                  fieldKinds={fieldKinds}
                  listingFormatOptions={listingFormatOptions}
                  listingDurationOptions={listingDurationOptions}
                  saving={saving}
                  setFormValue={setFormValue}
                  suppressImageScalarFields
                  originalFieldValues={Object.fromEntries(
                    Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
                  )}
                  onBodyHtmlPreviewChange={setBodyHtmlPreview}
                  selectedEbayTemplateId={selectedEbayTemplateId}
                  onEbayTemplateIdChange={setSelectedEbayTemplateId}
                />

                <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">eBay Body (HTML)</summary>
                  <div className="border-t border-[var(--line)] px-3 py-3">
                    <p className="m-0 mb-2 text-xs text-[var(--muted)]">Read-only HTML from Airtable field.</p>
                    {!combinedEbayBodyHtmlFieldName && (
                      <p className="m-0 mb-2 text-xs text-[var(--muted)]">No eBay Body HTML field was found for this record.</p>
                    )}
                    <pre className="m-0 max-h-[260px] overflow-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{combinedEbayBodyHtmlValue}</pre>
                  </div>
                </details>

                <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">eBay Body Rendered</summary>
                  <div className="border-t border-[var(--line)] px-3 py-3">
                    <BodyHtmlPreview
                      value={combinedEbayGeneratedBodyHtml || bodyHtmlPreview || combinedEbayBodyHtmlValue}
                      previewOnly
                      showTemplateSelector
                      templateOptions={EBAY_LISTING_TEMPLATE_OPTIONS}
                      selectedTemplateId={selectedEbayTemplateId}
                      onTemplateChange={(templateId) => setSelectedEbayTemplateId(normalizeEbayListingTemplateId(templateId))}
                    />
                  </div>
                </details>

                <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                    eBay Create Listing API Payload (Exact Request)
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
                    eBay Create Listing API Payload (Docs Example)
                  </summary>
                  <div className="border-t border-[var(--line)] px-3 py-3">
                    <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                      Reference example for typical Sell Inventory API inventory item and offer request bodies.
                    </p>
                    <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{ebayPayloadDocsJson}</pre>
                  </div>
                </details>
              </div>
            </details>
          </div>
        ) : (
          <ApprovalFormFields
            recordId={selectedRecord.id}
            approvalChannel={approvalChannel}
            isCombinedApproval={isCombinedApproval}
            forceShowShopifyCollectionsEditor={approvalChannel === 'shopify'}
            allFieldNames={allFieldNames}
            writableFieldNames={Object.keys(selectedRecord.fields)}
            requiredFieldNames={formRequiredFieldNames}
            shopifyRequiredFieldNames={formShopifyRequiredFieldNames}
            ebayRequiredFieldNames={formEbayRequiredFieldNames}
            approvedFieldName={approvedFieldName}
            formValues={formValues}
            fieldKinds={fieldKinds}
            listingFormatOptions={listingFormatOptions}
            listingDurationOptions={listingDurationOptions}
            saving={saving}
            setFormValue={setFormValue}
            suppressImageScalarFields={approvalChannel === 'shopify' || approvalChannel === 'ebay'}
            originalFieldValues={Object.fromEntries(
              Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
            )}
            onBodyHtmlPreviewChange={setBodyHtmlPreview}
            selectedEbayTemplateId={selectedEbayTemplateId}
            onEbayTemplateIdChange={setSelectedEbayTemplateId}
          />
        )}

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

        {(approvalChannel === 'shopify' || approvalChannel === 'combined') && hasMissingShopifyRequiredFields && (
          <section className="mt-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2">
            <p className="m-0 text-sm font-semibold text-rose-200">
              Shopify required fields are missing ({missingShopifyRequiredFieldNames.length}).
            </p>
            <p className="m-0 mt-1 text-xs text-rose-200/85">
              Complete before approving: {missingShopifyRequiredFieldLabels.join(', ')}
            </p>
          </section>
        )}

        {(approvalChannel === 'ebay' || approvalChannel === 'combined') && hasMissingEbayRequiredFields && (
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
              const hydrateFieldNames = Array.from(new Set([
                ...allFieldNames,
                ...Object.keys(selectedRecord.fields),
              ])).sort((left, right) => left.localeCompare(right));
              hydrateForm(selectedRecord, hydrateFieldNames, approvedFieldName);
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
                if (approvalChannel === 'ebay') {
                  const existingFieldLookup = new Map(
                    Object.keys(selectedRecord.fields).map((fieldName) => [fieldName.toLowerCase(), fieldName]),
                  );

                  const resolveExistingFieldName = (candidates: string[]): string | null => {
                    for (const candidate of candidates) {
                      const key = candidate.trim().toLowerCase();
                      if (!key) continue;
                      const existing = existingFieldLookup.get(key);
                      if (existing) return existing;
                    }
                    return null;
                  };

                  const trySaveEbayField = async (
                    candidates: string[],
                    rawValue: string,
                    options?: { typecast?: boolean; coerceNumber?: boolean },
                  ): Promise<string | null> => {
                    const uniqueCandidates = Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)));
                    if (uniqueCandidates.length === 0) return null;

                    const valuesToTry: Array<string | number> = [];
                    if (options?.coerceNumber) {
                      const cleaned = rawValue.replace(/\$/g, '').replace(/,/g, '').trim();
                      const parsed = Number(cleaned);
                      if (Number.isFinite(parsed)) {
                        valuesToTry.push(parsed, parsed.toFixed(2));
                      }
                      valuesToTry.push(cleaned || rawValue);
                    }
                    valuesToTry.push(rawValue);

                    const dedupedValues = Array.from(new Set(valuesToTry.map((value) => String(value)))).map((value) => {
                      const parsed = Number(value);
                      if (options?.coerceNumber && Number.isFinite(parsed) && value.trim() !== '' && !Number.isNaN(parsed)) {
                        return value.includes('.') ? value : parsed;
                      }
                      return value;
                    });

                    let last422Error: unknown = null;
                    for (const candidate of uniqueCandidates) {
                      for (const value of dedupedValues) {
                        try {
                          await updateRecordFromResolvedSource(
                            tableReference,
                            tableName,
                            selectedRecord.id,
                            { [candidate]: value },
                            options?.typecast ? { typecast: true } : undefined,
                          );
                          return candidate;
                        } catch (error) {
                          if (axios.isAxiosError(error) && error.response?.status === 422) {
                            last422Error = error;
                            continue;
                          }
                          throw error;
                        }
                      }
                    }

                    if (last422Error) {
                      throw last422Error;
                    }

                    return null;
                  };

                  const priceRaw = priceFieldName ? (formValues[priceFieldName] ?? '') : '';
                  const priceCandidates = [
                    priceFieldName,
                    ...EBAY_PRICE_FIELD_CANDIDATES,
                  ];
                  const existingPriceFieldName = resolveExistingFieldName(priceCandidates);
                  const originalPriceRaw = existingPriceFieldName ? toFormValue(selectedRecord.fields[existingPriceFieldName]) : '';
                  const shouldSavePrice = priceRaw.trim().length > 0 && priceRaw !== originalPriceRaw;
                  if (shouldSavePrice) {
                    const savedPriceField = await trySaveEbayField(priceCandidates, priceRaw, { typecast: true, coerceNumber: true });
                    if (savedPriceField && savedPriceField !== priceFieldName) {
                      setFormValue(savedPriceField, priceRaw);
                    }
                  }

                  const bodyHtmlRaw = bodyHtmlPreview || (ebayBodyHtmlSaveFieldName ? (formValues[ebayBodyHtmlSaveFieldName] ?? '') : '');
                  const bodyHtmlCandidates = [
                    ebayBodyHtmlSaveFieldName,
                    ...EBAY_BODY_HTML_FIELD_CANDIDATES,
                    'Body html',
                  ];
                  const existingBodyHtmlFieldName = resolveExistingFieldName(bodyHtmlCandidates);
                  const originalBodyHtmlRaw = existingBodyHtmlFieldName ? toFormValue(selectedRecord.fields[existingBodyHtmlFieldName]) : '';
                  const shouldSaveBodyHtml = bodyHtmlRaw.trim().length > 0 && (
                    shouldForceEbayBodyHtmlSave
                    || bodyHtmlRaw !== originalBodyHtmlRaw
                  );
                  if (shouldSaveBodyHtml) {
                    const savedBodyHtmlField = await trySaveEbayField(bodyHtmlCandidates, bodyHtmlRaw, { typecast: false, coerceNumber: false });
                    if (savedBodyHtmlField) {
                      setFormValue(savedBodyHtmlField, bodyHtmlRaw);
                    }
                  }

                  const keyFeaturesFieldName = resolveExistingFieldName([
                    combinedSharedKeyFeaturesFieldName,
                    'Key Features (Key, Value)',
                    'Key Features',
                    'Key Features JSON',
                    'Features',
                    'Features JSON',
                  ]);
                  const keyFeaturesRaw = keyFeaturesFieldName ? (formValues[keyFeaturesFieldName] ?? '') : '';
                  const keyFeaturesCandidates = [
                    keyFeaturesFieldName,
                    'Key Features (Key, Value)',
                    'Key Features',
                    'Key Features JSON',
                    'Features',
                    'Features JSON',
                  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0));
                  const existingKeyFeaturesFieldName = resolveExistingFieldName(keyFeaturesCandidates);
                  const originalKeyFeaturesRaw = existingKeyFeaturesFieldName
                    ? toFormValue(selectedRecord.fields[existingKeyFeaturesFieldName])
                    : '';
                  const shouldSaveKeyFeatures = keyFeaturesRaw.trim().length > 0 && keyFeaturesRaw !== originalKeyFeaturesRaw;
                  if (shouldSaveKeyFeatures) {
                    const savedKeyFeaturesField = await trySaveEbayField(
                      keyFeaturesCandidates,
                      keyFeaturesRaw,
                      { typecast: false, coerceNumber: false },
                    );
                    if (savedKeyFeaturesField) {
                      setFormValue(savedKeyFeaturesField, keyFeaturesRaw);
                    }
                  }

                  const testingNotesFieldName = resolveExistingFieldName([
                    combinedEbayTestingNotesFieldName,
                    ...EBAY_TESTING_NOTES_FIELD_CANDIDATES,
                    ...EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
                  ]);
                  const testingNotesRaw = testingNotesFieldName ? (formValues[testingNotesFieldName] ?? '') : '';
                  const testingNotesCandidates = [
                    testingNotesFieldName,
                    ...EBAY_TESTING_NOTES_FIELD_CANDIDATES,
                    ...EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
                  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0));
                  const existingTestingNotesFieldName = resolveExistingFieldName(testingNotesCandidates);
                  const originalTestingNotesRaw = existingTestingNotesFieldName
                    ? toFormValue(selectedRecord.fields[existingTestingNotesFieldName])
                    : '';
                  const shouldSaveTestingNotes = testingNotesRaw.trim().length > 0 && testingNotesRaw !== originalTestingNotesRaw;
                  if (shouldSaveTestingNotes) {
                    const savedTestingNotesField = await trySaveEbayField(
                      testingNotesCandidates,
                      testingNotesRaw,
                      { typecast: false, coerceNumber: false },
                    );
                    if (savedTestingNotesField) {
                      setFormValue(savedTestingNotesField, testingNotesRaw);
                    }
                  }
                }

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
          {isCombinedApproval && (
            <>
              <button
                type="button"
                className={secondaryActionButtonClass}
                onClick={() => { void runCombinedPush('shopify'); }}
                disabled={saving || approving || pushingTarget !== null || hasUnsavedChanges || pushShopifyDisabled}
              >
                {pushingTarget === 'shopify'
                  ? 'Publishing Shopify...'
                  : hasUnsavedChanges
                    ? 'Save Updates Before Publishing'
                    : pushShopifyDisabled
                      ? 'Complete Shopify Fields'
                      : 'Publish Shopify'}
              </button>
              <button
                type="button"
                className={secondaryActionButtonClass}
                onClick={() => { void runCombinedPush('ebay'); }}
                disabled={saving || approving || pushingTarget !== null || hasUnsavedChanges || pushEbayDisabled}
              >
                {pushingTarget === 'ebay'
                  ? 'Publishing eBay...'
                  : hasUnsavedChanges
                    ? 'Save Updates Before Publishing'
                    : pushEbayDisabled
                      ? 'Complete eBay Fields'
                      : 'Publish eBay'}
              </button>
              <button
                type="button"
                className={accentActionButtonClass}
                onClick={() => { void runCombinedPush('both'); }}
                disabled={saving || approving || pushingTarget !== null || hasUnsavedChanges || pushBothDisabled}
              >
                {pushingTarget === 'both'
                  ? 'Publishing Both...'
                  : hasUnsavedChanges
                    ? 'Save Updates Before Publishing'
                    : pushBothDisabled
                      ? 'Complete Required Fields'
                      : 'Publish Both'}
              </button>
            </>
          )}
          {!isCombinedApproval && (
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
                      const notice = await updateApprovedShopifyListing({
                        existingProductId: formValues['Shopify REST Product ID'] ?? '',
                        record: selectedRecord,
                      }, {
                        syncExistingShopifyListing,
                        describeError: describeShopifyCreateError,
                      });
                      pushInlineActionNotice(notice.tone, notice.title, notice.message);
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
                      const createPayload = finalShopifyCreatePayload
                        ?? normalizeShopifyProductForUpsert(
                          buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? selectedRecord.fields),
                        );
                      const draftResult = await ensureShopifyDraftBeforeApproval({
                        existingProductId: formValues[SHOPIFY_PRODUCT_ID_FIELD] ?? '',
                        productIdFieldName: SHOPIFY_PRODUCT_ID_FIELD,
                        createPayload,
                        record: selectedRecord,
                        collectionIds: currentPageCollectionIds,
                        tableReference,
                        tableName,
                      }, {
                        getShopifyProduct,
                        syncExistingShopifyListing,
                        describeError: describeShopifyCreateError,
                        resolveShopifyCategoryId,
                        upsertShopifyProductWithCollectionFallback: async (params) => upsertShopifyProductWithCollectionFallback(params),
                        writeShopifyProductIdToAirtable: async (params) => writeShopifyProductIdToAirtable(params, {
                          updateRecord: updateRecordFromResolvedSource,
                        }),
                      });

                      if (draftResult.nextProductIdFieldValue !== undefined) {
                        setFormValue(SHOPIFY_PRODUCT_ID_FIELD, draftResult.nextProductIdFieldValue);
                      }

                      draftResult.notices.forEach((notice) => {
                        pushInlineActionNotice(notice.tone, notice.title, notice.message);
                      });

                      if (draftResult.status === 'creation-failed' || draftResult.status === 'update-failed') {
                        if (draftResult.status === 'creation-failed') {
                          trackWorkflowEvent('shopify_draft_create_failed_from_approval', {
                            recordId: selectedRecord.id,
                          });
                        }
                        return;
                      }

                      if (draftResult.status === 'created' && draftResult.createdProductId) {
                        trackWorkflowEvent('shopify_draft_created_from_approval', {
                          recordId: selectedRecord.id,
                          productId: draftResult.createdProductId,
                        });
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
                || pushingTarget !== null
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
          )}
        </div>

        {inlineActionNotices.length > 0 && (
          <div className="mt-3 space-y-2">
            {inlineActionNotices.map((notice) => (
              <section
                key={notice.id}
                className={`rounded-lg border px-3 py-2 transition-opacity duration-300 ${
                  fadingInlineNoticeIds.includes(notice.id) ? 'opacity-0' : 'opacity-100'
                } ${
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

        {approvalChannel === 'shopify' && (
          <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
              Shopify Create Listing API Payload (Exact Request)
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
              Shopify Create Listing API Payload (Docs Example)
            </summary>
            <div className="border-t border-[var(--line)] px-3 py-3">
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                Reference example showing the expected GraphQL request envelope sent to Shopify for create/update listing.
              </p>
              <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyCreatePayloadDocsJson}</pre>
            </div>
          </details>
        )}

        {approvalChannel === 'ebay' && (
          <>
            <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                eBay Create Listing API Payload (Exact Request)
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
                eBay Create Listing API Payload (Docs Example)
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
            requiredFieldNames={approvalChannel === 'shopify' ? shopifyRequiredFieldNames : approvalChannel === 'ebay' ? ebayRequiredFieldNames : combinedRequiredFieldNames}
            readinessColumns={approvalChannel === 'combined' ? [
              { key: 'shopify', label: 'Shopify Ready', requiredFieldNames: shopifyRequiredFieldNames },
              { key: 'ebay', label: 'eBay Ready', requiredFieldNames: ebayRequiredFieldNames },
            ] : []}
            titleFieldName={titleFieldName}
            conditionFieldName=''
            formatFieldName={approvalChannel === 'ebay' || approvalChannel === 'combined' ? '' : formatFieldName}
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
