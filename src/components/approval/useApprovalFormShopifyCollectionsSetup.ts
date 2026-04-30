import { useEffect, useMemo, useState } from 'react';
import { buildShopifyCollectionIdsFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
import {
  SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
  getShopifySingleCollectionFieldIndex,
  isCollectionDisplayNameField,
  isShopifyCollectionJsonField,
  isShopifyCompoundCollectionField,
  isShopifySingleCollectionField,
  isSingularCollectionAliasField,
  parseShopifyCollectionIds,
  resolveShopifyCollectionFieldStrategy,
} from './approvalFormFieldsShopifyCollectionHelpers';
import type { ApprovalFieldKind } from './approvalFormFieldSetupTypes';

interface UseApprovalFormShopifyCollectionsSetupParams {
  recordId?: string;
  forceShowShopifyCollectionsEditor: boolean;
  allFieldNames: string[];
  writableFieldNames: string[];
  formValues: Record<string, string>;
  fieldKinds: Record<string, ApprovalFieldKind>;
  normalizedShopifyCollectionIds?: string[];
  normalizedShopifyCollectionLabelsById: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
}

export function useApprovalFormShopifyCollectionsSetup({
  recordId,
  forceShowShopifyCollectionsEditor,
  allFieldNames,
  writableFieldNames,
  formValues,
  fieldKinds,
  normalizedShopifyCollectionIds,
  normalizedShopifyCollectionLabelsById,
  setFormValue,
}: UseApprovalFormShopifyCollectionsSetupParams) {
  const shopifyCompoundCollectionFieldNames = useMemo(
    () => allFieldNames.filter((fieldName) => isShopifyCompoundCollectionField(fieldName)),
    [allFieldNames],
  );
  const shopifySingleCollectionFieldNames = useMemo(
    () => allFieldNames
      .filter((fieldName) => isShopifySingleCollectionField(fieldName))
      .sort((left, right) => getShopifySingleCollectionFieldIndex(left) - getShopifySingleCollectionFieldIndex(right)),
    [allFieldNames],
  );
  const shopifyCollectionStrategy = useMemo(
    () => resolveShopifyCollectionFieldStrategy({
      formValues,
      singleFieldNames: shopifySingleCollectionFieldNames,
      compoundFieldNames: shopifyCompoundCollectionFieldNames,
      writableFieldNames,
    }),
    [formValues, shopifyCompoundCollectionFieldNames, shopifySingleCollectionFieldNames, writableFieldNames],
  );
  const hasShopifyCollectionEditor = forceShowShopifyCollectionsEditor
    || shopifyCompoundCollectionFieldNames.length > 0
    || shopifySingleCollectionFieldNames.length > 0;
  const shopifyCollectionSourceFieldNames = useMemo(
    () => Array.from(new Set([
      ...shopifyCompoundCollectionFieldNames,
      ...shopifySingleCollectionFieldNames,
      SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
    ])),
    [shopifyCompoundCollectionFieldNames, shopifySingleCollectionFieldNames],
  );
  const shopifyCollectionIds = useMemo(() => {
    if (normalizedShopifyCollectionIds) return normalizedShopifyCollectionIds;

    const collectionSourceFields = Object.fromEntries(
      shopifyCollectionSourceFieldNames.map((fieldName) => [fieldName, formValues[fieldName] ?? '']),
    );
    return buildShopifyCollectionIdsFromApprovalFields(collectionSourceFields);
  }, [formValues, normalizedShopifyCollectionIds, shopifyCollectionSourceFieldNames]);
  const [collectionEditorFallbackIds, setCollectionEditorFallbackIds] = useState<string[]>([]);
  const [collectionEditorLabelsById, setCollectionEditorLabelsById] = useState<Record<string, string>>({});

  const effectiveShopifyCollectionIds = shopifyCollectionIds.length > 0
    ? shopifyCollectionIds
    : collectionEditorFallbackIds;
  const effectiveCollectionEditorLabelsById = useMemo(
    () => ({ ...normalizedShopifyCollectionLabelsById, ...collectionEditorLabelsById }),
    [collectionEditorLabelsById, normalizedShopifyCollectionLabelsById],
  );

  useEffect(() => {
    setCollectionEditorFallbackIds([]);
    setCollectionEditorLabelsById({});
  }, [recordId]);

  useEffect(() => {
    if (shopifyCollectionIds.length > 0) {
      setCollectionEditorFallbackIds(shopifyCollectionIds);
    }
  }, [shopifyCollectionIds]);

  function setShopifyCollectionIds(nextCollectionIds: string[], collectionLabelsById: Record<string, string> = {}) {
    const normalizedCollections = parseShopifyCollectionIds(nextCollectionIds);
    setCollectionEditorFallbackIds(normalizedCollections);

    const canonicalCollectionsFieldName = allFieldNames.find((fieldName) => fieldName.trim().toLowerCase() === 'collections') ?? 'Collections';
    const mergedCollectionLabelsById: Record<string, string> = {
      ...effectiveCollectionEditorLabelsById,
      ...collectionLabelsById,
    };
    setCollectionEditorLabelsById(mergedCollectionLabelsById);

    const normalizedCollectionLabels = normalizedCollections
      .map((collectionId) => mergedCollectionLabelsById[collectionId]?.trim() ?? '')
      .filter(Boolean);

    shopifyCollectionStrategy.writeSingleFields.forEach((fieldName, index) => {
      if (isSingularCollectionAliasField(fieldName)) return;

      if (isCollectionDisplayNameField(fieldName)) {
        const fieldKind = fieldKinds[fieldName] ?? 'text';
        const nextSingleLabel = normalizedCollectionLabels[index] ?? '';
        if (fieldKind === 'json') {
          const nextSingle = nextSingleLabel ? [nextSingleLabel] : [];
          setFormValue(fieldName, nextSingle.length > 0 ? JSON.stringify(nextSingle) : '');
          return;
        }

        setFormValue(fieldName, nextSingleLabel);
        return;
      }

      setFormValue(fieldName, normalizedCollections[index] ?? '');
    });

    const canonicalCollectionsFieldKind = fieldKinds[canonicalCollectionsFieldName] ?? 'text';
    const writeCanonicalAsDisplayNames = isCollectionDisplayNameField(canonicalCollectionsFieldName);
    if (normalizedCollections.length === 0) {
      setFormValue(canonicalCollectionsFieldName, '');
    } else if (writeCanonicalAsDisplayNames) {
      if (canonicalCollectionsFieldKind === 'json') {
        setFormValue(canonicalCollectionsFieldName, normalizedCollectionLabels.length > 0 ? JSON.stringify(normalizedCollectionLabels) : '');
      } else {
        setFormValue(canonicalCollectionsFieldName, normalizedCollectionLabels.join(', '));
      }
    } else if (canonicalCollectionsFieldKind === 'json' || isShopifyCollectionJsonField(canonicalCollectionsFieldName)) {
      setFormValue(canonicalCollectionsFieldName, JSON.stringify(normalizedCollections));
    } else {
      setFormValue(canonicalCollectionsFieldName, normalizedCollections.join(', '));
    }

    const writtenCollectionFields = new Set<string>([
      ...shopifyCollectionStrategy.writeSingleFields,
      ...shopifyCollectionStrategy.writeCompoundFields,
    ].map((fieldName) => fieldName.toLowerCase()));

    shopifyCollectionStrategy.writeCompoundFields.forEach((fieldName) => {
      const fieldKind = fieldKinds[fieldName] ?? 'text';

      if (normalizedCollections.length === 0) {
        setFormValue(fieldName, '');
        return;
      }

      if (isCollectionDisplayNameField(fieldName)) {
        if (fieldKind === 'json') {
          setFormValue(fieldName, normalizedCollectionLabels.length > 0 ? JSON.stringify(normalizedCollectionLabels) : '');
          return;
        }

        setFormValue(fieldName, normalizedCollectionLabels.join(', '));
        return;
      }

      if (fieldKind === 'json' || isShopifyCollectionJsonField(fieldName)) {
        setFormValue(fieldName, JSON.stringify(normalizedCollections));
        return;
      }

      setFormValue(fieldName, normalizedCollections.join(', '));
    });

    const fallbackIdField = [
      ...shopifyCollectionStrategy.sourceCompoundFields,
      ...shopifyCollectionStrategy.sourceSingleFields,
      ...shopifyCompoundCollectionFieldNames,
      ...shopifySingleCollectionFieldNames,
    ].find((fieldName) => {
      const normalizedName = fieldName.trim().toLowerCase();
      return !isCollectionDisplayNameField(fieldName) && !writtenCollectionFields.has(normalizedName);
    });

    if (fallbackIdField) {
      if (isSingularCollectionAliasField(fallbackIdField)) {
        setFormValue(
          SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
          normalizedCollections.length > 0 ? JSON.stringify(normalizedCollections) : '',
        );
        return;
      }

      const fieldKind = fieldKinds[fallbackIdField] ?? 'text';

      if (normalizedCollections.length === 0) {
        setFormValue(fallbackIdField, '');
      } else if (fieldKind === 'json' || isShopifyCollectionJsonField(fallbackIdField)) {
        setFormValue(fallbackIdField, JSON.stringify(normalizedCollections));
      } else {
        setFormValue(fallbackIdField, normalizedCollections.join(', '));
      }
    }

    setFormValue(
      SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
      normalizedCollections.length > 0 ? JSON.stringify(normalizedCollections) : '',
    );
  }

  return {
    effectiveCollectionEditorLabelsById,
    effectiveShopifyCollectionIds,
    hasShopifyCollectionEditor,
    setShopifyCollectionIds,
    shopifyCollectionStrategy,
  };
}