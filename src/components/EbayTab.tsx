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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function offerForSku(offers: EbayOffer[], sku: string): EbayOffer | undefined {
  return offers.find(o => o.sku === sku);
}

function statusColor(status?: string) {
  if (status === 'PUBLISHED') return 'ebay-status-live';
  if (status === 'UNPUBLISHED') return 'ebay-status-draft';
  if (status === 'ENDED') return 'ebay-status-ended';
  return 'ebay-status-none';
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
    <div className="ebay-tab">
      <div className="ebay-connect-card">
        <div className="ebay-connect-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#E53238"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text>
          </svg>
        </div>
        <h2 className="ebay-connect-title">Connect eBay Seller Account</h2>
        <p className="ebay-connect-sub">
          Authorize Resolution AV's dashboard to view your eBay listings and create draft items in production.
        </p>

        {/* Config status row */}
        <div className="ebay-config-row">
          <div className={`ebay-config-item${ebayConfig.clientId ? ' ebay-config-ok' : ' ebay-config-missing'}`}>
            <span className="ebay-config-dot" />
            <span>Client ID: {ebayConfig.clientId ? `${ebayConfig.clientId.slice(0, 24)}…` : 'Not set'}</span>
          </div>
          <div className="ebay-config-item ebay-config-ok">
            <span className="ebay-config-dot" />
            <span>Environment: {ebayConfig.env}</span>
          </div>
        </div>

        {/* RuName input — always visible, inline */}
        <div className="ebay-runame-form">
          <label className="ebay-runame-label">
            RuName
            <span className="ebay-runame-hint"> — from developer.ebay.com → your app → User Tokens</span>
          </label>
          <div className="ebay-runame-row">
            <input
              className="ebay-runame-input"
              type="text"
              value={ruName}
              onChange={e => { setRuName(e.target.value); setSaved(false); }}
              placeholder="Resoluti-Resoluti-SBX-xxxxxxxx-xxxxxxxx"
              spellCheck={false}
            />
            <button
              className="ebay-btn ebay-btn-ghost ebay-btn-sm"
              onClick={handleSave}
              disabled={!ruName.trim()}
            >
              {saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>

          {/* Where to find it */}
          <div className="ebay-setup-needed">
            <strong>Where to find your RuName:</strong>
            <ol className="ebay-setup-steps">
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
          <a className="ebay-connect-btn" href={authUrl} rel="noreferrer">
            Connect with eBay →
          </a>
        ) : (
          <button className="ebay-connect-btn ebay-connect-btn-disabled" disabled>
            Enter RuName above to connect
          </button>
        )}

        {error && (
          <div className="ebay-error-box">
            <strong>Auth error:</strong> {error}
          </div>
        )}

        {loading && <div className="ebay-loading-inline">Completing OAuth…</div>}
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
      <div className="ebay-tab">
        <div className="ebay-connect-card">
          <div className="ebay-connect-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#E53238"/>
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text>
            </svg>
          </div>
          <h2 className="ebay-connect-title">Restoring eBay Session</h2>
          <p className="ebay-connect-sub">
            Checking your saved seller token and loading inventory.
          </p>
          <div className="ebay-loading">
            <div className="loader" />
            <span>{loading ? 'Loading eBay inventory…' : 'Connecting…'}</span>
          </div>
          {error && <div className="ebay-error-box">{error}</div>}
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
    <div className="ebay-tab">

      {/* Header bar */}
      <div className="ebay-header">
        <div className="ebay-header-left">
          <div className="ebay-badge">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="8" fill="#E53238"/>
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text>
            </svg>
            <span className="ebay-badge-label">Production Connected</span>
          </div>
          <span className="ebay-total">
            Last 20 published eBay listings plus your inventory drafts · {total} valid inventory item{total !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="ebay-header-right">
          <div className="ebay-api-switch" role="group" aria-label="Choose eBay listing API">
            <button
              className={`ebay-api-switch-btn${apiMode === 'inventory' ? ' ebay-api-switch-btn-active' : ''}`}
              onClick={() => handleApiModeChange('inventory')}
              type="button"
            >
              Inventory API
            </button>
            <button
              className={`ebay-api-switch-btn${apiMode === 'trading' ? ' ebay-api-switch-btn-active' : ''}`}
              onClick={() => handleApiModeChange('trading')}
              type="button"
            >
              Trading API
            </button>
            <button
              className={`ebay-api-switch-btn${apiMode === 'trading-verify' ? ' ebay-api-switch-btn-active' : ''}`}
              onClick={() => handleApiModeChange('trading-verify')}
              type="button"
            >
              Trading Verify Only
            </button>
          </div>
          <button
            className="ebay-btn ebay-btn-primary"
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
              className="ebay-btn ebay-btn-primary"
              onClick={handlePublishDraft}
              disabled={publishStatus === 'publishing'}
            >
              {publishStatus === 'publishing' ? 'Publishing…' : 'Publish Sample Draft'}
            </button>
          ) : (
            <span className="ebay-inline-note">
              {isTradingVerifyMode ? 'Verify Only does not create a listing.' : 'Trading API creates a live listing immediately.'}
            </span>
          )}
          <button className="ebay-btn ebay-btn-ghost" onClick={refetch} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="ebay-btn ebay-btn-ghost ebay-btn-disconnect" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Draft creation result */}
      {draftStatus === 'done' && draftResult && (
        <div className="ebay-draft-success">
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
          <span className="ebay-draft-tag">{draftResult.status}</span>
          {draftResult.mode === 'trading' && tradingListingUrl && (
            <a className="ebay-card-link" href={tradingListingUrl} target="_blank" rel="noreferrer">
              View on eBay
            </a>
          )}
        </div>
      )}
      {draftStatus === 'error' && draftError && (
        <div className="ebay-error-box">{draftError}</div>
      )}

      {publishStatus === 'done' && publishResult && (
        <div className="ebay-draft-success">
          <strong>Sample draft published</strong> — SKU: <code>{publishResult.sku}</code>
          <> · Offer ID: <code>{publishResult.offerId}</code></>
          <> · Listing ID: <code>{publishResult.listingId}</code></>
          <span className="ebay-draft-tag">LIVE</span>
        </div>
      )}
      {publishStatus === 'error' && publishError && (
        <div className="ebay-error-box">{publishError}</div>
      )}

      {error && <div className="ebay-error-box">{error}</div>}

      <div className="ebay-api-mode-card">
        <div className="ebay-section-label">Listing API mode</div>
        <p className="ebay-publish-copy">
          Inventory API creates seller drafts as <strong>UNPUBLISHED</strong> offers. Trading API creates a live fixed-price listing immediately. Trading Verify Only runs the same eBay validation without creating a live listing.
        </p>
        {isTradingMode && (
          <div className={`ebay-trading-warning${isTradingVerifyMode ? ' ebay-trading-warning-safe' : ''}`}>
            <strong>{isTradingVerifyMode ? 'Trading Verify Only' : 'Warning: Trading API is live'}</strong>
            {' '}
            {isTradingVerifyMode
              ? 'This mode only verifies the payload with eBay and does not create a listing.'
              : 'This mode bypasses drafts and creates an ACTIVE eBay listing immediately.'}
          </div>
        )}
      </div>

      <div className="ebay-publish-setup">
        <div className="ebay-publish-setup-head">
          <div>
            <div className="ebay-section-label">Publish setup</div>
            <p className="ebay-publish-copy">
              Publishing needs one inventory warehouse location plus three eBay business policy IDs. The app can create the warehouse location with your values, but it cannot auto-read policy IDs because your current token lacks Account API scope.
            </p>
          </div>
          <button className="ebay-btn ebay-btn-ghost ebay-btn-sm" onClick={handleSavePublishSetup}>
            {setupSaved ? 'Saved ✓' : 'Save publish setup'}
          </button>
        </div>

        <div className="ebay-publish-status-row">
          <div className={`ebay-config-item${missingLocation.length === 0 ? ' ebay-config-ok' : ' ebay-config-missing'}`}>
            <span className="ebay-config-dot" />
            <span>Location: {formatMissingFields(missingLocation)}</span>
          </div>
          <div className={`ebay-config-item${missingPolicies.length === 0 ? ' ebay-config-ok' : ' ebay-config-missing'}`}>
            <span className="ebay-config-dot" />
            <span>Policies: {formatMissingFields(missingPolicies)}</span>
          </div>
        </div>

        <div className="ebay-publish-grid">
          <label className="ebay-publish-field">
            Location key
            <input
              className="ebay-runame-input"
              type="text"
              value={locationConfig.key}
              onChange={event => setLocationConfig(current => ({ ...current, key: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="ebay-publish-field">
            Location name
            <input
              className="ebay-runame-input"
              type="text"
              value={locationConfig.name}
              onChange={event => setLocationConfig(current => ({ ...current, name: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="ebay-publish-field">
            Country
            <input
              className="ebay-runame-input"
              type="text"
              value={locationConfig.country}
              onChange={event => setLocationConfig(current => ({ ...current, country: event.target.value.toUpperCase() }))}
              spellCheck={false}
            />
          </label>
          <label className="ebay-publish-field">
            Postal code
            <input
              className="ebay-runame-input"
              type="text"
              value={locationConfig.postalCode}
              onChange={event => setLocationConfig(current => ({ ...current, postalCode: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="ebay-publish-field">
            City
            <input
              className="ebay-runame-input"
              type="text"
              value={locationConfig.city}
              onChange={event => setLocationConfig(current => ({ ...current, city: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="ebay-publish-field">
            State / province
            <input
              className="ebay-runame-input"
              type="text"
              value={locationConfig.stateOrProvince}
              onChange={event => setLocationConfig(current => ({ ...current, stateOrProvince: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="ebay-publish-field">
            Fulfillment policy ID
            <input
              className="ebay-runame-input"
              type="text"
              value={policyConfig.fulfillmentPolicyId}
              onChange={event => setPolicyConfig(current => ({ ...current, fulfillmentPolicyId: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="ebay-publish-field">
            Payment policy ID
            <input
              className="ebay-runame-input"
              type="text"
              value={policyConfig.paymentPolicyId}
              onChange={event => setPolicyConfig(current => ({ ...current, paymentPolicyId: event.target.value }))}
              spellCheck={false}
            />
          </label>
          <label className="ebay-publish-field">
            Return policy ID
            <input
              className="ebay-runame-input"
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
          <div className="ebay-section-label">Inventory API debug</div>
          <div className="ebay-debug-panel">
            <div className="ebay-debug-head">
              <span>SKU</span>
              <span>Offer ID</span>
              <span>Status</span>
              <span>Listing ID</span>
              <span>Exists on eBay</span>
            </div>
            {[...offers]
              .sort((a, b) => offerSortValue(b) - offerSortValue(a))
              .map(offer => (
                <div className="ebay-debug-row" key={offer.offerId ?? offer.sku}>
                  <span className="ebay-debug-mono">{offer.sku}</span>
                  <span className="ebay-debug-mono">{offer.offerId ?? '—'}</span>
                  <span>
                    <span className={`ebay-debug-status ${statusColor(offer.status)}`}>
                      {offer.status ?? 'UNKNOWN'}
                    </span>
                  </span>
                  <span className="ebay-debug-mono">{offer.listingId ?? '—'}</span>
                  <span>{offer.listingId ? 'Yes' : 'No'}</span>
                </div>
              ))}
          </div>
        </>
      )}

      {recentListings.length > 0 && (
        <>
          <div className="ebay-section-label">Last 20 published inventory-api listings</div>
          <div className="ebay-grid">
            {recentListings.map(listing => (
              <RecentEbayCard key={listing.offer.offerId ?? listing.item.sku} listing={listing} />
            ))}
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {loading && inventoryItems.length === 0 && (
        <div className="ebay-loading">
          <div className="loader" />
          <span>Loading eBay inventory…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && inventoryItems.length === 0 && !error && (
        <div className="ebay-empty">
          <p>No inventory items found. Inventory-mode sample drafts will show here after you create one.</p>
        </div>
      )}

      {/* Listings grid */}
      {inventoryItems.length > 0 && (
        <>
          <div className="ebay-section-label">Inventory API drafts and listings</div>
          <div className="ebay-grid">
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
    <article className="ebay-card">
      <div className="ebay-card-img-wrap">
        {thumbUrl ? (
          <img src={thumbUrl} alt={listing.item.product?.title ?? listing.item.sku} className="ebay-card-img" onError={() => setImgError(true)} />
        ) : (
          <div className="ebay-card-img-placeholder">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
        <span className="ebay-status-badge ebay-status-live">Live</span>
      </div>

      <div className="ebay-card-body">
        <p className="ebay-card-sku">{listing.offer.listingId ?? listing.offer.offerId ?? listing.item.sku}</p>
        {listing.item.product?.brand && (
          <p className="ebay-card-brand">{listing.item.product.brand}</p>
        )}
        <p className="ebay-card-title" title={listing.item.product?.title}>
          {listing.item.product?.title ?? 'Untitled'}
        </p>
        {listing.offer.pricingSummary?.price && (
          <div className="ebay-card-price">
            {listing.offer.pricingSummary.price.currency === 'USD' ? '$' : listing.offer.pricingSummary.price.currency}
            {Number(listing.offer.pricingSummary.price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        )}
        {listing.item.condition && (
          <p className="ebay-card-condition">
            {listing.item.condition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </p>
        )}
        {ebayListingUrl && (
          <div className="ebay-card-actions">
            <a className="ebay-card-link" href={ebayListingUrl} target="_blank" rel="noreferrer">
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
    <article className="ebay-card">
      {/* Image */}
      <div className="ebay-card-img-wrap">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={item.product?.title ?? item.sku}
            className="ebay-card-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="ebay-card-img-placeholder">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
        <span className={`ebay-status-badge ${statusColor(offer?.status)}`}>
          {statusLabel(offer?.status)}
        </span>
      </div>

      {/* Body */}
      <div className="ebay-card-body">
        <p className="ebay-card-sku">{item.sku}</p>
        {item.product?.brand && (
          <p className="ebay-card-brand">{item.product.brand}</p>
        )}
        <p className="ebay-card-title" title={item.product?.title}>
          {item.product?.title ?? 'Untitled'}
        </p>

        {/* Price & quantity */}
        <div className="ebay-card-meta">
          {price ? (
            <span className="ebay-card-price">
              {price.currency === 'USD' ? '$' : price.currency}
              {Number(price.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="ebay-card-price ebay-card-price-none">No price</span>
          )}
          <span className="ebay-card-qty">Qty: {qty}</span>
        </div>

        {/* Condition */}
        {item.condition && (
          <p className="ebay-card-condition">
            {item.condition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </p>
        )}

        {/* Description snippet */}
        {item.product?.description && (
          <p
            className="ebay-card-desc"
            dangerouslySetInnerHTML={{
              __html: item.product.description.replace(/<[^>]*>/g, ' ').slice(0, 150) + '…',
            }}
          />
        )}

        {/* Aspect tags */}
        {item.product?.aspects && Object.keys(item.product.aspects).length > 0 && (
          <div className="ebay-card-aspects">
            {Object.entries(item.product.aspects)
              .slice(0, 4)
              .map(([k, v]) => (
                <span key={k} className="ebay-aspect-chip" title={k}>
                  {v[0]}
                </span>
              ))}
          </div>
        )}

        {ebayListingUrl && (
          <div className="ebay-card-actions">
            <a
              className="ebay-card-link"
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
          <p className="ebay-card-offer-id">Offer {offer.offerId}</p>
        )}
      </div>
    </article>
  );
}
