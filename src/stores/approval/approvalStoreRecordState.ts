import { TAB_DATA_TTLS, shouldReuseTabData } from '@/app/tabDataCache';
import { getRecordsFromResolvedSource } from '@/services/app-api/airtable';
import { getInventoryItems, getOffersForInventorySkus } from '@/services/app-api/ebay';
import { buildShopifyCollectionIdsFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
import {
  CONDITION_FIELD,
  FALLBACK_LISTING_FORMAT_OPTIONS,
  SHIPPING_SERVICE_FIELD,
} from '@/stores/approval/approvalStoreConstants';
import {
  inferFieldKind,
  resolveListingFormatOptions,
  toFormValue,
  type ApprovalFieldKind,
} from '@/stores/approval/approvalStoreFieldUtils';
import type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';

type ApprovalStoreSet = (partial: Partial<ApprovalStore> | ((state: ApprovalStore) => Partial<ApprovalStore>)) => void;
type ApprovalStoreGet = () => ApprovalStore;

const SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD = 'Shopify GraphQL Collection IDs';
const approvalRecordsLoadedAtBySource = new Map<string, number>();
let listingFormatOptionsLoadedAt: number | null = null;

function getApprovalSourceCacheKey(tableReference: string, tableName?: string): string {
  return `${tableReference}::${tableName ?? ''}`;
}

export function createSetFormValueAction(set: ApprovalStoreSet): ApprovalStore['setFormValue'] {
  return (fieldName, value) => {
    set((state) => ({ formValues: { ...state.formValues, [fieldName]: value } }));
  };
}

export function createHydrateFormAction(set: ApprovalStoreSet): ApprovalStore['hydrateForm'] {
  return (record, allFieldNames, approvedFieldName) => {
    const nextValues: Record<string, string> = {};
    const nextKinds: Record<string, ApprovalFieldKind> = {};

    void approvedFieldName;

    allFieldNames.forEach((fieldName) => {
      const value = record.fields[fieldName];
      nextValues[fieldName] = toFormValue(value);
      nextKinds[fieldName] = inferFieldKind(value);
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

    const collectionIds = buildShopifyCollectionIdsFromApprovalFields(record.fields);
    if (collectionIds.length > 0) {
      nextValues[SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD] = JSON.stringify(collectionIds);
      nextKinds[SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD] = 'json';
    }

    set({ formValues: nextValues, fieldKinds: nextKinds });
  };
}

export function createLoadRecordsAction(set: ApprovalStoreSet, get: ApprovalStoreGet): ApprovalStore['loadRecords'] {
  return async (tableReference, tableName, force = false) => {
    const cacheKey = getApprovalSourceCacheKey(tableReference, tableName);
    const lastLoadedAt = approvalRecordsLoadedAtBySource.get(cacheKey) ?? null;

    if (!force && shouldReuseTabData(lastLoadedAt, TAB_DATA_TTLS.approvalQueue, get().error === null)) {
      set({ loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const data = await getRecordsFromResolvedSource(tableReference, tableName);
      set({ records: data });
      approvalRecordsLoadedAtBySource.set(cacheKey, Date.now());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load listing records' });
    } finally {
      set({ loading: false });
    }
  };
}

export function createLoadListingFormatOptionsAction(set: ApprovalStoreSet): ApprovalStore['loadListingFormatOptions'] {
  return async (force = false) => {
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
    } catch {
      set({ listingFormatOptions: FALLBACK_LISTING_FORMAT_OPTIONS });
    }
  };
}