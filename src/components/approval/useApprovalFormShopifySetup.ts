import { useEffect, useMemo, useState } from 'react';
import { buildShopifyCollectionIdsFromApprovalFields } from '@/services/shopifyDraftFromAirtable';
import { parseShopifyTagList, serializeShopifyTagsCsv, serializeShopifyTagsJson } from '@/services/shopifyTags';
import {
  isShopifyBodyDescriptionField,
  isShopifyBodyHtmlPrimaryField,
  isShopifyBodyHtmlTemplateField,
  isShopifyKeyFeaturesField,
} from './approvalFormFieldsBasicHelpers';
import {
  SHOPIFY_COLLECTION_IDS_PREVIEW_FIELD,
  getShopifySingleCollectionFieldIndex,
  getShopifySingleTagFieldIndex,
  isCollectionDisplayNameField,
  isShopifyCollectionJsonField,
  isShopifyCompoundCollectionField,
  isShopifyCompoundTagsField,
  isShopifySingleCollectionField,
  isShopifySingleTagField,
  isShopifyTagsJsonField,
  isSingularCollectionAliasField,
  parseShopifyCollectionIds,
  resolveShopifyCollectionFieldStrategy,
  resolveShopifyTagFieldStrategy,
} from './approvalFormFieldsShopifyHelpers';
import type { ApprovalFormFieldSetupParams } from './approvalFormFieldSetupTypes';

type UseApprovalFormShopifySetupParams = Pick<ApprovalFormFieldSetupParams,
  'recordId'
  | 'approvalChannel'
  | 'forceShowShopifyCollectionsEditor'
  | 'allFieldNames'
  | 'writableFieldNames'
  | 'formValues'
  | 'fieldKinds'
  | 'normalizedShopifyTagValues'
  | 'normalizedShopifyCollectionIds'
  | 'normalizedShopifyCollectionLabelsById'
  | 'setFormValue'
>;

export function useApprovalFormShopifySetup({
  recordId,
  approvalChannel,
  forceShowShopifyCollectionsEditor,
  allFieldNames,
  writableFieldNames,
  formValues,
  fieldKinds,
  normalizedShopifyTagValues,
  normalizedShopifyCollectionIds,
  normalizedShopifyCollectionLabelsById,
  setFormValue,
}: UseApprovalFormShopifySetupParams) {
  const isShopifyApprovalForm = approvalChannel === 'shopify';
  const shopifyBodyDescriptionFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyDescriptionField(fieldName))
    : undefined;
  const shopifyKeyFeaturesCandidateFieldNames = isShopifyApprovalForm
    ? allFieldNames.filter((fieldName) => isShopifyKeyFeaturesField(fieldName))
    : [];
  const shopifyKeyFeaturesFieldName = isShopifyApprovalForm
    ? shopifyKeyFeaturesCandidateFieldNames.find((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      return normalized === 'key features'
        || normalized === 'key features json'
        || normalized === 'features'
        || normalized === 'features json'
        || normalized === 'shopify body key features json'
        || normalized === 'shopify rest body key features json'
        || normalized === 'shopify body key features'
        || normalized === 'shopify rest body key features';
    }) ?? shopifyKeyFeaturesCandidateFieldNames[0]
    : undefined;
  const shopifyKeyFeaturesSyncFieldNames = shopifyKeyFeaturesCandidateFieldNames.filter((fieldName) => fieldName !== shopifyKeyFeaturesFieldName);
  const shopifyBodyHtmlFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyHtmlPrimaryField(fieldName))
    : undefined;
  const shopifyBodyHtmlTemplateFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyHtmlTemplateField(fieldName))
    : undefined;
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
    hasShopifyTagEditor,
    isShopifyApprovalForm,
    setShopifyCollectionIds,
    setShopifyTagValues,
    shopifyBodyDescriptionFieldName,
    shopifyBodyHtmlFieldName,
    shopifyBodyHtmlTemplateFieldName,
    shopifyCollectionStrategy,
    shopifyKeyFeaturesFieldName,
    shopifyKeyFeaturesSyncFieldNames,
    shopifyTagStrategy,
    shopifyTagValues,
  };
}