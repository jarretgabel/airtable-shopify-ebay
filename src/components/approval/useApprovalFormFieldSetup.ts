import { useEffect, useMemo } from 'react';
import {
  isGenericImageAltField,
  isGenericImageUrlField,
  isHiddenCombinedFieldName,
  isShopifyImagePayloadField,
  parseImageEditorRows,
  pickPreferredField,
} from './approvalFormFieldsImageHelpers';
import type { ApprovalFormFieldSetupParams } from './approvalFormFieldSetupTypes';
import {
  buildWorkflowListingSelectionFromMetadata,
  findWorkflowImageAttachmentFieldName,
  findWorkflowImageMetadataFieldName,
  parseWorkflowImageAttachments,
  parseWorkflowSelectedImageRows,
} from './workflowListingImageHelpers';
import { parseWorkflowImageMetadata } from '@/services/workflowImageMetadata';
import { useApprovalFormEbaySetup } from './useApprovalFormEbaySetup';
import { useApprovalFormShopifySetup } from './useApprovalFormShopifySetup';

function isProcessedWorkflowImage(filename: string, url?: string): boolean {
  const sample = `${filename} ${url ?? ''}`.toLowerCase();
  return /(^|[-_])processed/.test(sample);
}

function getGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('drive.google.com')) return null;

    const queryId = parsed.searchParams.get('id')?.trim();
    if (queryId) return queryId;

    const pathMatch = parsed.pathname.match(/\/d\/([^/]+)/);
    return pathMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeIdentityToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9]+/g, '');
}

function getUrlBasename(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return (parsed.pathname.split('/').pop() ?? '').trim();
  } catch {
    return (trimmed.split('/').pop() ?? '').trim();
  }
}

function getWorkflowAttachmentIdentity(attachment: { filename: string; url: string }): string {
  const driveId = getGoogleDriveFileId(attachment.url);
  if (driveId) return `gdrive:${driveId.toLowerCase()}`;

  const normalizedFilename = normalizeIdentityToken(attachment.filename);
  if (normalizedFilename) return `filename:${normalizedFilename}`;

  const normalizedBasename = normalizeIdentityToken(getUrlBasename(attachment.url));
  if (normalizedBasename) return `basename:${normalizedBasename}`;

  return `url:${attachment.url.trim().toLowerCase()}`;
}

