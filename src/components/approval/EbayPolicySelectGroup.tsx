import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import {
  getEbayBusinessPolicies,
  getEbayRuntimeConfig,
  type EbayBusinessPoliciesByType,
} from '@/services/app-api/ebay';
import { ApprovalSelect } from '@/components/approval/ApprovalSelect';

const panelClass = 'col-span-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:col-span-2';
const requiredBadgeClass = 'inline-block rounded-full border border-[var(--required-badge-border)] bg-[var(--required-badge-bg)] px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-[var(--required-badge-ink)]';

interface EbayPolicySelectGroupProps {
  enabled: boolean;
  marketplaceId: string;
  fulfillmentPolicyFieldName?: string;
  paymentPolicyFieldName?: string;
  returnPolicyFieldName?: string;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  disabled: boolean;
  renderFieldLabel: (fieldName: string) => JSX.Element;
  getSelectClassName: (fieldName: string) => string;
}

interface PolicyOption {
  id: string;
  label: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizePolicyLabel(name: string, id: string): string {
  const trimmedName = name.trim();
  if (!trimmedName) return 'Unnamed policy';

  const idPattern = new RegExp(`(?:\\s*\\(${escapeRegex(id)}\\))+\\s*$`, 'i');
  return trimmedName
    .replace(idPattern, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || 'Unnamed policy';
}

function normalizePolicyOptions(options: Array<{ policyId: string; name: string }>): PolicyOption[] {
  const seen = new Set<string>();
  const normalized: PolicyOption[] = [];

  options.forEach((option) => {
    const id = option.policyId.trim();
    if (!id) return;
    const key = id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const name = sanitizePolicyLabel(option.name, id);
    normalized.push({
      id,
      label: name,
    });
  });

  return normalized;
}

function hasPolicyOption(options: PolicyOption[], value: string): boolean {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) return false;
  return options.some((option) => option.id.toLowerCase() === normalizedValue);
}

function resolveSelectedPolicyValue(options: PolicyOption[], ...candidates: string[]): string {
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (hasPolicyOption(options, trimmed)) return trimmed;
  }

  return '';
}

function renderVisuallyRequiredLabel(
  fieldName: string,
  renderFieldLabel: (fieldName: string) => JSX.Element,
  visibleLabelFieldName?: string,
): JSX.Element {
  return (
    <span className="flex items-center gap-2 [&>span]:mb-0">
      {renderFieldLabel(visibleLabelFieldName ?? fieldName)}
      <span className={`${requiredBadgeClass} self-center`}>Required</span>
    </span>
  );
}

