import { useState, useEffect } from 'react';
import { useEbayListings, type EbayPublishedListing } from '@/hooks/useEbayListings';
import {
  buildAuthUrl,
  createSampleListing,
  publishSampleDraftListing,
  getRuName,
  saveRuName,
  ebayConfig,
  getPreferredListingApiMode,
  getInventoryLocationConfig,
  saveInventoryLocationConfig,
  getBusinessPolicyConfig,
  saveBusinessPolicyConfig,
  getMissingLocationFields,
  getMissingPolicyFields,
  savePreferredListingApiMode,
  type EbayInventoryItem,
  type EbayListingApiMode,
  type EbayOffer,
  type EbayLocationConfig,
  type EbayBusinessPolicyConfig,
  type EbaySampleListingResult,
} from '@/services/ebay';
import { spinnerClass } from '@/components/tabs/uiClasses';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function offerForSku(offers: EbayOffer[], sku: string): EbayOffer | undefined {
  return offers.find(o => o.sku === sku);
}

function statusColor(status?: string) {
  if (status === 'PUBLISHED') return 'bg-green-100 text-green-700';
  if (status === 'UNPUBLISHED') return 'bg-yellow-100 text-yellow-800';
  if (status === 'ENDED') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-500';
}

function statusLabel(status?: string) {
  if (status === 'PUBLISHED') return 'Live';
  if (status === 'UNPUBLISHED') return 'Draft';
  if (status === 'ENDED') return 'Ended';
  return 'No offer';
}

function listingUrl(offer?: EbayOffer): string | null {
  if (!offer?.listingId) return null;
  const base = ebayConfig.env === 'production'
    ? 'https://www.ebay.com/itm/'
    : 'https://www.sandbox.ebay.com/itm/';
  return `${base}${encodeURIComponent(offer.listingId)}`;
}

function listingUrlFromId(listingId?: string): string | null {
  if (!listingId) return null;
  const base = ebayConfig.env === 'production'
    ? 'https://www.ebay.com/itm/'
    : 'https://www.sandbox.ebay.com/itm/';
  return `${base}${encodeURIComponent(listingId)}`;
}

function offerSortValue(offer: EbayOffer): number {
  const numericId = Number(offer.listingId ?? offer.offerId ?? 0);
  return Number.isFinite(numericId) ? numericId : 0;
}

function formatMissingFields(fields: string[]): string {
  return fields.length > 0 ? fields.join(', ') : 'Ready to publish';
}

const runameInputClass = 'flex-1 rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 font-mono text-[0.82rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-white';
const buttonBaseClass = 'inline-flex cursor-pointer items-center justify-center rounded-lg px-[0.9rem] py-[0.45rem] text-[0.8rem] font-semibold transition-[background,opacity] duration-150 disabled:cursor-default disabled:opacity-50';
const primaryButtonClass = `${buttonBaseClass} border border-transparent bg-[#E53238] text-white hover:bg-[#c8272d]`;
const ghostButtonClass = `${buttonBaseClass} border border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[var(--panel)]`;
const smallButtonClass = 'px-[0.8rem] py-[0.4rem] text-[0.76rem]';

// ─── Connect Screen ───────────────────────────────────────────────────────────