export function useApprovalFormFieldSetup({
  recordId,
  approvalChannel,
  forceShowShopifyCollectionsEditor,
  isCombinedApproval,
  allFieldNames,
  writableFieldNames,
  formValues,
  fieldKinds,
  originalFieldValues,
  normalizedBodyHtmlPreview,
  normalizedShopifyTagValues,
  normalizedShopifyCollectionIds,
  normalizedShopifyCollectionLabelsById,
  setFormValue,
  setDerivedFormValue,
  selectedEbayTemplateId,
  onEbayTemplateIdChange,
}: ApprovalFormFieldSetupParams) {
  const preferredShopifyPriceFieldName = useMemo(
    () => pickPreferredField(
      allFieldNames.filter((fieldName) => {
        const normalized = fieldName.trim().toLowerCase();
        return normalized === 'shopify rest variant 1 price'
          || normalized === 'shopify variant 1 price'
          || normalized === 'shopify_rest_variant_1_price'
          || normalized === 'shopify price'
          || normalized === 'price';
      }),
      [
        'Shopify REST Variant 1 Price',
        'Shopify Variant 1 Price',
        'shopify_rest_variant_1_price',
        'Shopify Price',
        'Price',
      ],
      formValues,
    ),
    [allFieldNames, formValues],
  );

  const imageUrlSourceField = pickPreferredField(
    allFieldNames.filter((fieldName) => !isHiddenCombinedFieldName(fieldName) && isGenericImageUrlField(fieldName)),
    ['Images', 'images', 'Image URLs', 'image_urls', 'Image URL', 'image_url'],
    formValues,
  );
  const imageAltTextSourceField = pickPreferredField(
    allFieldNames.filter((fieldName) => isGenericImageAltField(fieldName)),
    ['Images Alt Text', 'images_alt_text', 'Image Alt Text', 'image_alt_text'],
    formValues,
  );
  const shopifyImagePayloadFieldName = pickPreferredField(
    allFieldNames.filter((fieldName) => isShopifyImagePayloadField(fieldName)),
    [
      'Shopify REST Images JSON',
      'shopify_rest_images_json',
      'Shopify Images JSON',
      'shopify_images_json',
      'Shopify REST Images',
      'shopify_rest_images',
      'Shopify Images',
      'shopify_images',
    ],
    formValues,
  );
  const useCombinedImageAltEditor = Boolean(
    ((allFieldNames.some((fieldName) => {
      const normalized = fieldName.toLowerCase();
      return normalized.startsWith('ebay ') || normalized.startsWith('ebay_');
    })) || isCombinedApproval)
    && imageUrlSourceField
    && imageAltTextSourceField
    && imageUrlSourceField !== imageAltTextSourceField,
  );
  const combinedImageEditorValue = useCombinedImageAltEditor
    ? JSON.stringify((() => {
      const urlRows = parseImageEditorRows(formValues[imageUrlSourceField ?? ''] ?? '');
      const altParts = (formValues[imageAltTextSourceField ?? ''] ?? '')
        .split(/[\n,]/)
        .map((part) => part.trim());
      const rowCount = Math.max(urlRows.length, altParts.filter((part) => part.length > 0).length);

      if (rowCount === 0) return [] as Array<{ src: string; alt: string }>;

      return Array.from({ length: rowCount }, (_unused, index) => ({
        src: urlRows[index]?.src ?? '',
        alt: altParts[index] ?? urlRows[index]?.alt ?? '',
      }));
    })())
    : '';
  const workflowImageAttachmentFieldName = useMemo(
    () => {
      const discoveryFieldNames = Array.from(new Set([
        ...allFieldNames,
        ...Object.keys(originalFieldValues),
        ...Object.keys(formValues),
      ]));
      return findWorkflowImageAttachmentFieldName(discoveryFieldNames);
    },
    [allFieldNames, formValues, originalFieldValues],
  );
  const workflowImageMetadataFieldName = useMemo(
    () => {
      const discoveryFieldNames = Array.from(new Set([
        ...allFieldNames,
        ...Object.keys(originalFieldValues),
        ...Object.keys(formValues),
      ]));
      return findWorkflowImageMetadataFieldName(discoveryFieldNames);
    },
    [allFieldNames, formValues, originalFieldValues],
  );
  const workflowImageMetadata = useMemo(
    () => {
      const metadataRaw = workflowImageMetadataFieldName
        ? (originalFieldValues[workflowImageMetadataFieldName] ?? formValues[workflowImageMetadataFieldName] ?? '')
        : (
          originalFieldValues['Workflow Image Metadata JSON']
          ?? formValues['Workflow Image Metadata JSON']
          ?? originalFieldValues['Workflow Image Metadata']
          ?? formValues['Workflow Image Metadata']
          ?? ''
        );

      return parseWorkflowImageMetadata(metadataRaw);
    },
    [formValues, originalFieldValues, workflowImageMetadataFieldName],
  );
  const workflowImageAttachments = useMemo(
    () => {
      const attachmentsRaw = workflowImageAttachmentFieldName
        ? (originalFieldValues[workflowImageAttachmentFieldName] ?? formValues[workflowImageAttachmentFieldName] ?? '')
        : (originalFieldValues.Images ?? formValues.Images ?? '');
      const attachments = parseWorkflowImageAttachments(attachmentsRaw);
      if (workflowImageMetadata.length === 0) return attachments;

      const metadataAttachments = workflowImageMetadata
        .filter((record) => record.sourceStage !== 'intake')
        .filter((record) => isProcessedWorkflowImage(record.filename, record.url))
        .map((record) => ({
          id: record.attachmentId,
          url: record.url,
          filename: record.filename,
        }));

      const mergedByUrl = new Map<string, { id?: string; url: string; filename: string }>();

      metadataAttachments.forEach((attachment) => {
        const key = attachment.url.trim().toLowerCase();
        if (!key) return;
        mergedByUrl.set(key, attachment);
      });

      attachments.forEach((attachment) => {
        const key = attachment.url.trim().toLowerCase();
        if (!key || mergedByUrl.has(key)) return;
        mergedByUrl.set(key, attachment);
      });

      const metadataByUrl = new Map(
        workflowImageMetadata.map((record) => [record.url.trim().toLowerCase(), record] as const),
      );

      // Only include testing and photography images in the listing image selector.
      const listingAttachments = Array.from(mergedByUrl.values()).filter((attachment) => {
        const meta = metadataByUrl.get(attachment.url.trim().toLowerCase());
        return !meta || meta.sourceStage !== 'intake';
      });

      const dedupedListingAttachments: typeof listingAttachments = [];
      const seenIdentities = new Set<string>();
      listingAttachments.forEach((attachment) => {
        const identity = getWorkflowAttachmentIdentity(attachment);
        if (!identity || seenIdentities.has(identity)) return;
        seenIdentities.add(identity);
        dedupedListingAttachments.push(attachment);
      });

      const sortOrderByUrl = new Map(
        workflowImageMetadata.map((record) => [record.url.trim().toLowerCase(), record.sortOrder] as const),
      );

      return [...dedupedListingAttachments].sort((left, right) => {
        const leftOrder = sortOrderByUrl.get(left.url.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = sortOrderByUrl.get(right.url.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.filename.localeCompare(right.filename);
      });
    },
    [formValues, originalFieldValues, workflowImageAttachmentFieldName, workflowImageMetadata],
  );
  const selectedWorkflowImageUrls = useMemo(() => {
    const currentRows = parseWorkflowSelectedImageRows(
      imageUrlSourceField ? (formValues[imageUrlSourceField] ?? '') : '',
      imageAltTextSourceField ? (formValues[imageAltTextSourceField] ?? '') : '',
      shopifyImagePayloadFieldName ? (formValues[shopifyImagePayloadFieldName] ?? '') : '',
    );
    if (currentRows.length === 0) {
      // Exclude intake images from the default listing selection
      return buildWorkflowListingSelectionFromMetadata(
        workflowImageMetadata.filter((m) => m.sourceStage !== 'intake'),
      );
    }

    const attachmentLookup = new Map(
      workflowImageAttachments.map((attachment) => [attachment.url.trim().toLowerCase(), attachment.url.trim()] as const),
    );
    return currentRows
      .map((row) => row.src.trim())
      .filter(Boolean)
      .map((url) => attachmentLookup.get(url.toLowerCase()) ?? url);
  }, [
    formValues,
    imageAltTextSourceField,
    imageUrlSourceField,
    shopifyImagePayloadFieldName,
    workflowImageAttachments,
    workflowImageMetadata,
  ]);

  const ebaySetup = useApprovalFormEbaySetup({
    recordId,
    approvalChannel,
    isCombinedApproval,
    allFieldNames,
    writableFieldNames,
    formValues,
    originalFieldValues,
    setFormValue,
    setDerivedFormValue,
    selectedEbayTemplateId,
    onEbayTemplateIdChange,
  });
  const shopifySetup = useApprovalFormShopifySetup({
    recordId,
    approvalChannel,
    isCombinedApproval,
    forceShowShopifyCollectionsEditor,
    allFieldNames,
    writableFieldNames,
    formValues,
    fieldKinds,
    normalizedShopifyTagValues,
    normalizedShopifyCollectionIds,
    normalizedShopifyCollectionLabelsById,
    setFormValue,
    setDerivedFormValue,
  });

  const derivedBodyHtmlPreview = normalizedBodyHtmlPreview ?? '';

  const activeBodyDescriptionFieldName = shopifySetup.shopifyBodyDescriptionFieldName ?? ebaySetup.ebayBodyDescriptionFieldName;

  return {
    activeBodyDescriptionFieldName,
    combinedImageEditorValue,
    derivedBodyHtmlPreview,
    ...ebaySetup,
    ...shopifySetup,
    imageAltTextSourceField,
    imageUrlSourceField,
    preferredShopifyPriceFieldName,
    selectedWorkflowImageUrls,
    shopifyImagePayloadFieldName,
    useCombinedImageAltEditor,
    workflowImageAttachments,
  };
}