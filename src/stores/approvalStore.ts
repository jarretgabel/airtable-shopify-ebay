import { create } from 'zustand';
import airtableService from '@/services/airtable';
import { getInventoryItems, getOffersForInventorySkus } from '@/services/ebay';
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
      const hasApprovedField = Object.prototype.hasOwnProperty.call(selectedRecord.fields, resolvedApprovedFieldName);
      const approvedFieldKind = fieldKinds[resolvedApprovedFieldName]
        ?? inferFieldKind(selectedRecord.fields[resolvedApprovedFieldName]);
      const currentApprovedValue = formValues[resolvedApprovedFieldName]
        ?? toFormValue(selectedRecord.fields[resolvedApprovedFieldName]);
      const nextValues = {
        ...formValues,
        ...(hasApprovedField
          ? {
              [resolvedApprovedFieldName]: forceApproved
                ? resolveApprovedValue(currentApprovedValue, approvedFieldKind)
                : currentApprovedValue,
            }
          : {}),
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
        if (hasApprovedField) {
          payload[resolvedApprovedFieldName] = fromFormValue(
            nextValues[resolvedApprovedFieldName] ?? resolveApprovedValue(currentApprovedValue, approvedFieldKind),
            approvedFieldKind,
          );
        }
      } else {

        Object.entries(mappedValues).forEach(([fieldName, rawValue]) => {
          if (fieldName === SHIPPING_SERVICE_FIELD) return;
          if (fieldName === CONDITION_FIELD) return;
          if (!Object.prototype.hasOwnProperty.call(selectedRecord.fields, fieldName)) return;

          // Only send fields whose values have changed from the original record.
          // This prevents sending formula/lookup/computed fields back to Airtable,
          // which rejects them with 422. The approved field is always sent.
          if (!hasApprovedField && fieldName.toLowerCase() === resolvedApprovedFieldName.toLowerCase()) return;
          const originalValue = toFormValue(selectedRecord.fields[fieldName]);
          if (!(hasApprovedField && fieldName.toLowerCase() === resolvedApprovedFieldName.toLowerCase()) && rawValue === originalValue) return;

          const fieldKind = fieldKinds[fieldName] ?? 'text';
          payload[fieldName] = fromFormValue(rawValue, fieldKind);
        });
      }

      if (Object.keys(payload).length > 0) {
        const shouldTypecast = Object.keys(payload).some((fieldName) => isTagLikeFieldName(fieldName));
        try {
          await airtableService.updateRecordFromReference(
            tableReference,
            tableName,
            selectedRecord.id,
            payload,
            shouldTypecast ? { typecast: true } : undefined,
          );
        } catch (error) {
          const status = typeof error === 'object' && error !== null && 'response' in error
            ? (error as { response?: { status?: number } }).response?.status
            : undefined;

          // Some approval tables expose an "Approved"-like field that is computed or
          // type-restricted and not writable. For approve-only mode, do not block UX.
          if (!(mode === 'approve-only' && status === 422)) {
            throw error;
          }
        }

        await get().loadRecords(tableReference, tableName);
      }

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save listing record';
      set({ error: message });
    } finally {
      set({ saving: false });
    }
  },
}));