export function EbayPolicySelectGroup({
  enabled,
  marketplaceId,
  fulfillmentPolicyFieldName,
  paymentPolicyFieldName,
  returnPolicyFieldName,
  formValues,
  setFormValue,
  disabled,
  renderFieldLabel,
  getSelectClassName,
}: EbayPolicySelectGroupProps) {
  const emptyPoliciesByType = useMemo<EbayBusinessPoliciesByType>(() => ({
    marketplaceId: marketplaceId.trim().toUpperCase() || 'EBAY_US',
    fulfillmentPolicies: [],
    paymentPolicies: [],
    returnPolicies: [],
  }), [marketplaceId]);
  const [policiesByType, setPoliciesByType] = useState<EbayBusinessPoliciesByType | null>(null);
  const [defaultPolicyIds, setDefaultPolicyIds] = useState({
    fulfillmentPolicyId: '',
    paymentPolicyId: '',
    returnPolicyId: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshPolicyOptions = useCallback(() => {
    if (!enabled || loading) return;

    setLoading(true);
    setLoadError(null);
    // Clear visible options first so removed policies cannot linger in the UI.
    setPoliciesByType(emptyPoliciesByType);
    const normalizedMarketplaceId = marketplaceId.trim().toUpperCase() || 'EBAY_US';

    void getEbayBusinessPolicies(normalizedMarketplaceId)
      .then((policies) => {
        setPoliciesByType(policies);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(message || 'Unable to load eBay policy options.');
        setPoliciesByType(emptyPoliciesByType);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [enabled, loading, marketplaceId, emptyPoliciesByType]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPoliciesByType(emptyPoliciesByType);

    void (async () => {
      try {
        const normalizedMarketplaceId = marketplaceId.trim().toUpperCase() || 'EBAY_US';
        const [policies, runtimeConfig] = await Promise.all([
          getEbayBusinessPolicies(normalizedMarketplaceId),
          getEbayRuntimeConfig(),
        ]);
        if (cancelled) return;

        setPoliciesByType(policies);
        setDefaultPolicyIds({
          fulfillmentPolicyId: runtimeConfig.publishSetup.policyConfig.fulfillmentPolicyId.trim(),
          paymentPolicyId: runtimeConfig.publishSetup.policyConfig.paymentPolicyId.trim(),
          returnPolicyId: runtimeConfig.publishSetup.policyConfig.returnPolicyId.trim(),
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(message || 'Unable to load eBay policy options.');
        setPoliciesByType(emptyPoliciesByType);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, marketplaceId, emptyPoliciesByType]);

  const fulfillmentOptions = useMemo(
    () => normalizePolicyOptions(policiesByType?.fulfillmentPolicies ?? []),
    [policiesByType],
  );
  const paymentOptions = useMemo(
    () => normalizePolicyOptions(policiesByType?.paymentPolicies ?? []),
    [policiesByType],
  );
  const returnOptions = useMemo(
    () => normalizePolicyOptions(policiesByType?.returnPolicies ?? []),
    [policiesByType],
  );

  if (!enabled) return null;

  const hasAnyField = Boolean(fulfillmentPolicyFieldName || paymentPolicyFieldName || returnPolicyFieldName);
  if (!hasAnyField) return null;

  return (
    <div className={panelClass}>
      <p className="m-0 mb-2 text-xs text-[var(--muted)]">
        eBay Business Policies
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {fulfillmentPolicyFieldName && (
          <label className="col-span-1 flex flex-col gap-2">
            {renderVisuallyRequiredLabel(fulfillmentPolicyFieldName, renderFieldLabel, 'Fulfillment policy')}
            <ApprovalSelect
              selectClassName={getSelectClassName(fulfillmentPolicyFieldName)}
              value={resolveSelectedPolicyValue(
                fulfillmentOptions,
                (formValues[fulfillmentPolicyFieldName] ?? '').trim(),
                defaultPolicyIds.fulfillmentPolicyId,
              )}
              onChange={(event) => setFormValue(fulfillmentPolicyFieldName, event.target.value)}
              onFocus={refreshPolicyOptions}
              disabled={disabled || loading}
            >
              <option value="">Select fulfillment policy</option>
              {fulfillmentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </ApprovalSelect>
          </label>
        )}

        {paymentPolicyFieldName && (
          <label className="col-span-1 flex flex-col gap-2">
            {renderVisuallyRequiredLabel(paymentPolicyFieldName, renderFieldLabel, 'Payment policy')}
            <ApprovalSelect
              selectClassName={getSelectClassName(paymentPolicyFieldName)}
              value={resolveSelectedPolicyValue(
                paymentOptions,
                (formValues[paymentPolicyFieldName] ?? '').trim(),
                defaultPolicyIds.paymentPolicyId,
              )}
              onChange={(event) => setFormValue(paymentPolicyFieldName, event.target.value)}
              onFocus={refreshPolicyOptions}
              disabled={disabled || loading}
            >
              <option value="">Select payment policy</option>
              {paymentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </ApprovalSelect>
          </label>
        )}

        {returnPolicyFieldName && (
          <label className="col-span-1 flex flex-col gap-2">
            {renderVisuallyRequiredLabel(returnPolicyFieldName, renderFieldLabel, 'Return policy')}
            <ApprovalSelect
              selectClassName={getSelectClassName(returnPolicyFieldName)}
              value={resolveSelectedPolicyValue(
                returnOptions,
                (formValues[returnPolicyFieldName] ?? '').trim(),
                defaultPolicyIds.returnPolicyId,
              )}
              onChange={(event) => setFormValue(returnPolicyFieldName, event.target.value)}
              onFocus={refreshPolicyOptions}
              disabled={disabled || loading}
            >
              <option value="">Select return policy</option>
              {returnOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </ApprovalSelect>
          </label>
        )}
      </div>
      <p className="m-0 mt-3 text-xs">
        <a
          className="text-[var(--link)] underline decoration-dotted underline-offset-2 hover:opacity-90"
          href="https://www.ebay.com/bp/manage?sortType=-listingCount&_pgn=1&limit=25"
          target="_blank"
          rel="noopener noreferrer"
        >
          Add new business policy
        </a>
      </p>
      {loading && (
        <p className="m-0 mt-2 text-xs text-[var(--muted)]">Loading policy options...</p>
      )}
      {loadError && (
        <p className="m-0 mt-2 text-xs text-rose-300">Policy lookup unavailable: {loadError}</p>
      )}
    </div>
  );
}
