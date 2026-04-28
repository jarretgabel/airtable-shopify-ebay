import { useEffect, useState } from 'react';
import type { EbayTabViewModel } from '@/app/appTabViewModels';
import {
  createSampleListing,
  publishSampleDraftListing,
  type EbayListingApiMode,
  type EbayRuntimeConfig,
  type EbaySampleListingResult,
} from '@/services/app-api/ebay';
import type { EbayBusinessPolicyConfig, EbayLocationConfig } from '@/services/ebay/types';
import { spinnerClass } from '@/components/tabs/uiClasses';
import { EbayServerConfigNotice } from '@/components/ebay/EbayCards';
import { EbayAuthenticatedView } from '@/components/ebay/EbayAuthenticatedView';

interface EbayTabProps {
  viewModel: EbayTabViewModel;
}

function getMissingLocationFields(config: EbayLocationConfig): string[] {
  const missing: string[] = [];
  if (!config.key.trim()) missing.push('location key');
  if (!config.country.trim()) missing.push('country');
  const hasPostal = Boolean(config.postalCode.trim());
  const hasCityState = Boolean(config.city.trim() && config.stateOrProvince.trim());
  if (!hasPostal && !hasCityState) missing.push('postal code or city/state');
  return missing;
}

function getMissingPolicyFields(config: EbayBusinessPolicyConfig): string[] {
  const missing: string[] = [];
  if (!config.fulfillmentPolicyId.trim()) missing.push('fulfillment policy');
  if (!config.paymentPolicyId.trim()) missing.push('payment policy');
  if (!config.returnPolicyId.trim()) missing.push('return policy');
  return missing;
}

function getFallbackRuntimeConfig(): EbayRuntimeConfig {
  return {
    authMode: 'server',
    environment: 'production',
    defaultListingApiMode: 'inventory',
    publishSetup: {
      locationConfig: {
        key: '',
        name: '',
        country: '',
        postalCode: '',
        city: '',
        stateOrProvince: '',
      },
      policyConfig: {
        fulfillmentPolicyId: '',
        paymentPolicyId: '',
        returnPolicyId: '',
      },
    },
    missingLocationFields: ['location key', 'country', 'postal code or city/state'],
    missingPolicyFields: ['fulfillment policy', 'payment policy', 'return policy'],
    hasRequiredPublishSetup: false,
  };
}

export function EbayTab({ viewModel }: EbayTabProps) {
  const {
    session: { authenticated, restoringSession },
    state: { loading, error },
    config: { runtimeConfig },
    inventory: { items: inventoryItems, offers, recentListings, total },
    actions: { refetch },
  } = viewModel;

  const activeRuntimeConfig = runtimeConfig ?? getFallbackRuntimeConfig();

  const [apiMode, setApiMode] = useState<EbayListingApiMode>(activeRuntimeConfig.defaultListingApiMode);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'creating' | 'done' | 'error'>('idle');
  const [draftResult, setDraftResult] = useState<EbaySampleListingResult | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'done' | 'error'>('idle');
  const [publishResult, setPublishResult] = useState<{ sku: string; offerId: string; listingId: string } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [locationConfig, setLocationConfig] = useState<EbayLocationConfig>(activeRuntimeConfig.publishSetup.locationConfig);
  const [policyConfig, setPolicyConfig] = useState<EbayBusinessPolicyConfig>(activeRuntimeConfig.publishSetup.policyConfig);

  useEffect(() => {
    if (!runtimeConfig) return;
    setApiMode(runtimeConfig.defaultListingApiMode);
    setLocationConfig(runtimeConfig.publishSetup.locationConfig);
    setPolicyConfig(runtimeConfig.publishSetup.policyConfig);
  }, [runtimeConfig]);

  const missingLocation = getMissingLocationFields(locationConfig);
  const missingPolicies = getMissingPolicyFields(policyConfig);
  const isTradingMode = apiMode === 'trading' || apiMode === 'trading-verify';
  const isTradingVerifyMode = apiMode === 'trading-verify';

  const handleCreateDraft = async () => {
    setDraftStatus('creating');
    setDraftError(null);
    try {
      const result = await createSampleListing(apiMode, { locationConfig, policyConfig });
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
    setDraftStatus('idle');
    setDraftResult(null);
    setDraftError(null);
  };

  const handleResetPublishSetup = () => {
    setApiMode(activeRuntimeConfig.defaultListingApiMode);
    setLocationConfig(activeRuntimeConfig.publishSetup.locationConfig);
    setPolicyConfig(activeRuntimeConfig.publishSetup.policyConfig);
  };

  const handlePublishDraft = async () => {
    setPublishStatus('publishing');
    setPublishError(null);
    try {
      const result = await publishSampleDraftListing({ locationConfig, policyConfig });
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
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#E53238"/><text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" fontFamily="Arial,sans-serif">eBay</text></svg>
          </div>
          <h2 className="m-0 text-xl font-extrabold text-[var(--ink)]">Restoring eBay Session</h2>
          <p className="m-0 text-[0.87rem] leading-[1.6] text-[var(--muted)]">Checking the Lambda-backed eBay connection and loading inventory.</p>
          <div className="flex items-center justify-center gap-3 py-8 text-[0.84rem] text-[var(--muted)]"><div className={spinnerClass} /><span>{loading ? 'Loading eBay inventory...' : 'Connecting...'}</span></div>
          {error && <div className="w-full rounded-[10px] border border-red-400/40 bg-[var(--error-bg)] px-4 py-2.5 text-left text-[0.82rem] text-[var(--error-text)]">{error}</div>}
        </div>
      </div>
    );
  }

  if (!authenticated && !restoringSession) {
    return <EbayServerConfigNotice error={error} loading={loading} />;
  }

  return (
    <EbayAuthenticatedView
      loading={loading}
      error={error}
      environment={activeRuntimeConfig.environment}
      inventoryItems={inventoryItems}
      offers={offers}
      recentListings={recentListings}
      total={total}
      refetch={refetch}
      apiMode={apiMode}
      isTradingMode={isTradingMode}
      isTradingVerifyMode={isTradingVerifyMode}
      draftStatus={draftStatus}
      draftResult={draftResult}
      draftError={draftError}
      publishStatus={publishStatus}
      publishResult={publishResult}
      publishError={publishError}
      locationConfig={locationConfig}
      policyConfig={policyConfig}
      missingLocation={missingLocation}
      missingPolicies={missingPolicies}
      onApiModeChange={handleApiModeChange}
      onCreateDraft={handleCreateDraft}
      onPublishDraft={handlePublishDraft}
      onResetPublishSetup={handleResetPublishSetup}
      setLocationConfig={setLocationConfig}
      setPolicyConfig={setPolicyConfig}
    />
  );
}
