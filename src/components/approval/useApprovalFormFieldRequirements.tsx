import { useCallback, useMemo, type JSX } from 'react';
import {
  isEbayPriceFieldAlias,
  isPriceLikeField,
  isTitleLikeField,
  prioritizeTitleBeforePrice,
  toHumanReadableLabel,
} from './approvalFormFieldsSharedHelpers';
import { getEbayPriceFieldLabel } from './approvalFormFieldsEbayHelpersBasic';

const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const requiredBadgeClass = 'inline-block rounded-full border border-rose-400/45 bg-rose-500/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-rose-200';

interface UseApprovalFormFieldRequirementsParams {
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  allFieldNames: string[];
  requiredFieldNames: string[];
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
  isEbayListingForm: boolean;
  ebayListingFormat: string;
}

export function useApprovalFormFieldRequirements({
  approvalChannel,
  allFieldNames,
  requiredFieldNames,
  shopifyRequiredFieldNames,
  ebayRequiredFieldNames,
  isEbayListingForm,
  ebayListingFormat,
}: UseApprovalFormFieldRequirementsParams) {
  const normalizedRequiredFieldNames = useMemo(
    () => requiredFieldNames.map((fieldName) => fieldName.toLowerCase()),
    [requiredFieldNames],
  );
  const normalizedShopifyRequiredFieldNames = useMemo(
    () => shopifyRequiredFieldNames.map((fieldName) => fieldName.toLowerCase()),
    [shopifyRequiredFieldNames],
  );
  const normalizedEbayRequiredFieldNames = useMemo(
    () => ebayRequiredFieldNames.map((fieldName) => fieldName.toLowerCase()),
    [ebayRequiredFieldNames],
  );
  const hasEbayRequiredPriceField = useMemo(
    () => normalizedEbayRequiredFieldNames.some((fieldName) => isPriceLikeField(fieldName)),
    [normalizedEbayRequiredFieldNames],
  );

  const isShopifyCategoryLikeField = useCallback((fieldName: string): boolean => {
    const normalized = fieldName.trim().toLowerCase();
    return normalized === 'type'
      || normalized === 'shopify type'
      || normalized === 'product type'
      || normalized === 'shopify product type'
      || normalized === 'shopify rest product type'
      || normalized === 'shopify category'
      || normalized === 'shopify product category'
      || normalized === 'shopify rest product category'
      || normalized === 'category'
      || normalized === 'product category';
  }, []);

  const matchesRequiredFieldGroup = useCallback((fieldName: string, normalizedRequiredNames: string[]): boolean => {
    const normalizedFieldName = fieldName.toLowerCase();
    if (normalizedRequiredNames.includes(normalizedFieldName)) return true;

    if (isTitleLikeField(fieldName)) {
      return normalizedRequiredNames.some((requiredFieldName) => isTitleLikeField(requiredFieldName));
    }

    if (isPriceLikeField(fieldName)) {
      return normalizedRequiredNames.some((requiredFieldName) => isPriceLikeField(requiredFieldName));
    }

    if (isShopifyCategoryLikeField(fieldName)) {
      return normalizedRequiredNames.some((requiredFieldName) => isShopifyCategoryLikeField(requiredFieldName));
    }

    return false;
  }, [isShopifyCategoryLikeField]);

  const isForcedEbayPriceRequiredField = useCallback((fieldName: string): boolean => {
    if (!hasEbayRequiredPriceField) return false;
    if (approvalChannel !== 'ebay' && approvalChannel !== 'combined') return false;
    return isEbayPriceFieldAlias(fieldName);
  }, [approvalChannel, hasEbayRequiredPriceField]);

  const isRequiredField = useCallback((fieldName: string): boolean => (
    matchesRequiredFieldGroup(fieldName, normalizedRequiredFieldNames)
    || isForcedEbayPriceRequiredField(fieldName)
  ), [isForcedEbayPriceRequiredField, matchesRequiredFieldGroup, normalizedRequiredFieldNames]);
  const isShopifyRequiredField = useCallback((fieldName: string): boolean => matchesRequiredFieldGroup(fieldName, normalizedShopifyRequiredFieldNames), [matchesRequiredFieldGroup, normalizedShopifyRequiredFieldNames]);
  const isEbayRequiredField = useCallback((fieldName: string): boolean => (
    matchesRequiredFieldGroup(fieldName, normalizedEbayRequiredFieldNames)
    || isForcedEbayPriceRequiredField(fieldName)
  ), [isForcedEbayPriceRequiredField, matchesRequiredFieldGroup, normalizedEbayRequiredFieldNames]);

  const orderedFieldNames = useMemo(() => {
    const required = prioritizeTitleBeforePrice(
      allFieldNames.filter((fieldName) => isRequiredField(fieldName)),
      approvalChannel,
    );
    const optional = prioritizeTitleBeforePrice(
      allFieldNames.filter((fieldName) => !isRequiredField(fieldName)),
      approvalChannel,
    );
    return [...required, ...optional];
  }, [allFieldNames, approvalChannel, isRequiredField]);
  const requiredOrderedFieldNames = useMemo(
    () => orderedFieldNames.filter((fieldName) => isRequiredField(fieldName)),
    [isRequiredField, orderedFieldNames],
  );
  const optionalOrderedFieldNames = useMemo(
    () => orderedFieldNames.filter((fieldName) => !isRequiredField(fieldName)),
    [isRequiredField, orderedFieldNames],
  );

  const toFieldLabel = useCallback((fieldName: string): string => {
    if (isEbayListingForm && fieldName.trim().toLowerCase() === 'ebay offer price value') {
      return getEbayPriceFieldLabel(ebayListingFormat);
    }

    return toHumanReadableLabel(fieldName);
  }, [ebayListingFormat, isEbayListingForm]);

  const getLabelClassName = useCallback((fieldName?: string): string => {
    if (fieldName && isRequiredField(fieldName)) {
      return `${labelClass} text-rose-200`;
    }

    return labelClass;
  }, [isRequiredField]);

  const renderRequiredBadges = useCallback((fieldName: string): JSX.Element | null => {
    const isShopifyRequired = isShopifyRequiredField(fieldName);
    const isEbayRequired = isEbayRequiredField(fieldName);

    if (!isShopifyRequired && !isEbayRequired) return null;

    if (approvalChannel !== 'combined' && isRequiredField(fieldName)) {
      return <span className={requiredBadgeClass}>Required</span>;
    }

    return (
      <>
        {isShopifyRequired && <span className={requiredBadgeClass}>Shopify Required</span>}
        {isEbayRequired && <span className={requiredBadgeClass}>eBay Required</span>}
      </>
    );
  }, [approvalChannel, isEbayRequiredField, isRequiredField, isShopifyRequiredField]);

  const renderFieldLabel = useCallback((fieldName: string): JSX.Element => (
    <span className={`${getLabelClassName(fieldName)} flex items-center gap-2`}>
      <span>{toFieldLabel(fieldName)}</span>
      {renderRequiredBadges(fieldName)}
    </span>
  ), [getLabelClassName, renderRequiredBadges, toFieldLabel]);

  const renderSpecialLabel = useCallback((label: string, fieldName?: string): JSX.Element => (
    <span className={`${getLabelClassName(fieldName)} flex items-center gap-2`}>
      <span>{label}</span>
      {fieldName ? renderRequiredBadges(fieldName) : null}
    </span>
  ), [getLabelClassName, renderRequiredBadges]);

  return {
    isRequiredField,
    optionalOrderedFieldNames,
    renderFieldLabel,
    renderSpecialLabel,
    requiredOrderedFieldNames,
    toFieldLabel,
  };
}