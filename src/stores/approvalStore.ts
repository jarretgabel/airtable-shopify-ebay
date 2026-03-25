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

function isCategoryLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'categories'
    || normalized === 'category'
    || normalized === 'category ids'
    || normalized === 'category id'
    || normalized === 'category_ids'
    || normalized === 'category_id'
    || normalized === 'primary category'
    || normalized === 'secondary category'
    || normalized === 'primary category id'
    || normalized === 'secondary category id'
    || normalized === 'primary_category'
    || normalized === 'secondary_category'
    || normalized === 'primary_category_id'
    || normalized === 'secondary_category_id'
    || normalized === 'ebay offer category id'
    || normalized === 'ebay offer secondary category id'
    || normalized === 'ebay_offer_category_id'
    || normalized === 'ebay_offer_secondary_category_id'
    || normalized === 'ebay_offer_categoryid'
    || normalized === 'ebay_offer_secondarycategoryid';
}

function isPriceLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized === 'buy it now/starting bid'
    || normalized === 'ebay offer price value'
    || normalized === 'ebay offer auction start price value'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'price';
}

function toNumericRetryValues(value: unknown): unknown[] {
  const asString = String(value ?? '').trim();
  if (!asString) return [];

  const cleaned = asString
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .trim();

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return [];

  const rounded2 = Math.round(parsed * 100) / 100;
  const fixed2 = rounded2.toFixed(2);

  return [rounded2, fixed2];
}

