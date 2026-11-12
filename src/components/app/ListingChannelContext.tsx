import { createContext, useContext } from 'react';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';

export const PENDING_LISTINGS_SECTION_KEY = 'listings-pending-section';

export type ListingChannelKey = 'listings' | 'shopify' | 'ebay';

export interface ListingChannelContextValue {
  channels: { key: 'shopify' | 'ebay'; label: string }[];
  navigate: (key: ListingChannelKey) => void;
}

export const ListingChannelContext = createContext<ListingChannelContextValue | null>(null);

export function useListingChannels() {
  return useContext(ListingChannelContext);
}

type SnapshotKey = 'ready' | 'needs' | 'shopify' | 'ebay';

/** Sub-nav for the Shopify/eBay snapshot pages, matching the Listings tab row. */
export function ListingSnapshotNav({ active }: { active: 'shopify' | 'ebay' }) {
  const ctx = useListingChannels();
  if (!ctx) return null;
  const items: { key: SnapshotKey; label: string }[] = [
    { key: 'ready', label: 'Ready for Publishing' },
    { key: 'needs', label: 'Needs Further Work' },
    ...ctx.channels,
  ];
  return (
    <MainPageSectionNav
      ariaLabel="Listings sections"
      items={items}
      activeKey={active}
      onSelect={(key) => {
        if (key === 'needs') sessionStorage.setItem(PENDING_LISTINGS_SECTION_KEY, 'needs-further-work');
        ctx.navigate(key === 'shopify' || key === 'ebay' ? key : 'listings');
      }}
    />
  );
}