function ConnectScreen({ error, loading }: { error: string | null; loading: boolean }) {
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
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#E53238"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text>
          </svg>
        </div>
        <h2 className="m-0 text-xl font-extrabold text-[var(--ink)]">Connect eBay Seller Account</h2>
        <p className="m-0 text-[0.87rem] leading-[1.6] text-[var(--muted)]">
          Authorize Resolution AV's dashboard to view your eBay listings and create draft items in production.
        </p>

        {/* Config status row */}
        <div className="w-full rounded-[10px] border border-[var(--line)] bg-slate-50 px-4 py-3 text-left">
          <div className="flex items-center gap-2 text-[0.8rem] text-[var(--muted)]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${ebayConfig.clientId ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>Client ID: {ebayConfig.clientId ? `${ebayConfig.clientId.slice(0, 24)}…` : 'Not set'}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[0.8rem] text-[var(--muted)]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
            <span>Environment: {ebayConfig.env}</span>
          </div>
        </div>

        {/* RuName input — always visible, inline */}
        <div className="flex w-full flex-col gap-2 text-left">
          <label className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[var(--ink)]">
            RuName
            <span className="text-[0.72rem] font-normal normal-case tracking-normal text-[var(--muted)]"> — from developer.ebay.com → your app → User Tokens</span>
          </label>
          <div className="flex gap-2">
            <input
              className={runameInputClass}
              type="text"
              value={ruName}
              onChange={e => { setRuName(e.target.value); setSaved(false); }}
              placeholder="Resoluti-Resoluti-SBX-xxxxxxxx-xxxxxxxx"
              spellCheck={false}
            />
            <button
              className={`${ghostButtonClass} ${smallButtonClass}`}
              onClick={handleSave}
              disabled={!ruName.trim()}
            >
              {saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>

          {/* Where to find it */}
          <div className="w-full rounded-[10px] border border-orange-200 bg-orange-50 px-4 py-3 text-left text-[0.82rem] text-orange-900">
            <strong>Where to find your RuName:</strong>
            <ol className="ml-[1.1rem] mt-2 p-0 leading-[1.7]">
              <li>
                Go to <a href="https://developer.ebay.com/my/keys" target="_blank" rel="noreferrer"><strong>developer.ebay.com/my/keys</strong></a>
                {' '}→ click your production app name
              </li>
              <li>
                Click <em>"User Tokens"</em> → <em>"Get a Token from eBay via Your Application"</em>
              </li>
              <li>
                Under <strong>Redirect URL</strong>, add <code>http://localhost:3000</code> if it's not there, then click <strong>Save</strong>
              </li>
              <li>
                Copy the <strong>RuName</strong> shown on that page (format: <code>AppName-AppName-ENV-hex-hex</code>)
              </li>
              <li>Paste it above and click <strong>Save</strong>, then Connect</li>
            </ol>
          </div>
        </div>

        {authUrl ? (
          <a className="inline-flex cursor-pointer rounded-[10px] border-0 bg-[#E53238] px-7 py-[0.65rem] text-[0.9rem] font-bold text-white no-underline transition-colors hover:bg-[#c8272d]" href={authUrl} rel="noreferrer">
            Connect with eBay →
          </a>
        ) : (
          <button className="inline-flex cursor-default rounded-[10px] border-0 bg-gray-300 px-7 py-[0.65rem] text-[0.9rem] font-bold text-gray-400" disabled>
            Enter RuName above to connect
          </button>
        )}

        {error && (
          <div className="w-full rounded-[10px] border border-red-300 bg-red-50 px-4 py-2.5 text-left text-[0.82rem] text-red-700">
            <strong>Auth error:</strong> {error}
          </div>
        )}

        {loading && <div className="text-[0.84rem] text-[var(--muted)]">Completing OAuth…</div>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EbayTab() {
  const { authenticated, restoringSession, loading, error, inventoryItems, offers, recentListings, total, refetch, disconnect } =
    useEbayListings();

  const [apiMode, setApiMode] = useState<EbayListingApiMode>(() => getPreferredListingApiMode());
  const [draftStatus, setDraftStatus] = useState<'idle' | 'creating' | 'done' | 'error'>('idle');
  const [draftResult, setDraftResult] = useState<EbaySampleListingResult | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'done' | 'error'>('idle');
  const [publishResult, setPublishResult] = useState<{ sku: string; offerId: string; listingId: string } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [locationConfig, setLocationConfig] = useState<EbayLocationConfig>(() => getInventoryLocationConfig());
  const [policyConfig, setPolicyConfig] = useState<EbayBusinessPolicyConfig>(() => getBusinessPolicyConfig());
  const [setupSaved, setSetupSaved] = useState(false);

  const missingLocation = getMissingLocationFields(locationConfig);
  const missingPolicies = getMissingPolicyFields(policyConfig);
  const tradingListingUrl = listingUrlFromId(draftResult?.listingId);
  const isTradingMode = apiMode === 'trading' || apiMode === 'trading-verify';
  const isTradingVerifyMode = apiMode === 'trading-verify';

  const handleCreateDraft = async () => {
    setDraftStatus('creating');
    setDraftError(null);
    try {
      const result = await createSampleListing(apiMode);
      setDraftResult(result);
      setDraftStatus('done');
      if (result.mode === 'inventory') {
        setTimeout(() => refetch(), 800);
      }
    } catch (err) {
      setDraftError((err as Error).message);
      setDraftStatus('error');
    }
  };

  const handleApiModeChange = (mode: EbayListingApiMode) => {
    setApiMode(mode);
    savePreferredListingApiMode(mode);
    setDraftStatus('idle');
    setDraftResult(null);
    setDraftError(null);
  };

  const handleSavePublishSetup = () => {
    saveInventoryLocationConfig(locationConfig);
    saveBusinessPolicyConfig(policyConfig);
    setSetupSaved(true);
    setTimeout(() => setSetupSaved(false), 2000);
  };

  const handlePublishDraft = async () => {
    setPublishStatus('publishing');
    setPublishError(null);
    try {
      saveInventoryLocationConfig(locationConfig);
      saveBusinessPolicyConfig(policyConfig);
      const result = await publishSampleDraftListing();
      setPublishResult(result);
      setPublishStatus('done');
      setTimeout(() => refetch(), 800);
    } catch (err) {
      setPublishError((err as Error).message);
      setPublishStatus('error');
    }
  };

  if (!authenticated && restoringSession) {
    return (
      <div className="flex flex-col gap-5 py-1">
        <div className="mx-auto my-8 flex w-full max-w-[560px] flex-col items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-8 py-10 text-center shadow-[0_4px_24px_rgba(17,32,49,0.08)]">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#E53238"/>
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text>
            </svg>
          </div>
          <h2 className="m-0 text-xl font-extrabold text-[var(--ink)]">Restoring eBay Session</h2>
          <p className="m-0 text-[0.87rem] leading-[1.6] text-[var(--muted)]">
            Checking your saved seller token and loading inventory.
          </p>
          <div className="flex items-center justify-center gap-3 py-8 text-[0.84rem] text-[var(--muted)]">
            <div className={spinnerClass} />
            <span>{loading ? 'Loading eBay inventory…' : 'Connecting…'}</span>
          </div>
          {error && <div className="w-full rounded-[10px] border border-red-300 bg-red-50 px-4 py-2.5 text-left text-[0.82rem] text-red-700">{error}</div>}
        </div>
      </div>
    );
  }

  // ── Not authenticated — show setup/connect screen ─────────────────────────
  if (!authenticated && !restoringSession) {
    return <ConnectScreen error={error} loading={loading} />;
  }

  // ── Authenticated — show listings ─────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 py-1">

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-5 py-3 shadow-[0_1px_4px_rgba(17,32,49,0.05)]">
        <div className="flex items-center gap-4 max-[960px]:w-full max-[960px]:flex-col max-[960px]:items-start">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="8" fill="#E53238"/>
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text>
            </svg>
            <span className="rounded-md bg-green-100 px-2 py-[0.2em] text-[0.82rem] font-bold text-green-800">Production Connected</span>
          </div>
          <span className="text-[0.82rem] leading-[1.45] text-[var(--muted)]">
            Last 20 published eBay listings plus your inventory drafts · {total} valid inventory item{total !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-[960px]:w-full max-[960px]:justify-start">
          <div className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--line)] bg-slate-50 p-[0.2rem] max-[600px]:w-full" role="group" aria-label="Choose eBay listing API">
            <button
              className={`cursor-pointer rounded-lg border-0 px-[0.7rem] py-[0.4rem] text-[0.78rem] font-bold transition-[background,color] duration-150 max-[600px]:flex-1 ${apiMode === 'inventory' ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'bg-transparent text-[var(--muted)]'}`}
              onClick={() => handleApiModeChange('inventory')}
              type="button"
            >
              Inventory API
            </button>
            <button
              className={`cursor-pointer rounded-lg border-0 px-[0.7rem] py-[0.4rem] text-[0.78rem] font-bold transition-[background,color] duration-150 max-[600px]:flex-1 ${apiMode === 'trading' ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'bg-transparent text-[var(--muted)]'}`}
              onClick={() => handleApiModeChange('trading')}
              type="button"
            >
              Trading API
            </button>
            <button
              className={`cursor-pointer rounded-lg border-0 px-[0.7rem] py-[0.4rem] text-[0.78rem] font-bold transition-[background,color] duration-150 max-[600px]:flex-1 ${apiMode === 'trading-verify' ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'bg-transparent text-[var(--muted)]'}`}
              onClick={() => handleApiModeChange('trading-verify')}
              type="button"
            >
              Trading Verify Only
            </button>
          </div>
          <button
            className={`${primaryButtonClass} max-[600px]:w-full`}
            onClick={handleCreateDraft}
            disabled={draftStatus === 'creating'}
          >
            {draftStatus === 'creating'
              ? 'Creating…'
              : apiMode === 'inventory'
                ? '+ Create Sample Draft'
                : apiMode === 'trading'
                  ? '+ Create Trading Listing'
                  : '+ Verify Trading Payload'}
          </button>
          {apiMode === 'inventory' ? (
            <button
              className={`${primaryButtonClass} max-[600px]:w-full`}
              onClick={handlePublishDraft}
              disabled={publishStatus === 'publishing'}
            >
              {publishStatus === 'publishing' ? 'Publishing…' : 'Publish Sample Draft'}
            </button>
          ) : (
            <span className="max-w-[16rem] text-[0.76rem] leading-[1.35] text-[var(--muted)] max-[960px]:max-w-none">
              {isTradingVerifyMode ? 'Verify Only does not create a listing.' : 'Trading API creates a live listing immediately.'}
            </span>
          )}
          <button className={`${ghostButtonClass} max-[600px]:w-full`} onClick={refetch} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className={`${ghostButtonClass} text-red-500 max-[600px]:w-full`} onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Draft creation result */}
      {draftStatus === 'done' && draftResult && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-green-200 bg-green-50 px-4 py-2.5 text-[0.83rem] text-green-800 max-[600px]:items-start">
          <strong>
            {draftResult.mode === 'inventory'
              ? 'Draft listing created'
              : draftResult.mode === 'trading'
                ? 'Trading listing created'
                : 'Trading payload verified'}
          </strong> — SKU: <code>{draftResult.sku}</code>
          {draftResult.offerId && (
            <> · Offer ID: <code>{draftResult.offerId}</code></>
          )}
          {draftResult.listingId && (
            <> · Listing ID: <code>{draftResult.listingId}</code></>
          )}
          <span className="rounded-[5px] bg-slate-800 px-2 py-[0.15em] text-[0.68rem] font-bold text-slate-400">{draftResult.status}</span>
          {draftResult.mode === 'trading' && tradingListingUrl && (
            <a className="inline-flex items-center justify-center rounded-lg bg-[#E53238] px-3 py-1.5 text-[0.76rem] font-bold text-white no-underline transition-colors duration-150 hover:bg-[#c8272d]" href={tradingListingUrl} target="_blank" rel="noreferrer">
              View on eBay
            </a>
          )}
        </div>
      )}
      {draftStatus === 'error' && draftError && (
        <div className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-2.5 text-[0.82rem] text-red-700">{draftError}</div>
      )}

      {publishStatus === 'done' && publishResult && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-green-200 bg-green-50 px-4 py-2.5 text-[0.83rem] text-green-800 max-[600px]:items-start">
          <strong>Sample draft published</strong> — SKU: <code>{publishResult.sku}</code>
          <> · Offer ID: <code>{publishResult.offerId}</code></>
          <> · Listing ID: <code>{publishResult.listingId}</code></>
          <span className="rounded-[5px] bg-slate-800 px-2 py-[0.15em] text-[0.68rem] font-bold text-slate-400">LIVE</span>
        </div>
      )}
      {publishStatus === 'error' && publishError && (
        <div className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-2.5 text-[0.82rem] text-red-700">{publishError}</div>
      )}

      {error && <div className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-2.5 text-[0.82rem] text-red-700">{error}</div>}

      <div className="rounded-[14px] border border-[var(--line)] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Listing API mode</div>
        <p className="mt-1.5 max-w-[72ch] text-[0.88rem] leading-[1.5] text-[var(--muted)]">
          Inventory API creates seller drafts as <strong>UNPUBLISHED</strong> offers. Trading API creates a live fixed-price listing immediately. Trading Verify Only runs the same eBay validation without creating a live listing.
        </p>
        {isTradingMode && (
          <div className={`mt-4 rounded-[10px] border px-4 py-3 text-[0.84rem] leading-[1.5] ${isTradingVerifyMode ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-orange-300 bg-orange-50 text-orange-800'}`}>
            <strong>{isTradingVerifyMode ? 'Trading Verify Only' : 'Warning: Trading API is live'}</strong>
            {' '}
            {isTradingVerifyMode
              ? 'This mode only verifies the payload with eBay and does not create a listing.'
              : 'This mode bypasses drafts and creates an ACTIVE eBay listing immediately.'}
          </div>
        )}
      </div>

      <div className="rounded-[14px] border border-[var(--line)] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-start justify-between gap-4 max-[600px]:flex-col">
          <div>
            <div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Publish setup</div>
            <p className="mt-1.5 max-w-[72ch] text-[0.88rem] leading-[1.5] text-[var(--muted)]">
              Publishing needs one inventory warehouse location plus three eBay business policy IDs. The app can create the warehouse location with your values, but it cannot auto-read policy IDs because your current token lacks Account API scope.
            </p>
          </div>
          <button className={`${ghostButtonClass} ${smallButtonClass}`} onClick={handleSavePublishSetup}>
            {setupSaved ? 'Saved ✓' : 'Save publish setup'}
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
          <div className="flex items-center gap-2 text-[0.8rem] text-[var(--muted)]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${missingLocation.length === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>Location: {formatMissingFields(missingLocation)}</span>
          </div>
          <div className="flex items-center gap-2 text-[0.8rem] text-[var(--muted)]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${missingPolicies.length === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>Policies: {formatMissingFields(missingPolicies)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3.5 max-[960px]:grid-cols-2 max-[600px]:grid-cols-1">
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            Location key
            <input
              className={runameInputClass}
              type="text"
              value={locationConfig.key}
              onChange={event => setLocationConfig(current => ({ ...current, key: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            Location name
            <input
              className={runameInputClass}
              type="text"
              value={locationConfig.name}
              onChange={event => setLocationConfig(current => ({ ...current, name: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            Country
            <input
              className={runameInputClass}
              type="text"
              value={locationConfig.country}
              onChange={event => setLocationConfig(current => ({ ...current, country: event.target.value.toUpperCase() }))}
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            Postal code
            <input
              className={runameInputClass}
              type="text"
              value={locationConfig.postalCode}
              onChange={event => setLocationConfig(current => ({ ...current, postalCode: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            City
            <input
              className={runameInputClass}
              type="text"
              value={locationConfig.city}
              onChange={event => setLocationConfig(current => ({ ...current, city: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            State / province
            <input
              className={runameInputClass}
              type="text"
              value={locationConfig.stateOrProvince}
              onChange={event => setLocationConfig(current => ({ ...current, stateOrProvince: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            Fulfillment policy ID
            <input
              className={runameInputClass}
              type="text"
              value={policyConfig.fulfillmentPolicyId}
              onChange={event => setPolicyConfig(current => ({ ...current, fulfillmentPolicyId: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            Payment policy ID
            <input
              className={runameInputClass}
              type="text"
              value={policyConfig.paymentPolicyId}
              onChange={event => setPolicyConfig(current => ({ ...current, paymentPolicyId: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-[var(--ink)]">
            Return policy ID
            <input
              className={runameInputClass}
              type="text"
              value={policyConfig.returnPolicyId}
              onChange={event => setPolicyConfig(current => ({ ...current, returnPolicyId: event.target.value }))}
              spellCheck={false}
            />
          </label>
        </div>
      </div>

      {offers.length > 0 && (
        <>
          <div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Inventory API debug</div>
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-3 bg-slate-50 px-4 py-3 text-[0.7rem] font-extrabold uppercase tracking-[0.05em] text-[var(--muted)] max-[600px]:grid-cols-2">
              <span>SKU</span>
              <span>Offer ID</span>
              <span>Status</span>
              <span>Listing ID</span>
              <span>Exists on eBay</span>
            </div>
            {[...offers]
              .sort((a, b) => offerSortValue(b) - offerSortValue(a))
              .map(offer => (
                <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-3 border-t border-[rgba(148,163,184,0.18)] px-4 py-3 text-[0.8rem] text-[var(--ink)] first:border-t-0 max-[600px]:grid-cols-2" key={offer.offerId ?? offer.sku}>
                  <span className="break-words font-mono text-[0.73rem] text-[var(--muted)]">{offer.sku}</span>
                  <span className="break-words font-mono text-[0.73rem] text-[var(--muted)]">{offer.offerId ?? '—'}</span>
                  <span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-[0.18em] text-[0.68rem] font-extrabold uppercase tracking-[0.05em] ${statusColor(offer.status)}`}>
                      {offer.status ?? 'UNKNOWN'}
                    </span>
                  </span>
                  <span className="break-words font-mono text-[0.73rem] text-[var(--muted)]">{offer.listingId ?? '—'}</span>
                  <span>{offer.listingId ? 'Yes' : 'No'}</span>
                </div>
              ))}
          </div>
        </>
      )}

      {recentListings.length > 0 && (
        <>
          <div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Last 20 published inventory-api listings</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 max-[600px]:grid-cols-1">
            {recentListings.map(listing => (
              <RecentEbayCard key={listing.offer.offerId ?? listing.item.sku} listing={listing} />
            ))}
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {loading && inventoryItems.length === 0 && (
        <div className="flex items-center justify-center gap-3 py-8 text-[0.84rem] text-[var(--muted)]">
          <div className={spinnerClass} />
          <span>Loading eBay inventory…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && inventoryItems.length === 0 && !error && (
        <div className="py-12 text-center text-[0.9rem] text-[var(--muted)]">
          <p>No inventory items found. Inventory-mode sample drafts will show here after you create one.</p>
        </div>
      )}

      {/* Listings grid */}
      {inventoryItems.length > 0 && (
        <>
          <div className="mt-1 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Inventory API drafts and listings</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 max-[600px]:grid-cols-1">
            {inventoryItems.map(item => (
              <EbayCard
                key={item.sku}
                item={item}
                offer={offerForSku(offers, item.sku)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RecentEbayCard({ listing }: { listing: EbayPublishedListing }) {
  const [imgError, setImgError] = useState(false);
  const thumbUrl = !imgError && listing.item.product?.imageUrls?.[0];
  const ebayListingUrl = listingUrl(listing.offer);

  return (
    <article className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_1px_4px_rgba(17,32,49,0.06)] transition-shadow duration-150 hover:shadow-[0_4px_16px_rgba(17,32,49,0.10)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {thumbUrl ? (
          <img src={thumbUrl} alt={listing.item.product?.title ?? listing.item.sku} className="h-full w-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-md bg-green-100 px-2 py-[0.2em] text-[0.65rem] font-extrabold uppercase tracking-[0.05em] text-green-700">Live</span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
        <p className="m-0 font-mono text-[0.65rem] font-bold uppercase tracking-[0.04em] text-[var(--muted)]">{listing.offer.listingId ?? listing.offer.offerId ?? listing.item.sku}</p>
        {listing.item.product?.brand && (
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[var(--accent)]">{listing.item.product.brand}</p>
        )}
        <p className="m-0 line-clamp-2 text-[0.88rem] font-bold leading-[1.35] text-[var(--ink)]" title={listing.item.product?.title}>
          {listing.item.product?.title ?? 'Untitled'}
        </p>
        {listing.offer.pricingSummary?.price && (
          <div className="text-[1.05rem] font-extrabold text-green-600">
            {listing.offer.pricingSummary.price.currency === 'USD' ? '$' : listing.offer.pricingSummary.price.currency}
            {Number(listing.offer.pricingSummary.price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        )}
        {listing.item.condition && (
          <p className="m-0 text-[0.74rem] font-semibold text-sky-500">
            {listing.item.condition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </p>
        )}
        {ebayListingUrl && (
          <div className="mt-1 flex items-center gap-2">
            <a className="inline-flex items-center justify-center rounded-lg bg-[#E53238] px-3 py-1.5 text-[0.76rem] font-bold text-white no-underline transition-colors duration-150 hover:bg-[#c8272d]" href={ebayListingUrl} target="_blank" rel="noreferrer">
              View on eBay
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Listing Card ──────────────────────────────────────────────────────────────

interface EbayCardProps {
  item: EbayInventoryItem;
  offer?: EbayOffer;
}

function EbayCard({ item, offer }: EbayCardProps) {
  const [imgError, setImgError] = useState(false);
  const thumbUrl = !imgError && item.product?.imageUrls?.[0];
  const price = offer?.pricingSummary?.price;
  const qty = item.availability?.shipToLocationAvailability?.quantity ?? 0;
  const ebayListingUrl = listingUrl(offer);

  return (
    <article className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_1px_4px_rgba(17,32,49,0.06)] transition-shadow duration-150 hover:shadow-[0_4px_16px_rgba(17,32,49,0.10)]">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={item.product?.title ?? item.sku}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
        <span className={`absolute right-2 top-2 rounded-md px-2 py-[0.2em] text-[0.65rem] font-extrabold uppercase tracking-[0.05em] ${statusColor(offer?.status)}`}>
          {statusLabel(offer?.status)}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
        <p className="m-0 font-mono text-[0.65rem] font-bold uppercase tracking-[0.04em] text-[var(--muted)]">{item.sku}</p>
        {item.product?.brand && (
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[var(--accent)]">{item.product.brand}</p>
        )}
        <p className="m-0 line-clamp-2 text-[0.88rem] font-bold leading-[1.35] text-[var(--ink)]" title={item.product?.title}>
          {item.product?.title ?? 'Untitled'}
        </p>

        {/* Price & quantity */}
        <div className="mt-0.5 flex items-center gap-3">
          {price ? (
            <span className="text-[1.05rem] font-extrabold text-green-600">
              {price.currency === 'USD' ? '$' : price.currency}
              {Number(price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-[0.82rem] font-normal text-[var(--muted)]">No price</span>
          )}
          <span className="text-[0.76rem] text-[var(--muted)]">Qty: {qty}</span>
        </div>

        {/* Condition */}
        {item.condition && (
          <p className="m-0 text-[0.74rem] font-semibold text-sky-500">
            {item.condition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </p>
        )}

        {/* Description snippet */}
        {item.product?.description && (
          <p
            className="m-0 line-clamp-3 text-[0.78rem] leading-[1.5] text-[var(--muted)]"
            dangerouslySetInnerHTML={{
              __html: item.product.description.replace(/<[^>]*>/g, ' ').slice(0, 150) + '…',
            }}
          />
        )}

        {/* Aspect tags */}
        {item.product?.aspects && Object.keys(item.product.aspects).length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {Object.entries(item.product.aspects)
              .slice(0, 4)
              .map(([k, v]) => (
                <span key={k} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-[0.12em] text-[0.68rem] font-semibold text-blue-700" title={k}>
                  {v[0]}
                </span>
              ))}
          </div>
        )}

        {ebayListingUrl && (
          <div className="mt-1 flex items-center gap-2">
            <a
              className="inline-flex items-center justify-center rounded-lg bg-[#E53238] px-3 py-1.5 text-[0.76rem] font-bold text-white no-underline transition-colors duration-150 hover:bg-[#c8272d]"
              href={ebayListingUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on eBay
            </a>
          </div>
        )}

        {/* Offer ID link */}
        {offer?.offerId && (
          <p className="m-0 mt-1 text-[0.65rem] font-mono text-slate-400">Offer {offer.offerId}</p>
        )}
      </div>
    </article>
  );
}
