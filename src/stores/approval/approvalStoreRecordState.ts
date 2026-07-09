import { TAB_DATA_TTLS, shouldReuseTabData } from '@/app/tabDataCache';
import { SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES } from '@/components/approval/listingApprovalShopifyConstants';
import { getRecordsFromResolvedSource } from '@/services/app-api/airtable';
import { resolveConfiguredRecordsSource } from '@/services/app-api/airtableSources';
import { getInventoryItems, getOffersForInventorySkus } from '@/services/app-api/ebay';
import { buildShopifyCollectionIdsFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
import {
  CONDITION_FIELD,
  FALLBACK_LISTING_FORMAT_OPTIONS,
  SHIPPING_SERVICE_FIELD,
} from '@/stores/approval/approvalStoreConstants';
import {
  inferFieldKindForField,
  resolveListingFormatOptions,
  toFormValueForField,
  type ApprovalFieldKind,
} from '@/stores/approval/approvalStoreFieldUtils';
import { applyWorkflowListingPrefills } from '@/stores/approval/approvalStoreWorkflowPrefill';
import type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';

type ApprovalStoreSet = (partial: Partial<ApprovalStore> | ((state: ApprovalStore) => Partial<ApprovalStore>)) => void;
type ApprovalStoreGet = () => ApprovalStore;

const SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD = 'Shopify GraphQL Collection IDs';
const approvalRecordsLoadedAtBySource = new Map<string, number>();
const approvalRecordsLoadGenerationBySource = new Map<string, number>();
let listingFormatOptionsLoadedAt: number | null = null;
let listingFormatOptionsLoadFailedAt: number | null = null;
const LISTING_FORMAT_OPTIONS_ERROR_RETRY_MS = 60_000;
const COMBINED_LISTINGS_INITIAL_MAX_RECORDS = 40;
const COMBINED_LISTINGS_HYDRATE_MAX_RECORDS = 100;
const COMBINED_LISTINGS_HYDRATE_DELAY_MS = 1200;

// Keep queue reads lightweight so Lambda responses stay below payload limits.
const APPROVAL_QUEUE_FIELDS = [
  'Workflow Status',
  'Shopify Approved',
  'eBay Approved',
  'Shopify REST Title',
  'Shopify Title',
  'Item Title',
  'Title',
  'eBay Title',
  'Vendor',
  'Shopify REST Variant 1 Price',
  'Shopify Variant 1 Price',
  'Buy It Now/Starting Price',
  'Buy It Now / Starting Price',
  'Price',
  'eBay Offer Price Value',
  'eBay Offer Auction Start Price Value',
  'Quantity',
  'Qty',
  'Shopify Status',
  'Shopify REST Status',
  'eBay Offer Status',
  'eBay Format',
  'eBay Offer Format',
  'Listing Format',
  ...SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES,
];

function getApprovalSourceCacheKey(tableReference: string, tableName?: string): string {
  return `${tableReference}::${tableName ?? ''}`;
}

export function createSetFormValueAction(set: ApprovalStoreSet): ApprovalStore['setFormValue'] {
  return (fieldName, value) => {
    set((state) => ({ formValues: { ...state.formValues, [fieldName]: value } }));
  };
}

export function createSetDerivedFormValueAction(set: ApprovalStoreSet): ApprovalStore['setDerivedFormValue'] {
  return (fieldName, value) => {
    set((state) => ({
      formValues: { ...state.formValues, [fieldName]: value },
      initialFormValues: { ...state.initialFormValues, [fieldName]: value },
    }));
  };
}

export function createHydrateFormAction(set: ApprovalStoreSet): ApprovalStore['hydrateForm'] {
  return (record, allFieldNames, approvedFieldName) => {
    const nextValues: Record<string, string> = {};
    const nextKinds: Record<string, ApprovalFieldKind> = {};

    void approvedFieldName;

    allFieldNames.forEach((fieldName) => {
      const value = record.fields[fieldName];
      nextValues[fieldName] = toFormValueForField(fieldName, value);
      nextKinds[fieldName] = inferFieldKindForField(fieldName, value);
    });

    nextValues[SHIPPING_SERVICE_FIELD] =
      nextValues['Domestic Service 1']
      || nextValues['Domestic Service 2']
      || nextValues['International Service 1']
      || nextValues['International Service 2']
      || '';
    nextKinds[SHIPPING_SERVICE_FIELD] = 'text';

    if (Object.prototype.hasOwnProperty.call(nextValues, CONDITION_FIELD) && !nextValues[CONDITION_FIELD]) {
      nextValues[CONDITION_FIELD] =
        nextValues['Item Condition']
        || nextValues['Condition']
        || nextValues['Shopify Condition']
        || nextValues['eBay Inventory Condition']
        || '';
      nextKinds[CONDITION_FIELD] = 'text';
    }

    for (const fieldName of allFieldNames) {
      const n = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
      const compact = n.replace(/[^a-z0-9]/g, '');
      const isFulfillmentField = (n.includes('variant') || compact.includes('variant'))
        && (n.includes('fulfillment') || compact.includes('fulfillment'));
      // Always default fulfillment_service to 'manual' for all variant fulfillment fields
      if (isFulfillmentField) {
        nextValues[fieldName] = 'manual';
      }
    }

    applyWorkflowListingPrefills(record.fields, nextValues, nextKinds);

    const collectionIds = buildShopifyCollectionIdsFromApprovalFields(record.fields);
    if (collectionIds.length > 0) {
      nextValues[SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD] = JSON.stringify(collectionIds);
      nextKinds[SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD] = 'json';
    }

    set({ formValues: nextValues, initialFormValues: { ...nextValues }, fieldKinds: nextKinds });
  };
}

export function createLoadRecordsAction(set: ApprovalStoreSet, get: ApprovalStoreGet): ApprovalStore['loadRecords'] {
  return async (tableReference, tableName, force = false) => {
    const cacheKey = getApprovalSourceCacheKey(tableReference, tableName);
    const currentGeneration = (approvalRecordsLoadGenerationBySource.get(cacheKey) ?? 0) + 1;
    approvalRecordsLoadGenerationBySource.set(cacheKey, currentGeneration);
    const lastLoadedAt = approvalRecordsLoadedAtBySource.get(cacheKey) ?? null;

    if (!force && shouldReuseTabData(lastLoadedAt, TAB_DATA_TTLS.approvalQueue, get().error === null)) {
      set({ loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const resolvedSource = resolveConfiguredRecordsSource(tableReference, tableName);
      const isCombinedListingsSource = resolvedSource === 'approval-combined';

      if (isCombinedListingsSource) {
        const initialData = await getRecordsFromResolvedSource(tableReference, tableName, {
          fields: APPROVAL_QUEUE_FIELDS,
          subset: 'listings-page',
          maxRecords: COMBINED_LISTINGS_INITIAL_MAX_RECORDS,
        });

        if (approvalRecordsLoadGenerationBySource.get(cacheKey) !== currentGeneration) {
          return;
        }

        set({ records: initialData });
        approvalRecordsLoadedAtBySource.set(cacheKey, Date.now());

        if (initialData.length >= COMBINED_LISTINGS_INITIAL_MAX_RECORDS) {
          void (async () => {
            try {
              await new Promise<void>((resolve) => {
                setTimeout(resolve, COMBINED_LISTINGS_HYDRATE_DELAY_MS);
              });

              if (approvalRecordsLoadGenerationBySource.get(cacheKey) !== currentGeneration) {
                return;
              }

              const hydratedData = await getRecordsFromResolvedSource(tableReference, tableName, {
                fields: APPROVAL_QUEUE_FIELDS,
                subset: 'listings-page',
                maxRecords: COMBINED_LISTINGS_HYDRATE_MAX_RECORDS,
              });

              if (approvalRecordsLoadGenerationBySource.get(cacheKey) !== currentGeneration) {
                return;
              }

              if (hydratedData.length > initialData.length) {
                set({ records: hydratedData });
                approvalRecordsLoadedAtBySource.set(cacheKey, Date.now());
              }
            } catch {
              // Keep initial queue data when background hydration fails.
            }
          })();
        }

        return;
      }

      const data = await getRecordsFromResolvedSource(tableReference, tableName, {
        fields: APPROVAL_QUEUE_FIELDS,
      });

      if (approvalRecordsLoadGenerationBySource.get(cacheKey) !== currentGeneration) {
        return;
      }

      set({ records: data });
      approvalRecordsLoadedAtBySource.set(cacheKey, Date.now());
    } catch (err) {
      if (approvalRecordsLoadGenerationBySource.get(cacheKey) !== currentGeneration) {
        return;
      }

      set({ error: err instanceof Error ? err.message : 'Failed to load listing records' });
    } finally {
      if (approvalRecordsLoadGenerationBySource.get(cacheKey) === currentGeneration) {
        set({ loading: false });
      }
    }
  };
}

export function createLoadListingFormatOptionsAction(set: ApprovalStoreSet): ApprovalStore['loadListingFormatOptions'] {
  return async (force = false) => {
    const recentlyFailed = listingFormatOptionsLoadFailedAt !== null
      && Date.now() - listingFormatOptionsLoadFailedAt < LISTING_FORMAT_OPTIONS_ERROR_RETRY_MS;

    if (!force && recentlyFailed) {
      return;
    }

    if (!force && shouldReuseTabData(listingFormatOptionsLoadedAt, TAB_DATA_TTLS.listingFormatOptions, true)) {
      return;
    }

    try {
      const itemsPage = await getInventoryItems(100);
      const offersPage = await getOffersForInventorySkus(itemsPage.inventoryItems.map((item) => item.sku));
      const formats = offersPage.offers
        .map((offer) => offer.format)
        .filter((format): format is string => Boolean(format));

      const uniqueFormats = resolveListingFormatOptions(formats);

      if (uniqueFormats.length > 0) {
        set({ listingFormatOptions: uniqueFormats });
      }
      listingFormatOptionsLoadedAt = Date.now();
      listingFormatOptionsLoadFailedAt = null;
    } catch {
      set({ listingFormatOptions: FALLBACK_LISTING_FORMAT_OPTIONS });
      listingFormatOptionsLoadFailedAt = Date.now();
    }
  };
}