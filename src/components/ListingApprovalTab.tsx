import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import { ShopifyBodyHtmlPreview } from '@/components/approval/ShopifyBodyHtmlPreview';
import airtableService from '@/services/airtable';
import {
  buildShopifyUnifiedProductSetRequest,
  buildShopifyCreateProductRequestWithRequiredFields,
  shopifyService,
  type ShopifyCreateProductRequest,
  type ShopifyTaxonomyCategoryMatch,
  type ShopifyUnifiedProductSetRequest,
} from '@/services/shopify';
import { buildEbayDraftPayloadBundleFromApprovalFields } from '@/services/ebayDraftFromAirtable';
import { buildShopifyDraftProductFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
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
import { useNotificationStore } from '@/stores/notificationStore';
import { AirtableRecord } from '@/types/airtable';

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
  'eBay Inventory Product ImageURLs JSON',
  'ebay_inventory_product_imageurls_json',
  'Image URL',
  'Image URLs',
  'Image-URL',
  'Image-URLs',
  'image_url',
  'image_urls',
] as const;

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
  const pushNotification = useNotificationStore((state) => state.push);
  const [shopifyCategoryResolution, setShopifyCategoryResolution] = useState<ShopifyCategoryResolutionState>({
    status: 'idle',
    match: null,
    error: '',
  });
  const [formDerivedBodyHtmlPreview, setFormDerivedBodyHtmlPreview] = useState('');

  const allFieldNames = useMemo(() => {
    const names = new Set<string>();
    records.forEach((record) => {
      Object.keys(record.fields).forEach((fieldName) => names.add(fieldName));
    });

    if (approvalChannel === 'shopify') {
      const existingNames = Array.from(names);
      const existingLower = new Set(existingNames.map((name) => name.toLowerCase()));
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
      const preferredImageField = existingNames.find((name) =>
        EBAY_IMAGE_LIST_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
      ) ?? EBAY_IMAGE_LIST_FIELD_CANDIDATES.find((candidate) => !existingLower.has(candidate.toLowerCase()));

      if (preferredImageField) {
        names.add(preferredImageField);
      }
    }

    names.add(CONDITION_FIELD);

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [records, approvalChannel]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

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

  const shopifyDraftCreatePayload = useMemo(() => {
    if (approvalChannel !== 'shopify' || !createShopifyDraftOnApprove || !mergedDraftSourceFields) return null;
    const draftProduct = buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields);
    return buildShopifyCreateProductRequestWithRequiredFields(draftProduct);
  }, [approvalChannel, createShopifyDraftOnApprove, mergedDraftSourceFields]);

  const currentPageDraftProduct = useMemo(() => {
    if (approvalChannel !== 'shopify' || !mergedDraftSourceFields) return null;
    return buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields);
  }, [approvalChannel, mergedDraftSourceFields]);

  const currentPageBodyHtml = useMemo(
    () => currentPageDraftProduct?.body_html ?? '',
    [currentPageDraftProduct],
  );

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

    const baseCreatePayload: ShopifyCreateProductRequest = shopifyDraftCreatePayload
      ?? buildShopifyCreateProductRequestWithRequiredFields(
        buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? selectedRecord.fields),
      );
    const baseProductRecord = (baseCreatePayload.product as unknown as Record<string, unknown>) ?? {};
    const { body_html: _ignoredBodyHtml, ...baseProductWithoutBodyHtml } = baseProductRecord;

    return {
      product: {
        ...baseProductWithoutBodyHtml,
        body_html: (
          currentPageBodyHtml
          || currentPageProductDescription
          || (typeof baseProductRecord.body_html === 'string' ? baseProductRecord.body_html : '')
        ),
        product_type: (
          trimShopifyProductType(currentPageProductCategory)
          || trimShopifyProductType(typeof baseProductWithoutBodyHtml.product_type === 'string' ? baseProductWithoutBodyHtml.product_type : '')
        ),
      } as unknown as ShopifyCreateProductRequest['product'],
    } as ShopifyCreateProductRequest;
  }, [
    approvalChannel,
    createShopifyDraftOnApprove,
    selectedRecord,
    shopifyDraftCreatePayload,
    mergedDraftSourceFields,
    currentPageProductDescription,
    currentPageProductCategory,
    currentPageBodyHtml,
  ]);

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

    return buildShopifyUnifiedProductSetRequest(finalShopifyCreatePayload.product, {
      categoryId: previewCategoryId,
      existingProductId,
    });
  }, [
    currentPageCategoryIdResolution.value,
    finalShopifyCreatePayload,
    formValues,
    shopifyCategoryLookupValue,
    shopifyCategoryResolution.match,
  ]);

  const shopifyDraftCreatePayloadJson = useMemo(() => {
    if (!effectiveShopifyCreatePayload) return '';
    try {
      return JSON.stringify({
        operationName: 'ProductSet',
        query: SHOPIFY_PRODUCT_SET_MUTATION,
        variables: effectiveShopifyCreatePayload,
      }, null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize payload"\n}';
    }
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

  const resolveShopifyCategoryId = async (): Promise<string | null | undefined> => {
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
      pushNotification({
        tone: 'error',
        title: 'Shopify category not resolved',
        message: `Could not resolve a Shopify taxonomy category from "${lookupValue}".`,
      });
      return null;
    } catch (categoryError) {
      setShopifyCategoryResolution({
        status: 'error',
        match: null,
        error: categoryError instanceof Error ? categoryError.message : 'Unable to resolve Shopify taxonomy category.',
      });
      pushNotification({
        tone: 'error',
        title: 'Shopify category resolution failed',
        message: describeShopifyCreateError(categoryError),
      });
      return null;
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
      : resolveFieldName(['eBay Inventory Product Title', 'Item Title', 'Title', 'Name'], 'Item Title'),
    [approvalChannel, resolveFieldName],
  );

  const conditionFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Item Condition', 'Condition', 'Shopify Condition', 'Shopify REST Status'], 'Item Condition')
      : resolveFieldName(['eBay Inventory Condition', 'Item Condition', 'Condition'], 'Item Condition'),
    [approvalChannel, resolveFieldName],
  );

  const formatFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Listing Format', 'Status', 'Shopify Status', 'Shopify REST Status'], 'Listing Format')
      : resolveFieldName(['eBay Offer Format', 'Listing Format', 'Status'], 'Listing Format'),
    [approvalChannel, resolveFieldName],
  );

  const priceFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'Price'], '')
      : resolveFieldName(['eBay Offer Price Value', 'Price'], ''),
    [approvalChannel, resolveFieldName],
  );

  const vendorFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Vendor', 'Shopify Vendor', 'Vendor', 'Manufacturer', 'Brand'], '')
      : resolveFieldName(['eBay Inventory Product Brand', 'Brand', 'Vendor', 'Manufacturer'], ''),
    [approvalChannel, resolveFieldName],
  );

  const qtyFieldName = useMemo(
    () => approvalChannel === 'shopify'
      ? resolveFieldName(['Shopify REST Variant 1 Inventory Quantity', 'Shopify Variant 1 Inventory Quantity', 'Quantity', 'Qty'], '')
      : resolveFieldName(['eBay Inventory Ship To Location Quantity', 'Quantity', 'Qty'], ''),
    [approvalChannel, resolveFieldName],
  );

  function openRecord(record: AirtableRecord) {
    hydrateForm(record, allFieldNames, approvedFieldName);
    trackWorkflowEvent('approval_record_opened', {
      recordId: record.id,
      tableReference,
    });
    onSelectRecord(record.id);
  }

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
  const hasApprovedValue = approvedValue !== null && approvedValue !== undefined && String(approvedValue).trim() !== '';

  const changedFieldNames = useMemo(() => {
    if (!selectedRecord) return [] as string[];

    return Object.entries(formValues)
      .filter(([fieldName, currentValue]) => {
        if (fieldName === SHIPPING_SERVICE_FIELD) return false;
        if (fieldName === CONDITION_FIELD) return false;
        const normalizedFieldName = fieldName.trim().toLowerCase();
        if (normalizedFieldName === 'shopify rest product id' || normalizedFieldName === 'shopify product id') return false;
          if (approvalChannel === 'shopify' && isVendorFieldName(fieldName)) return false;
        const originalValue = toFormValue(selectedRecord.fields[fieldName]);
        return currentValue !== originalValue;
      })
      .map(([fieldName]) => fieldName);
        }, [approvalChannel, formValues, selectedRecord]);

  const hasUnsavedChanges = changedFieldNames.length > 0;

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
                  : hasApprovedValue
                    ? 'border border-rose-400/35 bg-rose-500/20 text-rose-200'
                    : 'border border-amber-400/35 bg-amber-500/20 text-amber-200'
              }`}>
                {isApproved ? 'Approved' : hasApprovedValue ? displayValue(approvedValue) : 'Pending'}
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
          allFieldNames={allFieldNames}
          writableFieldNames={Object.keys(selectedRecord.fields)}
          approvedFieldName={approvedFieldName}
          formValues={formValues}
          fieldKinds={fieldKinds}
          listingFormatOptions={listingFormatOptions}
          saving={saving}
          setFormValue={setFormValue}
          suppressImageScalarFields={approvalChannel === 'shopify' || approvalChannel === 'ebay'}
          showBodyHtmlPreview={false}
          onBodyHtmlPreviewChange={setFormDerivedBodyHtmlPreview}
          originalFieldValues={Object.fromEntries(
            Object.entries(selectedRecord.fields).map(([fieldName, value]) => [fieldName, toFormValue(value)]),
          )}
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

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className={secondaryActionButtonClass}
            onClick={() => {
              if (!selectedRecord) return;
              const confirmed = window.confirm('Reset page fields to the current Airtable values?');
              if (!confirmed) return;
              hydrateForm(selectedRecord, allFieldNames, approvedFieldName);
              pushNotification({
                tone: 'info',
                title: 'Page data reset',
                message: 'Form values were restored to current Airtable values.',
              });
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
                let saveSucceeded = false;
                await saveRecord(false, selectedRecord, tableReference, tableName, approvedFieldName, () => {
                  saveSucceeded = true;
                }, 'full');

                if (!saveSucceeded || approvalChannel !== 'shopify') return;

                const existingProductId = formValues['Shopify REST Product ID']?.trim();
                if (!existingProductId) return;

                const parsedExistingId = Number(existingProductId);
                if (!Number.isFinite(parsedExistingId) || parsedExistingId <= 0) return;

                try {
                  const updatePayload: ShopifyCreateProductRequest = finalShopifyCreatePayload
                    ?? buildShopifyCreateProductRequestWithRequiredFields(
                      buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? selectedRecord.fields),
                    );
                  const categoryId = await resolveShopifyCategoryId();
                  if (categoryId === null) return;

                  const unifiedRequest = buildShopifyUnifiedProductSetRequest(updatePayload.product, {
                    categoryId: categoryId ?? undefined,
                    existingProductId: parsedExistingId,
                  });

                  await shopifyService.upsertProductWithUnifiedRequest(unifiedRequest);
                  pushNotification({
                    tone: 'success',
                    title: 'Shopify draft updated',
                    message: `Draft product #${existingProductId} was updated with the latest saved listing fields.`,
                  });
                } catch (updateError) {
                  pushNotification({
                    tone: 'error',
                    title: 'Shopify draft update failed',
                    message: describeShopifyCreateError(updateError),
                  });
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
              if (hasUnsavedChanges) {
                pushNotification({
                  tone: 'warning',
                  title: 'Save required before approval',
                  message: 'One or more fields changed on this page. Save updates before approving the listing.',
                });
                return;
              }

              const confirmed = window.confirm('Are you sure you want to approve this listing for publishing?');
              if (!confirmed) return;
              if (!selectedRecord) return;

              const SHOPIFY_PRODUCT_ID_FIELD = 'Shopify REST Product ID';

              const runApproval = async () => {
                if (createShopifyDraftOnApprove) {
                  const existingProductId = formValues[SHOPIFY_PRODUCT_ID_FIELD]?.trim();
                  const createPayload: ShopifyCreateProductRequest = finalShopifyCreatePayload
                    ?? buildShopifyCreateProductRequestWithRequiredFields(
                      buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? selectedRecord.fields),
                    );
                  let shouldCreateDraft = true;

                  if (existingProductId) {
                    const parsedExistingId = Number(existingProductId);

                    if (Number.isFinite(parsedExistingId) && parsedExistingId > 0) {
                      const existingProduct = await shopifyService.getProduct(parsedExistingId);
                      if (existingProduct) {
                        try {
                          const categoryId = await resolveShopifyCategoryId();
                          if (categoryId === null) return;

                          const unifiedRequest = buildShopifyUnifiedProductSetRequest(createPayload.product, {
                            categoryId: categoryId ?? undefined,
                            existingProductId: parsedExistingId,
                          });

                          await shopifyService.upsertProductWithUnifiedRequest(unifiedRequest);
                          pushNotification({
                            tone: 'success',
                            title: 'Shopify draft updated',
                            message: `Draft product #${existingProductId} was updated with the latest listing fields before approval.`,
                          });
                        } catch (updateError) {
                          pushNotification({
                            tone: 'error',
                            title: 'Shopify draft update failed',
                            message: describeShopifyCreateError(updateError),
                          });
                          return;
                        }
                        pushNotification({
                          tone: 'info',
                          title: 'Shopify draft already exists',
                          message: `Product #${existingProductId} already existed, so it was updated instead of creating a duplicate draft.`,
                        });
                        shouldCreateDraft = false;
                      } else {
                        setFormValue(SHOPIFY_PRODUCT_ID_FIELD, '');
                        pushNotification({
                          tone: 'warning',
                          title: 'Cleared stale Shopify product ID',
                          message: `Saved product ID #${existingProductId} was not found in Shopify. Creating a new draft now.`,
                        });
                      }
                    } else {
                      setFormValue(SHOPIFY_PRODUCT_ID_FIELD, '');
                    }
                  }

                  if (shouldCreateDraft) {
                    try {
                      const categoryId = await resolveShopifyCategoryId();
                      if (categoryId === null) return;

                      const unifiedRequest = buildShopifyUnifiedProductSetRequest(createPayload.product, {
                        categoryId: categoryId ?? undefined,
                      });
                      const createdProduct = await shopifyService.upsertProductWithUnifiedRequest(unifiedRequest);
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
                        throw writebackError;
                      }

                      setFormValue(SHOPIFY_PRODUCT_ID_FIELD, productIdStr);

                      trackWorkflowEvent('shopify_draft_created_from_approval', {
                        recordId: selectedRecord.id,
                        productId: createdProduct.id,
                      });
                      pushNotification({
                        tone: 'success',
                        title: 'Shopify draft created',
                        message: `Draft product #${productIdStr} was created before approval completion.`,
                      });
                    } catch (draftError) {
                      trackWorkflowEvent('shopify_draft_create_failed_from_approval', {
                        recordId: selectedRecord.id,
                      });
                      pushNotification({
                        tone: 'error',
                        title: 'Shopify draft creation failed',
                        message: describeShopifyCreateError(draftError),
                      });
                      return;
                    }
                  }
                }

                trackWorkflowEvent('approval_approved', {
                  recordId: selectedRecord.id,
                  tableReference,
                });
                await saveRecord(true, selectedRecord, tableReference, tableName, approvedFieldName, onBackToList, 'approve-only');
              };

              void runApproval();
            }}
            disabled={saving || hasUnsavedChanges || isApproved}
          >
            {saving
              ? 'Approving...'
              : isApproved
                ? 'Already Approved'
                : hasUnsavedChanges
                  ? 'Save Before Approve'
                  : 'Approve Listing'}
          </button>
        </div>

        {approvalChannel === 'shopify' && createShopifyDraftOnApprove && (
          <div className="mt-6">
            <ShopifyBodyHtmlPreview value={formDerivedBodyHtmlPreview || currentPageBodyHtml} />
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
            <details className="mt-6 rounded-lg border border-[var(--line)] bg-white/5">
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

          <p className="m-0 mb-4 text-sm text-[var(--muted)]">
            <strong>{records.length}</strong> listing rows loaded.
          </p>

          <ApprovalQueueTable
            records={records}
            approvedFieldName={approvedFieldName}
            titleFieldName={titleFieldName}
            conditionFieldName={conditionFieldName}
            formatFieldName={formatFieldName}
            priceFieldName={priceFieldName}
            vendorFieldName={vendorFieldName}
            qtyFieldName={qtyFieldName}
            openRecord={openRecord}
            onSelectRecord={onSelectRecord}
          />
        </section>
      ) : null}
    </>
  );
}
