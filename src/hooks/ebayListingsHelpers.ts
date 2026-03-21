import {
  getInventoryItems,
  getOffersForInventorySkus,
  isValidEbaySku,
  type EbayInventoryItem,
  type EbayOffer,
  type EbayOfferPage,
} from '@/services/ebay';

export interface EbayPublishedListing {
  item: EbayInventoryItem;
  offer: EbayOffer;
}

export interface EbayListingsSnapshot {
  inventoryItems: EbayInventoryItem[];
  offers: EbayOffer[];
  recentListings: EbayPublishedListing[];
  total: number;
  warning: string | null;
}

export const MAX_VISIBLE_LISTINGS = 20;

function statusRank(status?: EbayOffer['status']): number {
  if (status === 'UNPUBLISHED') return 0;
  if (status === 'PUBLISHED') return 1;
  return 2;
}

function offerRecencyRank(offer: EbayOffer): number {
  const numericId = Number(offer.listingId ?? offer.offerId ?? 0);
  return Number.isFinite(numericId) ? numericId : 0;
}

function buildPublishedListings(items: EbayInventoryItem[], offers: EbayOffer[]): EbayPublishedListing[] {
  const itemBySku = new Map(items.map(item => [item.sku, item]));

  return offers
    .filter(offer => offer.status === 'PUBLISHED')
    .map(offer => {
      const item = itemBySku.get(offer.sku);
      return item ? { item, offer } : null;
    })
    .filter((listing): listing is EbayPublishedListing => listing !== null)
    .sort((a, b) => offerRecencyRank(b.offer) - offerRecencyRank(a.offer))
    .slice(0, MAX_VISIBLE_LISTINGS);
}

async function loadOffersPage(items: EbayInventoryItem[]): Promise<{ offersPage: EbayOfferPage; warning: string | null }> {
  try {
    return {
      offersPage: await getOffersForInventorySkus(items.map(item => item.sku)),
      warning: null,
    };
  } catch {
    return {
      offersPage: await getOffersForInventorySkus(items.map(item => item.sku)),
      warning: 'Loaded inventory. Some eBay offer details were skipped because at least one legacy SKU is invalid.',
    };
  }
}

function buildVisibleInventoryItems(items: EbayInventoryItem[], offers: EbayOffer[]): EbayInventoryItem[] {
  const offerBySku = new Map(offers.map(offer => [offer.sku, offer]));

  return [...items]
    .sort((a, b) => statusRank(offerBySku.get(a.sku)?.status) - statusRank(offerBySku.get(b.sku)?.status))
    .filter(item => isValidEbaySku(item.sku));
}

export async function loadEbayListingsSnapshot(): Promise<EbayListingsSnapshot> {
  const itemsPage = await getInventoryItems(100);
  const { offersPage, warning } = await loadOffersPage(itemsPage.inventoryItems);
  const visibleItems = buildVisibleInventoryItems(itemsPage.inventoryItems, offersPage.offers);

  return {
    inventoryItems: visibleItems.slice(0, MAX_VISIBLE_LISTINGS),
    offers: offersPage.offers,
    recentListings: buildPublishedListings(visibleItems, offersPage.offers),
    total: visibleItems.length,
    warning,
  };
}

export function isEbayAuthError(error: unknown): error is Error & { code?: string } {
  const ebayError = error as Error & { code?: string };
  return ebayError.code === 'auth_required' || ebayError.code === 'invalid_grant';
}