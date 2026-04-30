import { useMemo } from 'react';
import { parseShopifyTagList, serializeShopifyTagsCsv, serializeShopifyTagsJson } from '@/services/shopifyTags';
import {
  getShopifySingleTagFieldIndex,
  isShopifyCompoundTagsField,
  isShopifySingleTagField,
  isShopifyTagsJsonField,
  resolveShopifyTagFieldStrategy,
} from './approvalFormFieldsShopifyTagHelpers';
import type { ApprovalFieldKind } from './approvalFormFieldSetupTypes';

interface UseApprovalFormShopifyTagsSetupParams {
  allFieldNames: string[];
  writableFieldNames: string[];
  formValues: Record<string, string>;
  fieldKinds: Record<string, ApprovalFieldKind>;
  normalizedShopifyTagValues?: string[];
  setFormValue: (fieldName: string, value: string) => void;
}

export function useApprovalFormShopifyTagsSetup({
  allFieldNames,
  writableFieldNames,
  formValues,
  fieldKinds,
  normalizedShopifyTagValues,
  setFormValue,
}: UseApprovalFormShopifyTagsSetupParams) {
  const shopifyCompoundTagFieldNames = useMemo(
    () => allFieldNames.filter((fieldName) => isShopifyCompoundTagsField(fieldName)),
    [allFieldNames],
  );
  const shopifySingleTagFieldNames = useMemo(
    () => allFieldNames
      .filter((fieldName) => isShopifySingleTagField(fieldName))
      .sort((left, right) => getShopifySingleTagFieldIndex(left) - getShopifySingleTagFieldIndex(right)),
    [allFieldNames],
  );
  const shopifyTagStrategy = useMemo(
    () => resolveShopifyTagFieldStrategy({
      formValues,
      singleFieldNames: shopifySingleTagFieldNames,
      compoundFieldNames: shopifyCompoundTagFieldNames,
      writableFieldNames,
    }),
    [formValues, shopifyCompoundTagFieldNames, shopifySingleTagFieldNames, writableFieldNames],
  );
  const hasShopifyTagEditor = shopifyCompoundTagFieldNames.length > 0 || shopifySingleTagFieldNames.length > 0;
  const shopifyTagValues = useMemo(() => {
    if (normalizedShopifyTagValues) return normalizedShopifyTagValues;

    const compoundTags = shopifyTagStrategy.sourceCompoundFields.flatMap((fieldName) => parseShopifyTagList(formValues[fieldName] ?? ''));
    const singleTags = shopifyTagStrategy.sourceSingleFields.flatMap((fieldName) => parseShopifyTagList(formValues[fieldName] ?? ''));
    return parseShopifyTagList([...singleTags, ...compoundTags]);
  }, [formValues, normalizedShopifyTagValues, shopifyTagStrategy.sourceCompoundFields, shopifyTagStrategy.sourceSingleFields]);

  function setShopifyTagValues(nextTags: string[]) {
    const normalizedTags = parseShopifyTagList(nextTags);

    shopifyTagStrategy.writeSingleFields.forEach((fieldName, index) => {
      setFormValue(fieldName, normalizedTags[index] ?? '');
    });

    shopifyTagStrategy.writeCompoundFields.forEach((fieldName) => {
      const fieldKind = fieldKinds[fieldName] ?? 'text';
      setFormValue(
        fieldName,
        normalizedTags.length === 0
          ? ''
          : fieldKind === 'json' || isShopifyTagsJsonField(fieldName)
            ? serializeShopifyTagsJson(normalizedTags)
            : serializeShopifyTagsCsv(normalizedTags),
      );
    });
  }

  return {
    hasShopifyTagEditor,
    setShopifyTagValues,
    shopifyTagStrategy,
    shopifyTagValues,
  };
}