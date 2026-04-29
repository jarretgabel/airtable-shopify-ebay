import type {
  EbayPublishSetup,
  EbayApprovalPushResult,
  EbayCategorySuggestion,
  EbayCategoryTreeNode,
  EbayDashboardSnapshot,
  EbayInventoryPage,
  EbayListingApiMode,
  EbayOfferDetails,
  EbayOfferPage,
  EbayRuntimeConfig,
  EbaySampleListingResult,
  EbayUploadedImageResult,
} from '@/services/ebay/types';
import type { EbayApprovalPreviewResult } from '@contracts/ebayApproval';
import type { EbayDraftPayloadBundle } from '@/services/ebayDraftFromAirtable';
import type { AirtableConfiguredRecordsSource } from './airtableSources';
import { isAppApiHttpError } from './errors';
import { getJson, postJson } from './http';

export type { EbayApprovalPreviewResult } from '@contracts/ebayApproval';

function toEbayError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export type {
  EbayApprovalPushResult,
  EbayCategorySuggestion,
  EbayCategoryTreeNode,
  EbayDashboardSnapshot,
  EbayInventoryPage,
  EbayListingApiMode,
  EbayOfferDetails,
  EbayOfferPage,
  EbayPublishSetup,
  EbayRuntimeConfig,
  EbaySampleListingResult,
  EbayUploadedImageResult,
} from '@/services/ebay/types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(`Unable to read ${file.name}.`));
        return;
      }

      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export async function getInventoryItems(limit = 25): Promise<EbayInventoryPage> {
  try {
    return await getJson<EbayInventoryPage>('/api/ebay/inventory-items', { limit });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getOffers(sku?: string, limit = 25): Promise<EbayOfferPage> {
  try {
    return await getJson<EbayOfferPage>('/api/ebay/offers', { sku, limit });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getOffer(offerId: string): Promise<EbayOfferDetails> {
  try {
    return await getJson<EbayOfferDetails>(`/api/ebay/offers/${encodeURIComponent(offerId)}`);
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getOffersForInventorySkus(skus: string[]): Promise<EbayOfferPage> {
  try {
    return await postJson<EbayOfferPage>('/api/ebay/offers/by-skus', { skus });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function searchEbayCategorySuggestions(
  query: string,
  marketplaceId = 'EBAY_US',
): Promise<EbayCategorySuggestion[]> {
  try {
    return await getJson<EbayCategorySuggestion[]>('/api/ebay/taxonomy/suggestions', {
      query,
      marketplaceId,
    });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getEbayRootCategories(marketplaceId = 'EBAY_US'): Promise<EbayCategoryTreeNode[]> {
  try {
    return await getJson<EbayCategoryTreeNode[]>('/api/ebay/taxonomy/root-categories', { marketplaceId });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getEbayChildCategories(
  parentCategoryId: string,
  marketplaceId = 'EBAY_US',
): Promise<EbayCategoryTreeNode[]> {
  try {
    return await getJson<EbayCategoryTreeNode[]>('/api/ebay/taxonomy/child-categories', {
      parentCategoryId,
      marketplaceId,
    });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getEbayPackageTypes(marketplaceId = 'EBAY_US'): Promise<string[]> {
  try {
    return await getJson<string[]>('/api/ebay/package-types', { marketplaceId });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function createSampleListing(
  mode: EbayListingApiMode,
  publishSetup?: EbayPublishSetup,
): Promise<EbaySampleListingResult> {
  try {
    return await postJson<EbaySampleListingResult>('/api/ebay/sample-listings', { mode, publishSetup });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function publishSampleDraftListing(
  publishSetup?: EbayPublishSetup,
): Promise<{ sku: string; offerId: string; listingId: string }> {
  try {
    return await postJson<{ sku: string; offerId: string; listingId: string }>('/api/ebay/sample-listings/publish', {
      publishSetup,
    });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function pushApprovalBundleToEbay(
  bundle: EbayDraftPayloadBundle,
  publishSetup?: EbayPublishSetup,
): Promise<EbayApprovalPushResult> {
  try {
    return await postJson<EbayApprovalPushResult>('/api/ebay/approval-listings/publish', {
      bundle,
      publishSetup,
    });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function publishApprovalRecordToEbay(
  source: AirtableConfiguredRecordsSource,
  recordId: string,
  publishSetup?: EbayPublishSetup,
): Promise<EbayApprovalPushResult> {
  try {
    return await postJson<EbayApprovalPushResult>('/api/ebay/approval-listings/publish', {
      source,
      recordId,
      publishSetup,
    });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getEbayApprovalPreview(
  fields: Record<string, unknown>,
  bodyPreview?: {
    templateHtml: string;
    title: string;
    description: string;
    keyFeatures: string;
    testingNotes?: string;
    fieldName?: string;
  },
): Promise<EbayApprovalPreviewResult> {
  try {
    return await postJson<EbayApprovalPreviewResult>('/api/ebay/approval-listings/preview', {
      fields,
      bodyPreview,
    });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function uploadImageToEbayHostedPictures(file: File): Promise<EbayUploadedImageResult> {
  try {
    const base64 = await fileToBase64(file);
    return await postJson<EbayUploadedImageResult>('/api/ebay/images', {
      filename: file.name,
      mimeType: file.type || 'image/jpeg',
      file: base64,
    });
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getEbayRuntimeConfig(): Promise<EbayRuntimeConfig> {
  try {
    return await getJson<EbayRuntimeConfig>('/api/ebay/runtime-config');
  } catch (error) {
    throw toEbayError(error);
  }
}

export async function getEbayDashboardSnapshot(): Promise<EbayDashboardSnapshot> {
  try {
    return await getJson<EbayDashboardSnapshot>('/api/ebay/dashboard-snapshot');
  } catch (error) {
    throw toEbayError(error);
  }
}