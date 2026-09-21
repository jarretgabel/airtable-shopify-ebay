import { useMemo } from 'react';
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

function isGoogleDriveUrl(url: string): boolean {
  if (getGoogleDriveFileId(url)) return true;

  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('googleusercontent.com');
  } catch {
    return false;
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
  const hasScopedImageField = allFieldNames.some((fieldName) => (
    isGenericImageUrlField(fieldName)
    || isGenericImageAltField(fieldName)
    || isShopifyImagePayloadField(fieldName)
  ));

  const imageFieldDiscoveryNames = useMemo(
    () => Array.from(new Set([
      ...allFieldNames,
      ...Object.keys(originalFieldValues),
      ...Object.keys(formValues),
    ])),
    [allFieldNames, formValues, originalFieldValues],
  );

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
    imageFieldDiscoveryNames.filter((fieldName) => !isHiddenCombinedFieldName(fieldName) && isGenericImageUrlField(fieldName)),
    ['Images', 'images', 'Image URLs', 'image_urls', 'Image URL', 'image_url'],
    formValues,
  );
  const imageAltTextSourceField = pickPreferredField(
    imageFieldDiscoveryNames.filter((fieldName) => isGenericImageAltField(fieldName)),
    ['Images Alt Text', 'images_alt_text', 'Image Alt Text', 'image_alt_text'],
    formValues,
  );
  const shopifyImagePayloadFieldName = pickPreferredField(
    imageFieldDiscoveryNames.filter((fieldName) => isShopifyImagePayloadField(fieldName)),
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
    ((imageFieldDiscoveryNames.some((fieldName) => {
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
      return findWorkflowImageAttachmentFieldName(imageFieldDiscoveryNames);
    },
    [imageFieldDiscoveryNames],
  );
  const workflowImageMetadataFieldName = useMemo(
    () => {
      return findWorkflowImageMetadataFieldName(imageFieldDiscoveryNames);
    },
    [imageFieldDiscoveryNames],
  );
  const workflowImageMetadata = useMemo(
    () => {
      const metadataRaw = workflowImageMetadataFieldName
        ? (formValues[workflowImageMetadataFieldName] ?? originalFieldValues[workflowImageMetadataFieldName] ?? '')
        : (
          formValues['Workflow Image Metadata JSON']
          ?? originalFieldValues['Workflow Image Metadata JSON']
          ?? formValues['Workflow Image Metadata']
          ?? originalFieldValues['Workflow Image Metadata']
          ?? ''
        );

      return parseWorkflowImageMetadata(metadataRaw);
    },
    [formValues, originalFieldValues, workflowImageMetadataFieldName],
  );
  const workflowImageAttachments = useMemo(
    () => {
      const attachmentsRaw = workflowImageAttachmentFieldName
        ? (formValues[workflowImageAttachmentFieldName] ?? originalFieldValues[workflowImageAttachmentFieldName] ?? '')
        : (formValues.Images ?? originalFieldValues.Images ?? '');
      const attachments = parseWorkflowImageAttachments(attachmentsRaw);
      if (workflowImageMetadata.length === 0) {
        return attachments.filter((attachment) => isProcessedWorkflowImage(attachment.filename, attachment.url));
      }

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
        if (!isProcessedWorkflowImage(attachment.filename, attachment.url)) return;
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

      const dedupedByIdentity = new Map<string, (typeof listingAttachments)[number]>();
      listingAttachments.forEach((attachment) => {
        const identity = getWorkflowAttachmentIdentity(attachment);
        if (!identity) return;

        const existing = dedupedByIdentity.get(identity);
        if (!existing) {
          dedupedByIdentity.set(identity, attachment);
          return;
        }

        const shouldPromoteToDrive = isGoogleDriveUrl(attachment.url) && !isGoogleDriveUrl(existing.url);
        if (shouldPromoteToDrive) {
          dedupedByIdentity.set(identity, attachment);
        }
      });
      const dedupedListingAttachments = Array.from(dedupedByIdentity.values());

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
  const effectiveImageUrlSourceField = imageUrlSourceField
    ?? ((isCombinedApproval && hasScopedImageField && workflowImageAttachments.length > 0) ? 'Images' : undefined);
  const effectiveShopifyImagePayloadFieldName = shopifyImagePayloadFieldName
    ?? ((isCombinedApproval && hasScopedImageField && workflowImageAttachments.length > 0) ? 'Shopify REST Images JSON' : undefined);
  const writableFieldNameLookup = useMemo(
    () => new Set(writableFieldNames.map((fieldName) => fieldName.trim().toLowerCase())),
    [writableFieldNames],
  );
  const isWorkflowMetadataWritable = Boolean(
    workflowImageMetadataFieldName
    && writableFieldNameLookup.has(workflowImageMetadataFieldName.trim().toLowerCase()),
  );
  const selectedWorkflowImageUrls = useMemo(() => {
    const imageUrlValue = effectiveImageUrlSourceField ? (formValues[effectiveImageUrlSourceField] ?? '') : '';
    const imageAltTextValue = imageAltTextSourceField ? (formValues[imageAltTextSourceField] ?? '') : '';
    const payloadValue = effectiveShopifyImagePayloadFieldName ? (formValues[effectiveShopifyImagePayloadFieldName] ?? '') : '';
    const currentRows = parseWorkflowSelectedImageRows(
      imageUrlValue,
      imageAltTextValue,
      payloadValue,
    );
    const explicitEmptySelection = payloadValue.trim() === '[]';
    const hasExplicitSelectionInput = explicitEmptySelection
      || imageUrlValue.trim().length > 0
      || imageAltTextValue.trim().length > 0
      || payloadValue.trim().length > 0;

    const metadataSelectedUrls = workflowImageMetadataFieldName
      ? (() => {
          const attachmentUrlLookup = new Set(
            workflowImageAttachments.map((attachment) => attachment.url.trim().toLowerCase()).filter(Boolean),
          );
          const attachmentUrlByFilenameIdentity = new Map<string, string>();
          workflowImageAttachments.forEach((attachment) => {
            const key = normalizeIdentityToken(attachment.filename);
            const url = attachment.url.trim();
            if (!key || !url || attachmentUrlByFilenameIdentity.has(key)) return;
            attachmentUrlByFilenameIdentity.set(key, url);
          });

          return buildWorkflowListingSelectionFromMetadata(
            workflowImageMetadata
              .filter((record) => record.sourceStage !== 'intake')
              .filter((record) => isProcessedWorkflowImage(record.filename, record.url))
              .map((record) => {
                const urlKey = record.url.trim().toLowerCase();
                if (urlKey && attachmentUrlLookup.has(urlKey)) {
                  return record;
                }

                const identityKey = normalizeIdentityToken(record.filename);
                const canonicalAttachmentUrl = identityKey ? attachmentUrlByFilenameIdentity.get(identityKey) : undefined;
                if (!canonicalAttachmentUrl) {
                  return record;
                }

                return {
                  ...record,
                  url: canonicalAttachmentUrl,
                };
              }),
          );
        })()
      : [];

    if (explicitEmptySelection) {
      return [];
    }

    if (workflowImageMetadataFieldName && workflowImageMetadata.length > 0 && isWorkflowMetadataWritable) {
      return metadataSelectedUrls;
    }

    if (currentRows.length === 0 && !hasExplicitSelectionInput) {
      // Default listing detail pages to all available workflow attachments.
      const defaultSelectedUrls: string[] = [];
      const seenUrls = new Set<string>();
      workflowImageAttachments.forEach((attachment) => {
        const trimmed = attachment.url.trim();
        const key = trimmed.toLowerCase();
        if (!trimmed || seenUrls.has(key)) return;
        seenUrls.add(key);
        defaultSelectedUrls.push(trimmed);
      });
      return defaultSelectedUrls;
    }

    const attachmentLookup = new Map(
      workflowImageAttachments.map((attachment) => [attachment.url.trim().toLowerCase(), attachment.url.trim()] as const),
    );
    const workflowAttachmentByIdentity = new Map(
      workflowImageAttachments.map((attachment) => [getWorkflowAttachmentIdentity(attachment), attachment.url.trim()] as const),
    );
    const workflowAttachmentByFilenameIdentity = new Map(
      workflowImageAttachments
        .map((attachment) => [normalizeIdentityToken(attachment.filename), attachment.url.trim()] as const)
        .filter(([identity]) => identity.length > 0),
    );
    const selectedImageAttachments = parseWorkflowImageAttachments(imageUrlValue);
    const selectedAttachmentByUrl = new Map(
      selectedImageAttachments.map((attachment) => [attachment.url.trim().toLowerCase(), attachment] as const),
    );

    const mappedCurrentRowUrls = currentRows
      .map((row) => row.src.trim())
      .filter(Boolean)
      .map((url) => {
        const normalizedUrl = url.toLowerCase();
        const selectedAttachment = selectedAttachmentByUrl.get(normalizedUrl);
        if (selectedAttachment) {
          const identityMatch = workflowAttachmentByIdentity.get(getWorkflowAttachmentIdentity(selectedAttachment));
          if (identityMatch) {
            return identityMatch;
          }

          const filenameIdentityMatch = workflowAttachmentByFilenameIdentity.get(normalizeIdentityToken(selectedAttachment.filename));
          if (filenameIdentityMatch) {
            return filenameIdentityMatch;
          }
        }

        const exactUrlMatch = attachmentLookup.get(normalizedUrl);
        if (exactUrlMatch) {
          return exactUrlMatch;
        }

        return url;
      })
      .filter(Boolean);

    if (workflowImageMetadataFieldName && metadataSelectedUrls.length > 0 && !hasExplicitSelectionInput) {
      return metadataSelectedUrls;
    }

    return mappedCurrentRowUrls;
  }, [
    effectiveImageUrlSourceField,
    effectiveShopifyImagePayloadFieldName,
    formValues,
    imageAltTextSourceField,
    workflowImageAttachments,
    workflowImageMetadataFieldName,
    isWorkflowMetadataWritable,
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
    imageUrlSourceField: effectiveImageUrlSourceField,
    preferredShopifyPriceFieldName,
    selectedWorkflowImageUrls,
    shopifyImagePayloadFieldName: effectiveShopifyImagePayloadFieldName,
    useCombinedImageAltEditor,
    workflowImageAttachments,
    workflowImageMetadataFieldName,
  };
}