import { getConfiguredRecord, type AirtableConfiguredRecordsSource } from '../airtable/sources.js';
import {
  buildEbayDraftPayloadBundleFromApprovalFields,
} from '../ebay/approvalDraft.js';
import { pushApprovalBundleToEbay, type EbayPublishSetup } from '../ebay/client.js';
import type {
  ApprovalPublishExecutionResult,
  ApprovalPublishRequest as ExecuteApprovalPublishParams,
  ApprovalPublishTarget,
} from '../../shared/contracts/approval.js';
import { normalizeApprovalFields } from './normalize.js';
import {
  publishApprovalListingToShopify,
} from '../shopify/approvalPublish.js';

interface ExecuteApprovalPublishDependencies {
  publishApprovalListingToShopify: typeof publishApprovalListingToShopify;
  getConfiguredRecord: typeof getConfiguredRecord;
  normalizeApprovalFields: typeof normalizeApprovalFields;
  buildEbayDraftPayloadBundleFromApprovalFields: typeof buildEbayDraftPayloadBundleFromApprovalFields;
  pushApprovalBundleToEbay: typeof pushApprovalBundleToEbay;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function executeApprovalPublish(
  params: ExecuteApprovalPublishParams,
  dependencies: ExecuteApprovalPublishDependencies = {
    publishApprovalListingToShopify,
    getConfiguredRecord,
    normalizeApprovalFields,
    buildEbayDraftPayloadBundleFromApprovalFields,
    pushApprovalBundleToEbay,
  },
): Promise<ApprovalPublishExecutionResult> {
  const result: ApprovalPublishExecutionResult = {
    target: params.target,
    failures: [],
  };

  let resolvedFieldsPromise: Promise<Record<string, unknown>> | null = null;
  let normalizedPromise: Promise<Awaited<ReturnType<typeof normalizeApprovalFields>> | null> | null = null;

  const getResolvedFields = async (): Promise<Record<string, unknown>> => {
    if (!resolvedFieldsPromise) {
      resolvedFieldsPromise = dependencies.getConfiguredRecord(params.source, params.recordId).then((record) => ({
        ...((record.fields ?? {}) as Record<string, unknown>),
        ...(params.fields ?? {}),
      }));
    }

    return resolvedFieldsPromise;
  };

  const getNormalizedResult = async () => {
    if (!normalizedPromise) {
      normalizedPromise = getResolvedFields()
        .then((fields) => dependencies.normalizeApprovalFields({
          target: params.target,
          fields,
        }))
        .catch(() => null);
    }

    return normalizedPromise;
  };

  if (params.target === 'shopify' || params.target === 'both') {
    try {
      const [fields, normalized] = await Promise.all([getResolvedFields(), getNormalizedResult()]);
      result.shopify = await dependencies.publishApprovalListingToShopify({
        source: params.source,
        recordId: params.recordId,
        productIdFieldName: params.productIdFieldName,
        fields,
        preview: normalized?.shopify,
      });
    } catch (error) {
      result.failures.push({
        target: 'shopify',
        message: toMessage(error),
      });
    }
  }

  if (params.target === 'ebay' || params.target === 'both') {
    try {
      const [resolvedFields, normalized] = await Promise.all([getResolvedFields(), getNormalizedResult()]);
      const bundle = normalized?.ebay?.draftPayloadBundle ?? dependencies.buildEbayDraftPayloadBundleFromApprovalFields(resolvedFields);
      const ebayResult = await dependencies.pushApprovalBundleToEbay({
        inventoryItem: bundle.inventoryItem,
        offer: bundle.offer,
      }, params.publishSetup);
      result.ebay = {
        ...ebayResult,
        mode: ebayResult.wasExistingOffer ? 'updated' : 'created',
      };
    } catch (error) {
      result.failures.push({
        target: 'ebay',
        message: toMessage(error),
      });
    }
  }

  return result;
}