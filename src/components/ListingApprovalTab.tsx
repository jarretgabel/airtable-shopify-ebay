import { useEffect, useMemo } from 'react';
import axios from 'axios';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import airtableService from '@/services/airtable';
import {
  buildShopifyCreateProductRequestWithRequiredFields,
  shopifyService,
  type ShopifyCreateProductRequest,
} from '@/services/shopify';
import { buildEbayDraftPayloadBundleFromApprovalFields } from '@/services/ebayDraftFromAirtable';
import { buildShopifyDraftProductFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
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

const SHOPIFY_CREATE_PRODUCT_KEY_ORDER = [
  'title',
  'body_html',
  'vendor',
  'product_type',
  'handle',
  'status',
  'tags',
  'published_scope',
  'template_suffix',
  'variants',
  'options',
  'images',
  'metafields',
] as const;

const SHOPIFY_CREATE_VARIANT_KEY_ORDER = [
  'price',
  'sku',
  'inventory_quantity',
  'inventory_management',
  'inventory_policy',
  'taxable',
  'requires_shipping',
] as const;

const SHOPIFY_CREATE_OPTION_KEY_ORDER = [
  'name',
  'position',
  'values',
] as const;

const SHOPIFY_CREATE_IMAGE_KEY_ORDER = [
  'src',
  'alt',
  'position',
] as const;

const SHOPIFY_CREATE_METAFIELD_KEY_ORDER = [
  'namespace',
  'key',
  'type',
  'value',
] as const;

const EMPTY_SHOPIFY_CREATE_VARIANT_TEMPLATE: Record<string, unknown> = {
  price: '',
  sku: '',
  inventory_quantity: 0,
  inventory_management: '',
  inventory_policy: '',
  taxable: false,
  requires_shipping: false,
};

const EMPTY_SHOPIFY_CREATE_OPTION_TEMPLATE: Record<string, unknown> = {
  name: '',
  position: 1,
  values: [],
};

const EMPTY_SHOPIFY_CREATE_IMAGE_TEMPLATE: Record<string, unknown> = {
  src: '',
  alt: '',
  position: 1,
};

const EMPTY_SHOPIFY_CREATE_METAFIELD_TEMPLATE: Record<string, unknown> = {
  namespace: '',
  key: '',
  type: '',
  value: '',
};

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
  'Item Description',
  'Description',
  'shopify_body_description',
  'shopify_rest_body_description',
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

function normalizeObjectWithTemplate(
  source: Record<string, unknown> | undefined,
  orderedKeys: readonly string[],
  template: Record<string, unknown>,
): Record<string, unknown> {
  const sourceRecord = source ?? {};
  const normalizedEntries = orderedKeys.map((key) => {
    const sourceValue = sourceRecord[key];
    const templateValue = template[key];
    const nextValue = sourceValue === undefined || sourceValue === null ? templateValue : sourceValue;
    return [key, nextValue] as const;
  });
  const remainingEntries = Object.entries(sourceRecord).filter(([key]) => !orderedKeys.includes(key));
  return Object.fromEntries([...normalizedEntries, ...remainingEntries]);
}

function normalizeShopifyCreatePayloadForViewer(payload: ShopifyCreateProductRequest): ShopifyCreateProductRequest {
  const productRecord = payload.product as unknown as Record<string, unknown>;

  const variantsSource = Array.isArray(productRecord.variants)
    ? productRecord.variants
    : [];
  const optionsSource = Array.isArray(productRecord.options)
    ? productRecord.options
    : [];
  const imagesSource = Array.isArray(productRecord.images)
    ? productRecord.images
    : [];
  const metafieldsSource = Array.isArray(productRecord.metafields)
    ? productRecord.metafields
    : [];

  const variants = (variantsSource.length > 0 ? variantsSource : [EMPTY_SHOPIFY_CREATE_VARIANT_TEMPLATE])
    .map((variant) => normalizeObjectWithTemplate(variant as Record<string, unknown>, SHOPIFY_CREATE_VARIANT_KEY_ORDER, EMPTY_SHOPIFY_CREATE_VARIANT_TEMPLATE));
  const options = (optionsSource.length > 0 ? optionsSource : [EMPTY_SHOPIFY_CREATE_OPTION_TEMPLATE])
    .map((option) => normalizeObjectWithTemplate(option as Record<string, unknown>, SHOPIFY_CREATE_OPTION_KEY_ORDER, EMPTY_SHOPIFY_CREATE_OPTION_TEMPLATE));
  const images = (imagesSource.length > 0 ? imagesSource : [EMPTY_SHOPIFY_CREATE_IMAGE_TEMPLATE])
    .map((image) => normalizeObjectWithTemplate(image as Record<string, unknown>, SHOPIFY_CREATE_IMAGE_KEY_ORDER, EMPTY_SHOPIFY_CREATE_IMAGE_TEMPLATE));
  const metafields = (metafieldsSource.length > 0 ? metafieldsSource : [EMPTY_SHOPIFY_CREATE_METAFIELD_TEMPLATE])
    .map((metafield) => normalizeObjectWithTemplate(metafield as Record<string, unknown>, SHOPIFY_CREATE_METAFIELD_KEY_ORDER, EMPTY_SHOPIFY_CREATE_METAFIELD_TEMPLATE));

  const productTemplate: Record<string, unknown> = {
    title: '',
    body_html: '',
    vendor: '',
    product_type: '',
    handle: '',
    status: '',
    tags: '',
    published_scope: 'web',
    template_suffix: 'product-template',
    variants,
    options,
    images,
    metafields,
  };

  const normalizedProduct = normalizeObjectWithTemplate(productRecord, SHOPIFY_CREATE_PRODUCT_KEY_ORDER, productTemplate);

  return {
    product: normalizedProduct,
  } as unknown as ShopifyCreateProductRequest;
}

const SHOPIFY_CREATE_PAYLOAD_DOCS_EXAMPLE: ShopifyCreateProductRequest = {
  product: {
    title: "Example Product Title",
    body_html: "<p>Example product description in HTML.</p>",
    vendor: "Example Vendor",
    product_type: "Example Product Type",
    handle: "example-product-title",
    status: "draft",
    tags: "Tag 1, Tag 2",
    published_scope: "web",
    template_suffix: "product-template",
    variants: [
      {
        price: "99.99",
        sku: "EXAMPLE-SKU-1",
        inventory_quantity: 1,
        inventory_management: "shopify",
        inventory_policy: "deny",
        taxable: true,
        requires_shipping: true,
      },
    ],
    options: [
      {
        name: "Condition",
        position: 1,
        values: ["New"],
      },
    ],
    images: [
      {
        src: "https://example.com/image-1.jpg",
        alt: "Example image alt text",
        position: 1,
      },
    ],
    metafields: [
      {
        namespace: "custom",
        key: "example_key",
        type: "single_line_text_field",
        value: "Example metafield value",
      },
    ],
  },
};

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

  const shopifyDraftCreatePayloadJson = useMemo(() => {
    if (!shopifyDraftCreatePayload) return '';
    try {
      return JSON.stringify(normalizeShopifyCreatePayloadForViewer(shopifyDraftCreatePayload), null, 2);
    } catch {
      return '{\n  "error": "Unable to serialize payload"\n}';
    }
  }, [shopifyDraftCreatePayload]);

  const currentPageDraftProduct = useMemo(() => {
    if (approvalChannel !== 'shopify' || !mergedDraftSourceFields) return null;
    return buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields);
  }, [approvalChannel, mergedDraftSourceFields]);

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
    if (approvalChannel !== 'shopify') return '{\n  "product": {}\n}';
    try {
      const docsVariants = SHOPIFY_CREATE_PAYLOAD_DOCS_EXAMPLE.product.variants ?? [];
      const currentPageVariantPrice = currentPageDraftProduct?.variants?.[0]?.price || '';
      return JSON.stringify(normalizeShopifyCreatePayloadForViewer({
        ...SHOPIFY_CREATE_PAYLOAD_DOCS_EXAMPLE,
        product: {
          ...SHOPIFY_CREATE_PAYLOAD_DOCS_EXAMPLE.product,
          handle: currentPageDraftProduct?.handle || '',
          body_html: currentPageDraftProduct?.body_html || '',
          variants: docsVariants.length > 0
            ? [
                {
                  ...docsVariants[0],
                  price: currentPageVariantPrice,
                },
                ...docsVariants.slice(1),
              ]
            : docsVariants,
        },
      }), null, 2);
    } catch {
      return '{\n  "product": {}\n}';
    }
  }, [approvalChannel, currentPageDraftProduct]);

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
        const originalValue = toFormValue(selectedRecord.fields[fieldName]);
        return currentValue !== originalValue;
      })
      .map(([fieldName]) => fieldName);
  }, [formValues, selectedRecord]);

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
              void saveRecord(false, selectedRecord, tableReference, tableName, approvedFieldName, () => {}, 'full');
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
                  let shouldCreateDraft = true;

                  if (existingProductId) {
                    const parsedExistingId = Number(existingProductId);

                    if (Number.isFinite(parsedExistingId) && parsedExistingId > 0) {
                      const existingProduct = await shopifyService.getProduct(parsedExistingId);
                      if (existingProduct) {
                        pushNotification({
                          tone: 'info',
                          title: 'Shopify draft already exists',
                          message: `Product #${existingProductId} already created — skipping duplicate draft creation.`,
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
                      const createPayload: ShopifyCreateProductRequest = shopifyDraftCreatePayload
                        ?? buildShopifyCreateProductRequestWithRequiredFields(
                          buildShopifyDraftProductFromApprovalFields(mergedDraftSourceFields ?? selectedRecord.fields),
                        );
                      const createdProduct = await shopifyService.createProductFromRequest(createPayload);
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
            disabled={saving || hasUnsavedChanges}
          >
            {saving ? 'Approving...' : hasUnsavedChanges ? 'Save Before Approve' : 'Approve Listing'}
          </button>
        </div>

        {approvalChannel === 'shopify' && createShopifyDraftOnApprove && (
          <details className="mt-6 rounded-lg border border-[var(--line)] bg-white/5">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
              Shopify API Create Payload (Exact Request)
            </summary>
            <div className="border-t border-[var(--line)] px-3 py-3">
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                This is the exact JSON body sent to Shopify when you click Approve. Required fields are auto-enforced in this payload.
              </p>
              <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{shopifyDraftCreatePayloadJson || '{\n  "product": {}\n}'}</pre>
            </div>
          </details>
        )}

        {approvalChannel === 'shopify' && (
          <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
              Shopify API Request Structure (Docs Example)
            </summary>
            <div className="border-t border-[var(--line)] px-3 py-3">
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">
                Reference example based on Shopify product create request structure for POST /admin/api/2024-04/products.json.
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
