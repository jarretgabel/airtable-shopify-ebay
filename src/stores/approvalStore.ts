import { create } from 'zustand';
import { createLoadListingFormatOptionsAction, createLoadRecordsAction, createHydrateFormAction, createSetFormValueAction } from '@/stores/approval/approvalStoreRecordState';
import { createSaveRecordAction } from '@/stores/approval/approvalStorePersistence';
import {
  FALLBACK_LISTING_FORMAT_OPTIONS,
  EBAY_LISTING_DURATION_OPTIONS,
} from '@/stores/approval/approvalStoreConstants';
import {
  resolveListingDurationOptions,
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
  resolveListingDurationOptions,
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
  listingDurationOptions: resolveListingDurationOptions(EBAY_LISTING_DURATION_OPTIONS),
  formValues: {},
  fieldKinds: {},
  setFormValue: createSetFormValueAction(set),
  hydrateForm: createHydrateFormAction(set),
  loadRecords: createLoadRecordsAction(set, get),
  loadListingFormatOptions: createLoadListingFormatOptionsAction(set),
  saveRecord: createSaveRecordAction(set, get),
}));
