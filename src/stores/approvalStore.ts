import { create } from 'zustand';
import airtableService from '@/services/airtable';
import { getInventoryItems, getOffersForInventorySkus } from '@/services/ebay';
import { buildShopifyCollectionIdsFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
import { logServiceInfo } from '@/services/logger';
import {
  CONDITION_FIELD,
  FALLBACK_LISTING_FORMAT_OPTIONS,
  SHIPPING_SERVICE_FIELD,
} from '@/stores/approval/approvalStoreConstants';
import {
  fromFormValue,
  inferFieldKind,
  mapShippingServiceToFields,
  resolveListingFormatOptions,
  toFormValue,
  type ApprovalFieldKind,
} from '@/stores/approval/approvalStoreFieldUtils';
import type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';

export {
  CONDITION_FIELD,
  DEFAULT_APPROVAL_TABLE_REFERENCE,
  FALLBACK_LISTING_FORMAT_OPTIONS,
  ITEM_CONDITION_OPTIONS,
  SHIPPING_SERVICE_FIELD,
  SHIPPING_SERVICE_OPTIONS,
} from '@/stores/approval/approvalStoreConstants';

export {
  displayValue,
  fromFormValue,
  getDropdownOptions,
  inferFieldKind,
  isAllowOffersField,
  isShippingServiceField,
  mapShippingServiceToFields,
  toFormValue,
} from '@/stores/approval/approvalStoreFieldUtils';

export type { ApprovalFieldKind } from '@/stores/approval/approvalStoreFieldUtils';
export type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';

const SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD = 'Shopify GraphQL Collection IDs';

function resolveApprovedValue(rawValue: string, kind: ApprovalFieldKind): string {
  if (kind === 'boolean') return 'true';

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return 'Approved';
  if (normalized === 'false') return 'true';
  if (normalized === 'no' || normalized === 'n') return 'Yes';
  if (normalized === '0') return '1';
  if (normalized === 'pending' || normalized === 'not approved' || normalized === 'unapproved') {
    return 'Approved';
  }

  return rawValue;
}

function resolveConditionMirrorField(fieldNames: string[]): string | null {
  const preferredOrder = [
    'Item Condition',
    'Condition',
    'Shopify Condition',
    'Shopify REST Condition',
    'eBay Inventory Condition',
  ];

  const byLower = new Map(fieldNames.map((name) => [name.toLowerCase(), name]));
  for (const candidate of preferredOrder) {
    const found = byLower.get(candidate.toLowerCase());
    if (found) return found;
  }

  return null;
}

function isTagLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'tags'
    || normalized.includes(' tag ')
    || normalized.endsWith(' tag')
    || normalized.includes(' tags ')
    || normalized.endsWith(' tags')
    || normalized.includes('_tag_')
    || normalized.endsWith('_tag')
    || normalized.includes('_tags_')
    || normalized.endsWith('_tags');
}

function isCollectionLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'collection'
    || normalized === 'collections'
    || normalized.includes(' collection ')
    || normalized.endsWith(' collection')
    || normalized.includes(' collections ')
    || normalized.endsWith(' collections')
    || normalized.includes('_collection_')
    || normalized.endsWith('_collection')
    || normalized.includes('_collections_')
    || normalized.endsWith('_collections');
}

function isAllowedMissingWritableFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return isTagLikeFieldName(fieldName)
    || normalized === 'collections'
    || normalized === 'categories'
    || normalized === 'category ids'
    || normalized === 'category_ids';
}

function getAirtableErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

function getAirtableErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined;

  const response = (error as {
    response?: {
      data?: {
        error?: {
          message?: string;
        };
      };
    };
  }).response;

  return response?.data?.error?.message;
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  records: [],
  loading: true,
  saving: false,
  error: null,
  listingFormatOptions: FALLBACK_LISTING_FORMAT_OPTIONS,
  formValues: {},
  fieldKinds: {},

  setFormValue(fieldName, value) {
    set((state) => ({ formValues: { ...state.formValues, [fieldName]: value } }));
  },

  hydrateForm(record, allFieldNames, _approvedFieldName) {
    const nextValues: Record<string, string> = {};
    const nextKinds: Record<string, ApprovalFieldKind> = {};

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
  },

  async loadRecords(tableReference, tableName) {
    set({ loading: true, error: null });
    try {
      const data = await airtableService.getRecordsFromReference(tableReference, tableName);
      set({ records: data });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load listing records' });
    } finally {
      set({ loading: false });
    }
  },

  async loadListingFormatOptions() {
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
    } catch {
      set({ listingFormatOptions: FALLBACK_LISTING_FORMAT_OPTIONS });
    }
  },

  async saveRecord(forceApproved, selectedRecord, tableReference, tableName, approvedFieldName, onSuccess, mode = 'full') {
    set({ saving: true, error: null });
    try {
      const { formValues, fieldKinds } = get();
      const resolvedApprovedFieldName = Object.keys(selectedRecord.fields)
        .find((fieldName) => fieldName.toLowerCase() === approvedFieldName.toLowerCase())
        ?? approvedFieldName;
      const approvedFieldKind = fieldKinds[resolvedApprovedFieldName]
        ?? inferFieldKind(selectedRecord.fields[resolvedApprovedFieldName]);
      const currentApprovedValue = formValues[resolvedApprovedFieldName]
        ?? toFormValue(selectedRecord.fields[resolvedApprovedFieldName]);
      const nextValues = {
        ...formValues,
        [resolvedApprovedFieldName]: forceApproved
          ? resolveApprovedValue(currentApprovedValue, approvedFieldKind)
          : currentApprovedValue,
      };

      const conditionValue = nextValues[CONDITION_FIELD]?.trim();
      if (conditionValue) {
        const mirrorField = resolveConditionMirrorField(Object.keys(selectedRecord.fields));
        if (mirrorField) {
          nextValues[mirrorField] = conditionValue;
        }
      }

      const mappedValues = mapShippingServiceToFields(nextValues);
      const payload: Record<string, unknown> = {};

      if (mode === 'approve-only') {
        payload[resolvedApprovedFieldName] = fromFormValue(
          nextValues[resolvedApprovedFieldName] ?? resolveApprovedValue(currentApprovedValue, approvedFieldKind),
          approvedFieldKind,
        );
      } else {

        Object.entries(mappedValues).forEach(([fieldName, rawValue]) => {
          if (fieldName === SHIPPING_SERVICE_FIELD) return;
          if (fieldName === CONDITION_FIELD) return;
          const existsOnRecord = Object.prototype.hasOwnProperty.call(selectedRecord.fields, fieldName);
          const allowMissingWritableField = isAllowedMissingWritableFieldName(fieldName);
          if (!existsOnRecord && !allowMissingWritableField) return;

          // Only send fields whose values have changed from the original record.
          // This prevents sending formula/lookup/computed fields back to Airtable,
          // which rejects them with 422. The approved field is always sent.
          const originalValue = toFormValue(selectedRecord.fields[fieldName]);
          if (fieldName.toLowerCase() === resolvedApprovedFieldName.toLowerCase() && forceApproved) return;
          if (rawValue === originalValue) return;

          const fieldKind = fieldKinds[fieldName] ?? 'text';
          payload[fieldName] = fromFormValue(rawValue, fieldKind);
        });
      }

      if (Object.keys(payload).length > 0) {
        const shouldTypecast = Object.keys(payload).some(
          (fieldName) => isTagLikeFieldName(fieldName) || isCollectionLikeFieldName(fieldName),
        );
        try {
          await airtableService.updateRecordFromReference(
            tableReference,
            tableName,
            selectedRecord.id,
            payload,
            shouldTypecast ? { typecast: true } : undefined,
          );
        } catch (error) {
          const status = getAirtableErrorStatus(error);
          if (mode === 'full' && status === 422) {
            const updatedFields: string[] = [];
            const skippedFields: Array<{ name: string; reason?: string }> = [];

            for (const [fieldName, fieldValue] of Object.entries(payload)) {
              const singleFieldPayload = { [fieldName]: fieldValue };
              const shouldTypecastSingle =
                isTagLikeFieldName(fieldName) || isCollectionLikeFieldName(fieldName);

              try {
                await airtableService.updateRecordFromReference(
                  tableReference,
                  tableName,
                  selectedRecord.id,
                  singleFieldPayload,
                  shouldTypecastSingle ? { typecast: true } : undefined,
                );
                updatedFields.push(fieldName);
              } catch (singleFieldError) {
                const singleFieldStatus = getAirtableErrorStatus(singleFieldError);
                if (singleFieldStatus !== 422) {
                  throw singleFieldError;
                }

                skippedFields.push({
                  name: fieldName,
                  reason: getAirtableErrorMessage(singleFieldError),
                });
              }
            }

            logServiceInfo(
              'airtable',
              `Partial save for record ${selectedRecord.id}: updated ${updatedFields.length} fields, skipped ${skippedFields.length} invalid fields`,
              {
                updatedFields,
                skippedFields,
              },
            );

            if (updatedFields.length === 0 && skippedFields.length === 0) {
              throw error;
            }
          }
          if (!(mode === 'approve-only' && status === 422)) {
            if (!(mode === 'full' && status === 422)) {
              throw error;
            }
          }
        }

        await get().loadRecords(tableReference, tableName);
      }

      onSuccess();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save listing record';
      set({ error: message });
      return false;
    } finally {
      set({ saving: false });
    }
  },
}));
