import { type EbayPublishedListing, type EbayListingsState } from '@/hooks/useEbayListings';
import { type EbayBusinessPolicyConfig, type EbayInventoryItem, type EbayListingApiMode, type EbayLocationConfig, type EbayOffer, type EbaySampleListingResult } from '@/services/ebay';
import { spinnerClass } from '@/components/tabs/uiClasses';
import { useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import { EbayCard, RecentEbayCard } from './EbayCards';
import { offerForSku, offerSortValue, statusColor, formatMissingFields, runameInputClass, primaryButtonClass, ghostButtonClass, smallButtonClass } from './ebayTabUi';

interface EbayAuthenticatedViewProps {
  loading: boolean;
  error: string | null;
  inventoryItems: EbayInventoryItem[];
  offers: EbayOffer[];
  recentListings: EbayPublishedListing[];
  total: number;
  refetch: EbayListingsState['refetch'];
  disconnect: EbayListingsState['disconnect'];
  apiMode: EbayListingApiMode;
  isTradingMode: boolean;
  isTradingVerifyMode: boolean;
  draftStatus: 'idle' | 'creating' | 'done' | 'error';
  draftResult: EbaySampleListingResult | null;
  draftError: string | null;
  publishStatus: 'idle' | 'publishing' | 'done' | 'error';
  publishResult: { sku: string; offerId: string; listingId: string } | null;
  publishError: string | null;
  locationConfig: EbayLocationConfig;
  policyConfig: EbayBusinessPolicyConfig;
  setupSaved: boolean;
  missingLocation: string[];
  missingPolicies: string[];
  tradingListingUrl: string | null;
  onApiModeChange: (mode: EbayListingApiMode) => void;
  onCreateDraft: () => void;
  onPublishDraft: () => void;
  onSavePublishSetup: () => void;
  setLocationConfig: Dispatch<SetStateAction<EbayLocationConfig>>;
  setPolicyConfig: Dispatch<SetStateAction<EbayBusinessPolicyConfig>>;
}

export function EbayAuthenticatedView({
  loading,
  error,
  inventoryItems,
  offers,
  recentListings,
  total,
  refetch,
  disconnect,
  apiMode,
  isTradingMode,
  isTradingVerifyMode,
  draftStatus,
  draftResult,
  draftError,
  publishStatus,
  publishResult,
  publishError,
  locationConfig,
  policyConfig,
  setupSaved,
  missingLocation,
  missingPolicies,
  tradingListingUrl,
  onApiModeChange,
  onCreateDraft,
  onPublishDraft,
  onSavePublishSetup,
  setLocationConfig,
  setPolicyConfig,
}: EbayAuthenticatedViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PUBLISHED' | 'UNPUBLISHED' | 'ENDED'>('all');
  const [sort, setSort] = useState<'sku-asc' | 'price-asc' | 'price-desc' | 'status'>('sku-asc');

  const filteredInventoryItems = useMemo(() => {
    let list = [...inventoryItems];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((item) =>
        item.sku.toLowerCase().includes(q) ||
        item.product?.title?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((item) => {
        const offer = offers.find((o) => o.sku === item.sku);
        return offer?.status === statusFilter;
      });
    }
    switch (sort) {
      case 'sku-asc': list.sort((a, b) => a.sku.localeCompare(b.sku)); break;
      case 'price-asc': list.sort((a, b) => {
        const aOffer = offers.find((o) => o.sku === a.sku);
        const bOffer = offers.find((o) => o.sku === b.sku);
        return parseFloat(aOffer?.pricingSummary?.price?.value ?? '0') - parseFloat(bOffer?.pricingSummary?.price?.value ?? '0');
      }); break;
      case 'price-desc': list.sort((a, b) => {
        const aOffer = offers.find((o) => o.sku === a.sku);
        const bOffer = offers.find((o) => o.sku === b.sku);
        return parseFloat(bOffer?.pricingSummary?.price?.value ?? '0') - parseFloat(aOffer?.pricingSummary?.price?.value ?? '0');
      }); break;
      case 'status': list.sort((a, b) => {
        const aStatus = offers.find((o) => o.sku === a.sku)?.status ?? '';
        const bStatus = offers.find((o) => o.sku === b.sku)?.status ?? '';
        return aStatus.localeCompare(bStatus);
      }); break;
    }
    return list;
  }, [inventoryItems, offers, search, statusFilter, sort]);

  const filteredRecentListings = useMemo(() => {
    if (!search.trim()) return recentListings;
    const q = search.toLowerCase();
    return recentListings.filter((listing) =>
      listing.item.sku.toLowerCase().includes(q) ||
      listing.item.product?.title?.toLowerCase().includes(q)
    );
  }, [recentListings, search]);

  const ebaySearchInputClass = 'flex-1 min-w-[160px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.82rem] text-[var(--ink)] placeholder-[var(--muted)] outline-none transition-colors focus:border-[var(--accent)]';
  const ebaySelectClass = 'rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 text-[0.82rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)] cursor-pointer';

  return (
    <div className="flex flex-col gap-5 py-1">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-5 py-3 shadow-[0_1px_4px_rgba(17,32,49,0.05)]">
        <div className="flex items-center gap-4 max-[960px]:w-full max-[960px]:flex-col max-[960px]:items-start">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#E53238"/><text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text></svg>
            <span className="rounded-md border border-green-400/35 bg-green-500/20 px-2 py-[0.2em] text-[0.82rem] font-bold text-green-200">Production Connected</span>
          </div>
          <span className="text-[0.82rem] leading-[1.45] text-[var(--muted)]">Last 20 published eBay listings plus your inventory drafts · {total} valid inventory item{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-[960px]:w-full max-[960px]:justify-start">
          <div className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-[0.2rem] max-[600px]:w-full" role="group" aria-label="Choose eBay listing API">
            <button className={`cursor-pointer rounded-lg border-0 px-[0.7rem] py-[0.4rem] text-[0.78rem] font-bold transition-[background,color] duration-150 max-[600px]:flex-1 ${apiMode === 'inventory' ? 'bg-[var(--panel)] text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.3)]' : 'bg-transparent text-[var(--muted)]'}`} onClick={() => onApiModeChange('inventory')} type="button">Inventory API</button>
            <button className={`cursor-pointer rounded-lg border-0 px-[0.7rem] py-[0.4rem] text-[0.78rem] font-bold transition-[background,color] duration-150 max-[600px]:flex-1 ${apiMode === 'trading' ? 'bg-[var(--panel)] text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.3)]' : 'bg-transparent text-[var(--muted)]'}`} onClick={() => onApiModeChange('trading')} type="button">Trading API</button>
            <button className={`cursor-pointer rounded-lg border-0 px-[0.7rem] py-[0.4rem] text-[0.78rem] font-bold transition-[background,color] duration-150 max-[600px]:flex-1 ${apiMode === 'trading-verify' ? 'bg-[var(--panel)] text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.3)]' : 'bg-transparent text-[var(--muted)]'}`} onClick={() => onApiModeChange('trading-verify')} type="button">Trading Verify Only</button>
          </div>
          <button className={`${primaryButtonClass} max-[600px]:w-full`} onClick={onCreateDraft} disabled={draftStatus === 'creating'}>{draftStatus === 'creating' ? 'Creating...' : apiMode === 'inventory' ? '+ Create Sample Draft' : apiMode === 'trading' ? '+ Create Trading Listing' : '+ Verify Trading Payload'}</button>
          {apiMode === 'inventory' ? <button className={`${primaryButtonClass} max-[600px]:w-full`} onClick={onPublishDraft} disabled={publishStatus === 'publishing'}>{publishStatus === 'publishing' ? 'Publishing...' : 'Publish Sample Draft'}</button> : <span className="max-w-[16rem] text-[0.76rem] leading-[1.35] text-[var(--muted)] max-[960px]:max-w-none">{isTradingVerifyMode ? 'Verify Only does not create a listing.' : 'Trading API creates a live listing immediately.'}</span>}
          <button className={`${ghostButtonClass} max-[600px]:w-full`} onClick={refetch} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          <button className={`${ghostButtonClass} text-red-500 max-[600px]:w-full`} onClick={disconnect}>Disconnect</button>
        </div>
      </div>

      {draftStatus === 'done' && draftResult && <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-green-500/30 bg-green-950/30 px-4 py-2.5 text-[0.83rem] text-green-300 max-[600px]:items-start"><strong>{draftResult.mode === 'inventory' ? 'Draft listing created' : draftResult.mode === 'trading' ? 'Trading listing created' : 'Trading payload verified'}</strong> - SKU: <code>{draftResult.sku}</code>{draftResult.offerId && <> · Offer ID: <code>{draftResult.offerId}</code></>}{draftResult.listingId && <> · Listing ID: <code>{draftResult.listingId}</code></>}<span className="rounded-[5px] bg-slate-800 px-2 py-[0.15em] text-[0.68rem] font-bold text-slate-400">{draftResult.status}</span>{draftResult.mode === 'trading' && tradingListingUrl && <a className="inline-flex items-center justify-center rounded-lg bg-[#E53238] px-3 py-1.5 text-[0.76rem] font-bold text-white no-underline transition-colors duration-150 hover:bg-[#c8272d]" href={tradingListingUrl} target="_blank" rel="noreferrer">View on eBay</a>}</div>}
      {draftStatus === 'error' && draftError && <div className="rounded-[10px] border border-red-400/40 bg-[var(--error-bg)] px-4 py-2.5 text-[0.82rem] text-[var(--error-text)]">{draftError}</div>}
      {publishStatus === 'done' && publishResult && <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-green-500/30 bg-green-950/30 px-4 py-2.5 text-[0.83rem] text-green-300 max-[600px]:items-start"><strong>Sample draft published</strong> - SKU: <code>{publishResult.sku}</code> · Offer ID: <code>{publishResult.offerId}</code> · Listing ID: <code>{publishResult.listingId}</code><span className="rounded-[5px] bg-slate-800 px-2 py-[0.15em] text-[0.68rem] font-bold text-slate-400">LIVE</span></div>}
      {publishStatus === 'error' && publishError && <div className="rounded-[10px] border border-red-400/40 bg-[var(--error-bg)] px-4 py-2.5 text-[0.82rem] text-[var(--error-text)]">{publishError}</div>}
      {error && <div className="rounded-[10px] border border-red-400/40 bg-[var(--error-bg)] px-4 py-2.5 text-[0.82rem] text-[var(--error-text)]">{error}</div>}

      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Listing API mode</div>
        <p className="mt-1.5 max-w-[72ch] text-[0.88rem] leading-[1.5] text-[var(--muted)]">Inventory API creates seller drafts as <strong>UNPUBLISHED</strong> offers. Trading API creates a live fixed-price listing immediately. Trading Verify Only runs the same eBay validation without creating a live listing.</p>
        {isTradingMode && <div className={`mt-4 rounded-[10px] border px-4 py-3 text-[0.84rem] leading-[1.5] ${isTradingVerifyMode ? 'border-blue-400/30 bg-blue-950/30 text-blue-300' : 'border-orange-400/30 bg-orange-950/25 text-orange-300'}`}><strong>{isTradingVerifyMode ? 'Trading Verify Only' : 'Warning: Trading API is live'}</strong> {isTradingVerifyMode ? 'This mode only verifies the payload with eBay and does not create a listing.' : 'This mode bypasses drafts and creates an ACTIVE eBay listing immediately.'}</div>}
      </div>

      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-start justify-between gap-4 max-[600px]:flex-col"><div><div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Publish setup</div><p className="mt-1.5 max-w-[72ch] text-[0.88rem] leading-[1.5] text-[var(--muted)]">Publishing needs one inventory warehouse location plus three eBay business policy IDs. The app can create the warehouse location with your values, but it cannot auto-read policy IDs because your current token lacks Account API scope.</p></div><button className={`${ghostButtonClass} ${smallButtonClass}`} onClick={onSavePublishSetup}>{setupSaved ? 'Saved ✓' : 'Save publish setup'}</button></div>

        <div className="mb-4 grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
          <div className="flex items-center gap-2 text-[0.8rem] text-[var(--muted)]"><span className={`h-2 w-2 shrink-0 rounded-full ${missingLocation.length === 0 ? 'bg-green-500' : 'bg-red-500'}`} /><span>Location: {formatMissingFields(missingLocation)}</span></div>
          <div className="flex items-center gap-2 text-[0.8rem] text-[var(--muted)]"><span className={`h-2 w-2 shrink-0 rounded-full ${missingPolicies.length === 0 ? 'bg-green-500' : 'bg-red-500'}`} /><span>Policies: {formatMissingFields(missingPolicies)}</span></div>
        </div>

        <div className="grid grid-cols-3 gap-3.5 max-[960px]:grid-cols-2 max-[600px]:grid-cols-1">
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">Location key<input className={runameInputClass} type="text" value={locationConfig.key} onChange={(event) => setLocationConfig((current) => ({ ...current, key: event.target.value }))} spellCheck={false} /></label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">Location name<input className={runameInputClass} type="text" value={locationConfig.name} onChange={(event) => setLocationConfig((current) => ({ ...current, name: event.target.value }))} spellCheck={false} /></label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">Country<input className={runameInputClass} type="text" value={locationConfig.country} onChange={(event) => setLocationConfig((current) => ({ ...current, country: event.target.value.toUpperCase() }))} spellCheck={false} /></label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">Postal code<input className={runameInputClass} type="text" value={locationConfig.postalCode} onChange={(event) => setLocationConfig((current) => ({ ...current, postalCode: event.target.value }))} spellCheck={false} /></label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">City<input className={runameInputClass} type="text" value={locationConfig.city} onChange={(event) => setLocationConfig((current) => ({ ...current, city: event.target.value }))} spellCheck={false} /></label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">State / province<input className={runameInputClass} type="text" value={locationConfig.stateOrProvince} onChange={(event) => setLocationConfig((current) => ({ ...current, stateOrProvince: event.target.value }))} spellCheck={false} /></label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">Fulfillment policy ID<input className={runameInputClass} type="text" value={policyConfig.fulfillmentPolicyId} onChange={(event) => setPolicyConfig((current) => ({ ...current, fulfillmentPolicyId: event.target.value }))} spellCheck={false} /></label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">Payment policy ID<input className={runameInputClass} type="text" value={policyConfig.paymentPolicyId} onChange={(event) => setPolicyConfig((current) => ({ ...current, paymentPolicyId: event.target.value }))} spellCheck={false} /></label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">Return policy ID<input className={runameInputClass} type="text" value={policyConfig.returnPolicyId} onChange={(event) => setPolicyConfig((current) => ({ ...current, returnPolicyId: event.target.value }))} spellCheck={false} /></label>
        </div>
      </div>

      {offers.length > 0 && <><div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Inventory API debug</div><div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]"><div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-3 bg-white/5 px-4 py-3 text-[0.7rem] font-extrabold uppercase tracking-[0.05em] text-[var(--muted)] max-[600px]:grid-cols-2"><span>SKU</span><span>Offer ID</span><span>Status</span><span>Listing ID</span><span>Exists on eBay</span></div>{[...offers].sort((a, b) => offerSortValue(b) - offerSortValue(a)).map((offer) => <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-3 border-t border-[rgba(148,163,184,0.18)] px-4 py-3 text-[0.8rem] text-[var(--ink)] first:border-t-0 max-[600px]:grid-cols-2" key={offer.offerId ?? offer.sku}><span className="break-words font-mono text-[0.73rem] text-[var(--muted)]">{offer.sku}</span><span className="break-words font-mono text-[0.73rem] text-[var(--muted)]">{offer.offerId ?? '—'}</span><span><span className={`inline-flex items-center rounded-full px-2.5 py-[0.18em] text-[0.68rem] font-extrabold uppercase tracking-[0.05em] ${statusColor(offer.status)}`}>{offer.status ?? 'UNKNOWN'}</span></span><span className="break-words font-mono text-[0.73rem] text-[var(--muted)]">{offer.listingId ?? '—'}</span><span>{offer.listingId ? 'Yes' : 'No'}</span></div>)}</div></>}

      {(recentListings.length > 0 || inventoryItems.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <input
            type="text"
            className={ebaySearchInputClass}
            placeholder="Search SKU or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search eBay inventory"
          />
          <select className={ebaySelectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by offer status">
            <option value="all">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="UNPUBLISHED">Unpublished</option>
            <option value="ENDED">Ended</option>
          </select>
          <select className={ebaySelectClass} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort inventory">
            <option value="sku-asc">SKU A→Z</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
            <option value="status">Status</option>
          </select>
        </div>
      )}

      {filteredRecentListings.length > 0 && <><div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Last 20 published inventory-api listings{search && filteredRecentListings.length !== recentListings.length ? ` (${filteredRecentListings.length} of ${recentListings.length})` : ''}</div><div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 max-[600px]:grid-cols-1">{filteredRecentListings.map((listing) => <RecentEbayCard key={listing.offer.offerId ?? listing.item.sku} listing={listing} />)}</div></>}

      {loading && inventoryItems.length === 0 && <div className="flex items-center justify-center gap-3 py-8 text-[0.84rem] text-[var(--muted)]"><div className={spinnerClass} /><span>Loading eBay inventory...</span></div>}
      {!loading && inventoryItems.length === 0 && !error && <div className="py-12 text-center text-[0.9rem] text-[var(--muted)]"><p>No inventory items found. Inventory-mode sample drafts will show here after you create one.</p></div>}

      {inventoryItems.length > 0 && <><div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Inventory API drafts and listings{search || statusFilter !== 'all' ? ` (${filteredInventoryItems.length} of ${inventoryItems.length})` : ''}</div>{filteredInventoryItems.length === 0 ? <p className="py-6 text-center text-[0.88rem] text-[var(--muted)]">No items match your filters.</p> : <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 max-[600px]:grid-cols-1">{filteredInventoryItems.map((item) => <EbayCard key={item.sku} item={item} offer={offerForSku(offers, item.sku)} />)}</div>}</>}
    </div>
  );
}
