import { useEffect, useRef } from 'react';
import type { Tab } from '@/app/appNavigation';
import type { EbayOffer } from '@/services/ebay/types';
import { useNotificationStore } from '@/stores/notificationStore';

interface UseEbayListingNotificationsParams {
  enabled: boolean;
  canAccessPage: (tab: Tab) => boolean;
  offers: EbayOffer[];
  navigateToEbayRecord: (recordId: string, replace?: boolean) => void;
}

interface OfferDigest {
  key: string;
  signature: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

function getOfferKey(offer: EbayOffer): string {
  return offer.sourceRecordId?.trim()
    || offer.offerId?.trim()
    || offer.listingId?.trim()
    || offer.sku.trim();
}

function buildOfferTitle(offer: EbayOffer): string {
  return `eBay listing updated${offer.sku ? `: ${offer.sku}` : ''}`;
}

function buildOfferMessage(offer: EbayOffer): string {
  const status = offer.status?.trim() || 'UPDATED';
  const listingId = offer.listingId?.trim();
  const offerId = offer.offerId?.trim();
  const quantity = typeof offer.availableQuantity === 'number' ? ` Quantity ${offer.availableQuantity}.` : '';
  const idPart = listingId || offerId ? ` ${listingId ? `Listing ${listingId}` : `Offer ${offerId}`}.` : '';
  return `${offer.sku} changed to ${status}.${idPart}${quantity}`.trim();
}

function buildOfferSignature(offer: EbayOffer): string {
  return JSON.stringify({
    sku: offer.sku,
    status: offer.status ?? null,
    listingId: offer.listingId ?? null,
    offerId: offer.offerId ?? null,
    availableQuantity: offer.availableQuantity ?? null,
    format: offer.format ?? null,
    categoryId: offer.categoryId ?? null,
    marketplaceId: offer.marketplaceId ?? null,
    price: offer.pricingSummary?.price?.value ?? null,
    currency: offer.pricingSummary?.price?.currency ?? null,
  });
}

function buildOfferDigest(offer: EbayOffer): OfferDigest {
  const key = getOfferKey(offer);
  const hasRecordId = Boolean(offer.sourceRecordId?.trim());
  return {
    key,
    signature: buildOfferSignature(offer),
    title: buildOfferTitle(offer),
    message: buildOfferMessage(offer),
    actionLabel: hasRecordId ? 'Open Listing Record' : undefined,
    onAction: undefined,
  };
}

export function useEbayListingNotifications({ enabled, canAccessPage, offers, navigateToEbayRecord }: UseEbayListingNotificationsParams): void {
  const upsertByKey = useNotificationStore((state) => state.upsertByKey);
  const dismissByKey = useNotificationStore((state) => state.dismissByKey);
  const previousSignaturesRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!enabled || !canAccessPage('ebay')) {
      previousSignaturesRef.current = null;
      return;
    }

    const nextSignatures = new Map<string, string>();
    const nextDigests = new Map<string, OfferDigest>();

    for (const offer of offers) {
      const digest = buildOfferDigest(offer);
      nextSignatures.set(digest.key, digest.signature);
      nextDigests.set(digest.key, {
        ...digest,
        onAction: offer.sourceRecordId ? () => navigateToEbayRecord(offer.sourceRecordId!) : undefined,
      });
    }

    const previousSignatures = previousSignaturesRef.current;
    previousSignaturesRef.current = nextSignatures;

    if (!previousSignatures) {
      return;
    }

    for (const [key, digest] of nextDigests.entries()) {
      const previousSignature = previousSignatures.get(key);
      if (previousSignature === digest.signature) {
        continue;
      }

      const offer = offers.find((item) => getOfferKey(item) === key);
      upsertByKey(`ebay-listing-${key}`, {
        tone: 'info',
        title: digest.title,
        message: digest.message,
        actionLabel: digest.actionLabel,
        onAction: offer?.sourceRecordId ? () => navigateToEbayRecord(offer.sourceRecordId!) : undefined,
        dismissible: true,
      });
    }

    for (const key of previousSignatures.keys()) {
      if (!nextSignatures.has(key)) {
        dismissByKey(`ebay-listing-${key}`);
      }
    }
  }, [canAccessPage, dismissByKey, enabled, navigateToEbayRecord, offers, upsertByKey]);
}