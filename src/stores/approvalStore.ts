import { create } from 'zustand';
import airtableService from '@/services/airtable';
import { getOffers } from '@/services/ebay';
import {
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

  hydrateForm(record, allFieldNames, approvedFieldName) {
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

    if (!nextValues[approvedFieldName]) {
      nextValues[approvedFieldName] = 'false';
      nextKinds[approvedFieldName] = 'boolean';
    }

    set({ formValues: nextValues, fieldKinds: nextKinds });
  },

  async loadRecords(tableReference, fallbackTableName) {
    set({ loading: true, error: null });
    try {
      const data = await airtableService.getRecordsFromReference(tableReference, fallbackTableName);
      set({ records: data });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load listing records' });
    } finally {
      set({ loading: false });
    }
  },

  async loadListingFormatOptions() {
    try {
      const offersPage = await getOffers(undefined, 100);
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

  async saveRecord(forceApproved, selectedRecord, tableReference, fallbackTableName, approvedFieldName, onSuccess) {
    set({ saving: true, error: null });
    try {
      const { formValues, fieldKinds } = get();
      const nextValues = {
        ...formValues,
        [approvedFieldName]: forceApproved ? 'true' : (formValues[approvedFieldName] || 'false'),
      };

      const mappedValues = mapShippingServiceToFields(nextValues);
      const payload: Record<string, unknown> = {};

      Object.entries(mappedValues).forEach(([fieldName, rawValue]) => {
        if (fieldName === SHIPPING_SERVICE_FIELD) return;
        const fieldKind = fieldKinds[fieldName] ?? 'text';
        payload[fieldName] = fromFormValue(rawValue, fieldKind);
      });

      await airtableService.updateRecordFromReference(
        tableReference,
        fallbackTableName,
        selectedRecord.id,
        payload,
      );

      await get().loadRecords(tableReference, fallbackTableName);
      onSuccess();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to save listing record' });
    } finally {
      set({ saving: false });
    }
  },
}));