function getPriceFieldRetryNames(fieldName: string): string[] {
  const candidates = [
    fieldName,
    'Buy It Now/Starting Price',
    'Buy It Now / Starting Price',
    'Buy It Now/Starting Bid',
    'eBay Offer Price Value',
    'eBay Offer Auction Start Price Value',
    'Buy It Now USD',
    'Starting Bid USD',
    'Price',
  ];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toCategoryTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0);
  }

  const raw = typeof value === 'string' ? value : String(value ?? '');
  if (!raw.trim()) return [];

  const tokens = raw
    .split(/[\n,;|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const seen = new Set<string>();
  return tokens.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCategoryRetryValues(value: unknown, originalValue: unknown): unknown[] {
  const tokens = toCategoryTokens(value);
  const fallbackValues: unknown[] = [];

  const pushUnique = (candidate: unknown) => {
    const key = JSON.stringify(candidate);
    if (fallbackValues.some((existing) => JSON.stringify(existing) === key)) return;
    fallbackValues.push(candidate);
  };

  pushUnique(value);

  if (tokens.length > 0) {
    pushUnique(tokens.join(', '));
    pushUnique(tokens);
    pushUnique(tokens.map((token) => ({ name: token })));
    pushUnique(tokens[0]);
    pushUnique([{ name: tokens[0] }]);

    const recordIdTokens = tokens.filter((token) => /^rec[a-zA-Z0-9]{14,}$/.test(token));
    if (recordIdTokens.length > 0) {
      pushUnique(recordIdTokens);
      pushUnique(recordIdTokens.map((token) => ({ id: token })));
      pushUnique([{ id: recordIdTokens[0] }]);
    }

    if (/^\d+$/.test(tokens[0])) {
      pushUnique(Number(tokens[0]));
    }
  }

  if (Array.isArray(originalValue) && tokens.length > 0) {
    pushUnique(tokens);
  }
  if (typeof originalValue === 'number' && tokens.length > 0 && /^\d+$/.test(tokens[0])) {
    pushUnique(Number(tokens[0]));
  }
  if (typeof originalValue === 'string' && tokens.length > 0) {
    pushUnique(tokens.join(', '));
  }

  return fallbackValues;
}

function isAllowedMissingWritableFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return isTagLikeFieldName(fieldName)
    || normalized === 'collections'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized === 'buy it now/starting bid'
    || normalized === 'ebay offer price value'
    || normalized === 'ebay offer auction start price value'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'ebay body html'
    || normalized === 'ebay_body_html'
    || normalized === 'categories'
    || normalized === 'category ids'
    || normalized === 'category_ids'
    || normalized === 'primary category'
    || normalized === 'secondary category'
    || normalized === 'primary category id'
    || normalized === 'secondary category id'
    || normalized === 'primary_category'
    || normalized === 'secondary_category'
    || normalized === 'primary_category_id'
    || normalized === 'secondary_category_id'
    || normalized === 'ebay offer category id'
    || normalized === 'ebay offer secondary category id'
    || normalized === 'ebay_offer_category_id'
    || normalized === 'ebay_offer_secondary_category_id'
    || normalized === 'ebay_offer_categoryid'
    || normalized === 'ebay_offer_secondarycategoryid';
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

function isLikelyComputedAirtableField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('(from ')
    || normalized.includes('(lookup')
    || normalized.includes('(rollup')
    || normalized.includes('(formula');
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

  async saveRecord(forceApproved, selectedRecord, tableReference, tableName, actualFieldNames, approvedFieldName, onSuccess, mode = 'full') {
    set({ saving: true, error: null });
    try {
      const { formValues, fieldKinds } = get();
      const actualFieldLookup = new Set(actualFieldNames.map((fieldName) => fieldName.toLowerCase()));
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
          if (isLikelyComputedAirtableField(fieldName)) return;
          const existsOnRecord = Object.prototype.hasOwnProperty.call(selectedRecord.fields, fieldName);
          const existsInSchema = actualFieldLookup.has(fieldName.toLowerCase());
          const allowMissingWritableField = isAllowedMissingWritableFieldName(fieldName);
          if (!existsOnRecord && !existsInSchema && !allowMissingWritableField) return;

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
        if (mode === 'full') {
          const updatedFields: string[] = [];
          const skippedFields: Array<{ name: string; reason?: string }> = [];

          for (const [fieldName, fieldValue] of Object.entries(payload)) {
            const singleFieldPayload = { [fieldName]: fieldValue };
            const shouldTypecastSingle =
              isTagLikeFieldName(fieldName)
              || isCollectionLikeFieldName(fieldName)
              || isCategoryLikeFieldName(fieldName)
              || isPriceLikeFieldName(fieldName);

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

              if (isCategoryLikeFieldName(fieldName)) {
                const originalValue = selectedRecord.fields[fieldName];
                const retryValues = buildCategoryRetryValues(fieldValue, originalValue);
                let retrySucceeded = false;

                for (const retryValue of retryValues) {
                  try {
                    await airtableService.updateRecordFromReference(
                      tableReference,
                      tableName,
                      selectedRecord.id,
                      { [fieldName]: retryValue },
                      { typecast: true },
                    );
                    retrySucceeded = true;
                    updatedFields.push(fieldName);
                    break;
                  } catch (retryError) {
                    const retryStatus = getAirtableErrorStatus(retryError);
                    if (retryStatus !== 422) {
                      throw retryError;
                    }
                  }
                }

                if (retrySucceeded) {
                  continue;
                }
              }

              if (isPriceLikeFieldName(fieldName)) {
                const retryValues = toNumericRetryValues(fieldValue);
                let retrySucceeded = false;
                const retryFieldNames = getPriceFieldRetryNames(fieldName);

                for (const retryFieldName of retryFieldNames) {
                  for (const retryValue of retryValues) {
                    try {
                      await airtableService.updateRecordFromReference(
                        tableReference,
                        tableName,
                        selectedRecord.id,
                        { [retryFieldName]: retryValue },
                        { typecast: true },
                      );
                      retrySucceeded = true;
                      updatedFields.push(retryFieldName);
                      break;
                    } catch (retryError) {
                      const retryStatus = getAirtableErrorStatus(retryError);
                      if (retryStatus !== 422) {
                        throw retryError;
                      }
                    }
                  }

                  if (retrySucceeded) {
                    break;
                  }
                }

                if (retrySucceeded) {
                  continue;
                }
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

          if (skippedFields.length > 0) {
            const categorySkipMessages = skippedFields
              .filter((field) => isCategoryLikeFieldName(field.name))
              .map((field) => `${field.name}: ${field.reason ?? 'Airtable rejected the value shape'}`);

            if (categorySkipMessages.length > 0) {
              throw new Error(`Failed to save category fields. ${categorySkipMessages.join(' | ')}`);
            }
          }

          if (updatedFields.length === 0 && skippedFields.length === 0) {
            throw new Error('No Airtable fields were updated.');
          }
        } else {
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
            if (!(mode === 'approve-only' && status === 422)) {
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
