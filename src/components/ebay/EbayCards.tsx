import { useEffect, useState } from 'react';
import { buildAuthUrl, ebayConfig, getRuName, saveRuName, type EbayInventoryItem, type EbayOffer } from '@/services/ebay';
import type { EbayPublishedListing } from '@/hooks/useEbayListings';
import { runameInputClass, ghostButtonClass, smallButtonClass, listingUrl, statusColor, statusLabel } from './ebayTabUi';

export function ConnectScreen({ error, loading }: { error: string | null; loading: boolean }) {
  const [ruName, setRuName] = useState(() => getRuName());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const envRuName = (import.meta.env.VITE_EBAY_RU_NAME as string | undefined)?.trim();
    if (envRuName && envRuName !== getRuName()) {
      saveRuName(envRuName);
      setRuName(envRuName);
    }
  }, []);

  const handleSave = () => {
    saveRuName(ruName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const authUrl = ruName.trim() ? buildAuthUrl(ruName.trim()) : null;

  return (
    <div className="flex flex-col gap-5 py-1">
      <div className="mx-auto my-8 flex w-full max-w-[560px] flex-col items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-8 py-10 text-center shadow-[0_4px_24px_rgba(17,32,49,0.08)]">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#E53238"/><text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text></svg>
        </div>
        <h2 className="m-0 text-xl font-extrabold text-[var(--ink)]">Connect eBay Seller Account</h2>
        <p className="m-0 text-[0.87rem] leading-[1.6] text-[var(--muted)]">Authorize Resolution AV&apos;s dashboard to view your eBay listings and create draft items in production.</p>

        <div className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-left">
          <div className="flex items-center gap-2 text-[0.8rem] text-[var(--muted)]"><span className={`h-2 w-2 shrink-0 rounded-full ${ebayConfig.clientId ? 'bg-green-500' : 'bg-red-500'}`} /><span>Client ID: {ebayConfig.clientId ? `${ebayConfig.clientId.slice(0, 24)}...` : 'Not set'}</span></div>
          <div className="mt-1 flex items-center gap-2 text-[0.8rem] text-[var(--muted)]"><span className="h-2 w-2 shrink-0 rounded-full bg-green-500" /><span>Environment: {ebayConfig.env}</span></div>
        </div>

        <div className="flex w-full flex-col gap-2 text-left">
          <label className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[var(--ink)]">RuName<span className="text-[0.72rem] font-normal normal-case tracking-normal text-[var(--muted)]"> - from developer.ebay.com - your app - User Tokens</span></label>
          <div className="flex gap-2">
            <input className={runameInputClass} type="text" value={ruName} onChange={(e) => { setRuName(e.target.value); setSaved(false); }} placeholder="Resoluti-Resoluti-SBX-xxxxxxxx-xxxxxxxx" spellCheck={false} />
            <button className={`${ghostButtonClass} ${smallButtonClass}`} onClick={handleSave} disabled={!ruName.trim()}>{saved ? 'Saved ✓' : 'Save'}</button>
          </div>
        </div>

        {authUrl ? (
          <a className="inline-flex cursor-pointer rounded-[10px] border-0 bg-[#E53238] px-7 py-[0.65rem] text-[0.9rem] font-bold text-white no-underline transition-colors hover:bg-[#c8272d]" href={authUrl} rel="noreferrer">Connect with eBay -&gt;</a>
        ) : (
          <button className="inline-flex cursor-default rounded-[10px] border border-[var(--line)] bg-[var(--line)] px-7 py-[0.65rem] text-[0.9rem] font-bold text-[var(--muted)]" disabled>Enter RuName above to connect</button>
        )}

        {error && <div className="w-full rounded-[10px] border border-red-400/40 bg-[var(--error-bg)] px-4 py-2.5 text-left text-[0.82rem] text-[var(--error-text)]"><strong>Auth error:</strong> {error}</div>}
        {loading && <div className="text-[0.84rem] text-[var(--muted)]">Completing OAuth...</div>}
      </div>
    </div>
  );
}

export function RecentEbayCard({ listing }: { listing: EbayPublishedListing }) {
  const [imgError, setImgError] = useState(false);
  const thumbUrl = !imgError && listing.item.product?.imageUrls?.[0];
  const ebayListingUrl = listingUrl(listing.offer);

  return (
    <article className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_1px_4px_rgba(17,32,49,0.06)] transition-shadow duration-150 hover:shadow-[0_4px_16px_rgba(17,32,49,0.10)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg)]">
        {thumbUrl ? <img src={thumbUrl} alt={listing.item.product?.title ?? listing.item.sku} className="h-full w-full object-cover" onError={() => setImgError(true)} /> : <div className="flex h-full w-full items-center justify-center text-[var(--muted)]"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>}
        <span className="absolute right-2 top-2 rounded-md border border-green-400/35 bg-green-500/20 px-2 py-[0.2em] text-[0.65rem] font-extrabold uppercase tracking-[0.05em] text-green-200">Live</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
        <p className="m-0 font-mono text-[0.65rem] font-bold uppercase tracking-[0.04em] text-[var(--muted)]">{listing.offer.listingId ?? listing.offer.offerId ?? listing.item.sku}</p>
        {listing.item.product?.brand && <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[var(--accent)]">{listing.item.product.brand}</p>}
        <p className="m-0 line-clamp-2 text-[0.88rem] font-bold leading-[1.35] text-[var(--ink)]" title={listing.item.product?.title}>{listing.item.product?.title ?? 'Untitled'}</p>
        {listing.offer.pricingSummary?.price && <div className="text-[1.05rem] font-extrabold text-green-300">{listing.offer.pricingSummary.price.currency === 'USD' ? '$' : listing.offer.pricingSummary.price.currency}{Number(listing.offer.pricingSummary.price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
        {listing.item.condition && <p className="m-0 text-[0.74rem] font-semibold text-sky-500">{listing.item.condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>}
        {ebayListingUrl && <div className="mt-1 flex items-center gap-2"><a className="inline-flex items-center justify-center rounded-lg bg-[#E53238] px-3 py-1.5 text-[0.76rem] font-bold text-white no-underline transition-colors duration-150 hover:bg-[#c8272d]" href={ebayListingUrl} target="_blank" rel="noreferrer">View on eBay</a></div>}
      </div>
    </article>
  );
}

export function EbayCard({ item, offer }: { item: EbayInventoryItem; offer?: EbayOffer }) {
  const [imgError, setImgError] = useState(false);
  const thumbUrl = !imgError && item.product?.imageUrls?.[0];
  const price = offer?.pricingSummary?.price;
  const qty = item.availability?.shipToLocationAvailability?.quantity ?? 0;
  const ebayListingUrl = listingUrl(offer);

  return (
    <article className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_1px_4px_rgba(17,32,49,0.06)] transition-shadow duration-150 hover:shadow-[0_4px_16px_rgba(17,32,49,0.10)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg)]">
        {thumbUrl ? <img src={thumbUrl} alt={item.product?.title ?? item.sku} className="h-full w-full object-cover" onError={() => setImgError(true)} /> : <div className="flex h-full w-full items-center justify-center text-[var(--muted)]"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>}
        <span className={`absolute right-2 top-2 rounded-md px-2 py-[0.2em] text-[0.65rem] font-extrabold uppercase tracking-[0.05em] ${statusColor(offer?.status)}`}>{statusLabel(offer?.status)}</span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
        <p className="m-0 font-mono text-[0.65rem] font-bold uppercase tracking-[0.04em] text-[var(--muted)]">{item.sku}</p>
        {item.product?.brand && <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[var(--accent)]">{item.product.brand}</p>}
        <p className="m-0 line-clamp-2 text-[0.88rem] font-bold leading-[1.35] text-[var(--ink)]" title={item.product?.title}>{item.product?.title ?? 'Untitled'}</p>

        <div className="mt-0.5 flex items-center gap-3">
          {price ? <span className="text-[1.05rem] font-extrabold text-green-300">{price.currency === 'USD' ? '$' : price.currency}{Number(price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> : <span className="text-[0.82rem] font-normal text-[var(--muted)]">No price</span>}
          <span className="text-[0.76rem] text-[var(--muted)]">Qty: {qty}</span>
        </div>

        {item.condition && <p className="m-0 text-[0.74rem] font-semibold text-sky-500">{item.condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>}
        {offer?.categoryId && <p className="m-0 text-[0.72rem] text-[var(--muted)]">Category ID: <span className="font-mono">{offer.categoryId}</span></p>}

        {item.product?.aspects && Object.keys(item.product.aspects).length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {Object.entries(item.product.aspects).slice(0, 4).map(([k, v]) => (
              <span key={k} className="rounded-full border border-blue-400/35 bg-blue-500/20 px-2 py-[0.12em] text-[0.68rem] font-semibold text-blue-200" title={k}>{v[0]}</span>
            ))}
          </div>
        )}

        {ebayListingUrl && <div className="mt-1 flex items-center gap-2"><a className="inline-flex items-center justify-center rounded-lg bg-[#E53238] px-3 py-1.5 text-[0.76rem] font-bold text-white no-underline transition-colors duration-150 hover:bg-[#c8272d]" href={ebayListingUrl} target="_blank" rel="noreferrer">View on eBay</a></div>}
        {offer?.offerId && <p className="m-0 mt-1 text-[0.65rem] font-mono text-[var(--muted)]">Offer {offer.offerId}</p>}
      </div>
    </article>
  );
}
