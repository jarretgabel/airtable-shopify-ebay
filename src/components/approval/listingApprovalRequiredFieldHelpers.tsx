import { getMissingRequiredFieldNames, isMissingRequiredFieldValue } from '@/components/approval/requiredFieldStatus';
import {
  isPriceLikeFieldName,
  isShopifyCategoryLikeFieldName,
  isTitleLikeFieldName,
  normalizeFieldLookupKey,
} from './listingApprovalFieldHelpers';

export function fieldMatchesRequiredGroup(fieldName: string, requiredFieldName: string): boolean {
  const normalizedField = fieldName.toLowerCase();
  const normalizedRequiredField = requiredFieldName.toLowerCase();

  if (normalizedField === normalizedRequiredField) return true;
  if (isTitleLikeFieldName(fieldName) && isTitleLikeFieldName(requiredFieldName)) return true;
  if (isPriceLikeFieldName(fieldName) && isPriceLikeFieldName(requiredFieldName)) return true;
  if (isShopifyCategoryLikeFieldName(fieldName) && isShopifyCategoryLikeFieldName(requiredFieldName)) return true;

  return false;
}

export function getRequiredFieldGroupKey(fieldName: string): string {
  if (isTitleLikeFieldName(fieldName)) return 'title';
  if (isPriceLikeFieldName(fieldName)) return 'price';
  if (isShopifyCategoryLikeFieldName(fieldName)) return 'shopify-category';
  return normalizeFieldLookupKey(fieldName);
}

export function getDrawerRequiredStatus(
  fieldNames: string[],
  requiredFieldNames: string[],
  source: Record<string, unknown>,
): { hasRequired: boolean; allFilled: boolean } {
  if (fieldNames.length === 0 || requiredFieldNames.length === 0) {
    return { hasRequired: false, allFilled: false };
  }

  const matchedFieldNamesByGroup = new Map<string, string>();

  requiredFieldNames.forEach((requiredFieldName) => {
    const groupKey = getRequiredFieldGroupKey(requiredFieldName);
    if (matchedFieldNamesByGroup.has(groupKey)) return;

    const exactMatch = fieldNames.find((fieldName) => fieldName.toLowerCase() === requiredFieldName.toLowerCase());
    if (exactMatch && !isMissingRequiredFieldValue(exactMatch, source[exactMatch])) {
      matchedFieldNamesByGroup.set(groupKey, exactMatch);
      return;
    }

    const groupedMatches = fieldNames.filter((fieldName) => fieldMatchesRequiredGroup(fieldName, requiredFieldName));
    if (groupedMatches.length === 0) return;

    const firstFilledMatch = groupedMatches.find((fieldName) => !isMissingRequiredFieldValue(fieldName, source[fieldName]));
    matchedFieldNamesByGroup.set(groupKey, firstFilledMatch ?? exactMatch ?? groupedMatches[0]);
  });

  const matchedFieldNames = Array.from(matchedFieldNamesByGroup.values());

  if (matchedFieldNames.length === 0) {
    return { hasRequired: false, allFilled: false };
  }

  return {
    hasRequired: true,
    allFilled: getMissingRequiredFieldNames(source, matchedFieldNames).length === 0,
  };
}

export function DrawerStatusIcon({ allFilled }: { allFilled: boolean }) {
  return (
    <span
      className={`inline-flex items-center ${allFilled ? 'text-emerald-200' : 'text-rose-200'}`}
      aria-label={allFilled ? 'All required fields filled' : 'Contains missing required fields'}
      title={allFilled ? 'All required fields filled' : 'Contains missing required fields'}
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        {allFilled ? (
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.78-9.97a.75.75 0 0 0-1.06-1.06L8.75 10.94 7.28 9.47a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z" clipRule="evenodd" />
        ) : (
          <path fillRule="evenodd" d="M10 2.5a1 1 0 0 1 .874.514l6.5 12A1 1 0 0 1 16.5 16.5h-13a1 1 0 0 1-.874-1.486l6.5-12A1 1 0 0 1 10 2.5Zm0 4a1 1 0 0 0-1 1V10a1 1 0 1 0 2 0V7.5a1 1 0 0 0-1-1Zm0 7a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clipRule="evenodd" />
        )}
      </svg>
    </span>
  );
}