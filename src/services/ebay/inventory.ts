/**
 * eBay Inventory/Sell API — read operations (items, offers, public listings).
 */
import type { EbayInventoryPage, EbayOffer, EbayOfferDetails, EbayOfferPage, EbayPublicListing } from './types';
import { isValidEbaySku } from './types';
import { API, getSellerUsername } from './config';
import { getValidUserToken } from './token';

const EBAY_OFFERS_MAX_PAGE_SIZE = 25;

function normalizeOfferLimit(limit: number): number {
  if (!Number.isFinite(limit)) return EBAY_OFFERS_MAX_PAGE_SIZE;
  return Math.max(1, Math.floor(limit));
}

function toProxyApiPath(pathOrUrl: string): string {
  if (pathOrUrl.startsWith(API)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `${API}${pathOrUrl}`;
  try {
    const parsed = new URL(pathOrUrl);
    return `${API}${parsed.pathname}${parsed.search}`;
  } catch {
    return `${API}${pathOrUrl}`;
  }
}

// ─── Inventory items ──────────────────────────────────────────────────────────

/** Fetch all inventory items for the authenticated seller. */
export async function getInventoryItems(limit = 25): Promise<EbayInventoryPage> {
  const token = await getValidUserToken();
  const res = await fetch(`${API}/sell/inventory/v1/inventory_item?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`getInventoryItems ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as {
    inventoryItems?: EbayInventoryPage['inventoryItems'];
    total?: number;
    href?: string;
    next?: string;
  };
  return {
    inventoryItems: data.inventoryItems ?? [],
    total: data.total ?? 0,
    href: data.href,
    next: data.next,
  };
}

// ─── Offers ───────────────────────────────────────────────────────────────────

async function getOffersPageWithToken(
  token: string,
  sku: string | undefined,
  limit: number,
  nextHref?: string,
): Promise<EbayOfferPage & { next?: string }> {
  let requestPath: string;
  if (nextHref) {
    requestPath = toProxyApiPath(nextHref);
  } else {
    const params = new URLSearchParams({
      limit: String(Math.min(EBAY_OFFERS_MAX_PAGE_SIZE, normalizeOfferLimit(limit))),
    });
    if (sku) params.set('sku', sku);
    requestPath = `${API}/sell/inventory/v1/offer?${params.toString()}`;
  }

  const res = await fetch(requestPath, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`getOffers page ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { offers?: EbayOffer[]; total?: number; next?: string };
  return { offers: data.offers ?? [], total: data.total ?? 0, next: data.next };
}

export async function getOffersWithToken(token: string, sku?: string, limit = 25): Promise<EbayOfferPage> {
  const requestedLimit = normalizeOfferLimit(limit);
  const offers: EbayOffer[] = [];
  let total = 0;
  let nextHref: string | undefined;

  while (offers.length < requestedLimit) {
    const remaining = requestedLimit - offers.length;
    const pageLimit = Math.min(remaining, EBAY_OFFERS_MAX_PAGE_SIZE);
    const page = await getOffersPageWithToken(token, sku, pageLimit, nextHref);

    total = page.total;
    if (page.offers.length === 0) break;

    offers.push(...page.offers);
    nextHref = page.next;

    if (page.offers.length < pageLimit && !nextHref) break;
    if (!nextHref) break;
    if (total > 0 && offers.length >= total) break;
  }

  return {
    offers: offers.slice(0, requestedLimit),
    total: total || offers.length,
  };
}

/** Fetch all offers (listings) for the authenticated seller. */
export async function getOffers(sku?: string, limit = 25): Promise<EbayOfferPage> {
  const token = await getValidUserToken();
  return getOffersWithToken(token, sku, limit);
}

export async function getOffer(offerId: string): Promise<EbayOfferDetails> {
  const token = await getValidUserToken();
  const res = await fetch(`${API}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`getOffer ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<EbayOfferDetails>;
}

export async function getOffersForInventorySkus(skus: string[]): Promise<EbayOfferPage> {
  const validSkus = [...new Set(skus.filter(isValidEbaySku))];
  if (validSkus.length === 0) return { offers: [], total: 0 };

  const token = await getValidUserToken();
  const results = await Promise.allSettled(validSkus.map(sku => getOffersWithToken(token, sku, 1)));
  const offers: EbayOffer[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const offer of result.value.offers) {
      if (!offers.some(existing => existing.offerId === offer.offerId || existing.sku === offer.sku)) {
        offers.push(offer);
      }
    }
  }

  return { offers, total: offers.length };
}

// ─── Public seller listings (scraped) ────────────────────────────────────────

export async function getRecentSellerListings(limit = 20): Promise<EbayPublicListing[]> {
  const sellerUsername = getSellerUsername().trim();
  if (!sellerUsername) return [];

  const path = `/ebay-web-proxy/sch/i.html?_ssn=${encodeURIComponent(sellerUsername)}&_ipg=${limit}&_sop=10`;
  const res = await fetch(path, {
    headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  });

  if (!res.ok) throw new Error(`Recent seller listings failed ${res.status}`);

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cards = Array.from(doc.querySelectorAll('.srp-results .s-item'));
  const listings: EbayPublicListing[] = [];

  for (const card of cards) {
    const link      = card.querySelector<HTMLAnchorElement>('.s-item__link');
    const title     = card.querySelector<HTMLElement>('.s-item__title')?.textContent?.trim();
    const price     = card.querySelector<HTMLElement>('.s-item__price')?.textContent?.trim();
    const condition = card.querySelector<HTMLElement>('.SECONDARY_INFO')?.textContent?.trim();
    const image     = card.querySelector<HTMLImageElement>('.s-item__image-img');

    if (!link?.href || !title || title === 'Shop on eBay') continue;

    const itemIdMatch = link.href.match(/\/itm\/(\d+)/) ?? link.href.match(/hash=item([a-z0-9]+)/i);
    const itemId = itemIdMatch?.[1] ?? link.href;

    listings.push({
      itemId,
      title,
      itemWebUrl: link.href,
      imageUrl: image?.src || image?.getAttribute('data-src') || undefined,
      price,
      condition,
    });

    if (listings.length >= limit) break;
  }

  return listings;
}
