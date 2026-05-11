import { buildEbayDraftPayloadBundleFromApprovalFields } from '@/services/ebayDraftFromAirtable';
import type { EbayInventoryItem, EbayOffer, EbayPublishedListing } from '@/services/ebay/types';
import type { AirtableRecord } from '@/types/airtable';

interface EbayDraftOfferPricingSummary {
  price?: { value: string; currency: string };
  auctionStartPrice?: { value: string; currency: string };
}

interface EbayDraftOfferPayload extends Record<string, unknown> {
  sku?: string;
  marketplaceId?: string;
  format?: string;
  availableQuantity?: number;
  categoryId?: string;
  listingDescription?: string;
  listingDuration?: string;
  pricingSummary?: EbayDraftOfferPricingSummary;
  includeCatalogProductDetails?: boolean;
}

export interface EbayAirtableSnapshot {
  items: EbayInventoryItem[];
  offers: EbayOffer[];
  recentListings: EbayPublishedListing[];
  total: number;
}

const DEFAULT_SKU = 'SAMPLE-SKU';
const DEFAULT_TITLE = 'Untitled Listing';

function getStringField(fields: Record<string, unknown>, fieldNames: string[]): string | undefined {
  for (const fieldName of fieldNames) {
    const value = fields[fieldName];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getBooleanField(fields: Record<string, unknown>, fieldNames: string[]): boolean | undefined {
  for (const fieldName of fieldNames) {
    const value = fields[fieldName];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === 'yes') return true;
      if (normalized === 'false' || normalized === 'no') return false;
    }
  }

  return undefined;
}

function hasEbayFieldHints(fields: Record<string, unknown>): boolean {
  return Object.keys(fields).some((fieldName) => fieldName.toLowerCase().includes('ebay'));
}

function normalizeOfferStatus(rawStatus: string | undefined, listingId: string | undefined): EbayOffer['status'] {
  if (!rawStatus) {
    return listingId ? 'PUBLISHED' : 'UNPUBLISHED';
  }

  const normalized = rawStatus.trim().toUpperCase().replace(/[\s-]+/g, '_');

  if (normalized.includes('PUBLISHED') || normalized.includes('ACTIVE') || normalized.includes('LIVE') || normalized.includes('LISTED')) {
    return 'PUBLISHED';
  }

  if (normalized.includes('ENDED') || normalized.includes('END') || normalized.includes('CANCEL') || normalized.includes('SOLD')) {
    return 'ENDED';
  }

  if (normalized.includes('UNPUBLISHED') || normalized.includes('DRAFT') || normalized.includes('PENDING') || normalized.includes('READY')) {
    return 'UNPUBLISHED';
  }

  return listingId ? 'PUBLISHED' : 'UNPUBLISHED';
}

function isMeaningfulEbaySnapshot(fields: Record<string, unknown>, item: EbayInventoryItem): boolean {
  const title = item.product?.title?.trim();
  const sku = item.sku.trim();

  return hasEbayFieldHints(fields) || sku !== DEFAULT_SKU || Boolean(title && title !== DEFAULT_TITLE);
}

function buildSnapshotEntry(record: AirtableRecord): {
  item: EbayInventoryItem;
  offer: EbayOffer;
  recentListing: EbayPublishedListing | null;
} | null {
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields(record.fields);
  const draftItem = bundle.inventoryItem as unknown as EbayInventoryItem;
  const draftOffer = bundle.offer as EbayDraftOfferPayload;
  const listingId = getStringField(record.fields, ['eBay Listing ID', 'eBay Item ID', 'Listing ID', 'Item ID']);
  const offerId = getStringField(record.fields, ['eBay Offer ID', 'Offer ID']);
  const rawStatus = getStringField(record.fields, ['eBay Offer Status', 'eBay Listing Status', 'Status']);
  const status = normalizeOfferStatus(rawStatus, listingId);

  const item: EbayInventoryItem = {
    ...draftItem,
    snapshotId: record.id,
    sourceRecordId: record.id,
  };

  if (!isMeaningfulEbaySnapshot(record.fields, item)) {
    return null;
  }

  const offer: EbayOffer = {
    sku: draftOffer.sku ?? item.sku,
    snapshotId: record.id,
    sourceRecordId: record.id,
    offerId,
    status,
    listingId,
    availableQuantity: draftOffer.availableQuantity,
    format: draftOffer.format,
    marketplaceId: draftOffer.marketplaceId,
    categoryId: draftOffer.categoryId,
    listingDescription: draftOffer.listingDescription,
    listingDuration: draftOffer.listingDuration,
    merchantLocationKey: getStringField(record.fields, ['eBay Offer Merchant Location Key', 'Merchant Location Key']),
    includeCatalogProductDetails: getBooleanField(record.fields, ['eBay Offer Include Catalog Product Details']) ?? draftOffer.includeCatalogProductDetails,
    pricingSummary: draftOffer.pricingSummary?.price || draftOffer.pricingSummary?.auctionStartPrice
      ? { price: draftOffer.pricingSummary?.price ?? draftOffer.pricingSummary?.auctionStartPrice }
      : undefined,
    listingPolicies: {
      fulfillmentPolicyId: getStringField(record.fields, ['eBay Offer Fulfillment Policy ID']),
      paymentPolicyId: getStringField(record.fields, ['eBay Offer Payment Policy ID']),
      returnPolicyId: getStringField(record.fields, ['eBay Offer Return Policy ID']),
    },
  };

  return {
    item,
    offer,
    recentListing: status === 'PUBLISHED' ? { item, offer } : null,
  };
}

export function buildEbaySnapshotFromAirtable(records: AirtableRecord[]): EbayAirtableSnapshot {
  const entries = records
    .map((record) => buildSnapshotEntry(record))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return {
    items: entries.map((entry) => entry.item),
    offers: entries.map((entry) => entry.offer),
    recentListings: entries.flatMap((entry) => (entry.recentListing ? [entry.recentListing] : [])),
    total: entries.length,
  };
}