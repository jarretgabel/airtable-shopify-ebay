import type { EbayOffer } from '@/services/ebay/types';

export type EbayEnvironment = 'sandbox' | 'production';

export function offerForSku(offers: EbayOffer[], sku: string): EbayOffer | undefined {
  return offers.find((offer) => offer.sku === sku);
}

export function statusColor(status?: string) {
  if (status === 'PUBLISHED') return 'bg-green-900/40 text-green-300';
  if (status === 'UNPUBLISHED') return 'bg-yellow-900/40 text-yellow-300';
  if (status === 'ENDED') return 'bg-red-900/40 text-red-300';
  return 'bg-[var(--line)] text-[var(--muted)]';
}

export function statusLabel(status?: string) {
  if (status === 'PUBLISHED') return 'Live';
  if (status === 'UNPUBLISHED') return 'Draft';
  if (status === 'ENDED') return 'Ended';
  return 'No offer';
}

export function listingUrl(offer: EbayOffer | undefined, environment: EbayEnvironment): string | null {
  if (!offer?.listingId) return null;
  const base = environment === 'production' ? 'https://www.ebay.com/itm/' : 'https://www.sandbox.ebay.com/itm/';
  return `${base}${encodeURIComponent(offer.listingId)}`;
}

export function listingUrlFromId(listingId: string | undefined, environment: EbayEnvironment): string | null {
  if (!listingId) return null;
  const base = environment === 'production' ? 'https://www.ebay.com/itm/' : 'https://www.sandbox.ebay.com/itm/';
  return `${base}${encodeURIComponent(listingId)}`;
}

export function offerSortValue(offer: EbayOffer): number {
  const numericId = Number(offer.listingId ?? offer.offerId ?? 0);
  return Number.isFinite(numericId) ? numericId : 0;
}

export function formatMissingFields(fields: string[]): string {
  return fields.length > 0 ? fields.join(', ') : 'Ready to publish';
}

export const runameInputClass = 'flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 font-mono text-[0.82rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg)]';
export const buttonBaseClass = 'inline-flex cursor-pointer items-center justify-center rounded-lg px-[0.9rem] py-[0.45rem] text-[0.8rem] font-semibold transition-[background,opacity] duration-150 disabled:cursor-default disabled:opacity-50';
export const primaryButtonClass = `${buttonBaseClass} border border-transparent bg-[#E53238] text-white hover:bg-[#c8272d]`;
export const ghostButtonClass = `${buttonBaseClass} border border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[var(--panel)]`;
export const smallButtonClass = 'px-[0.8rem] py-[0.4rem] text-[0.76rem]';
