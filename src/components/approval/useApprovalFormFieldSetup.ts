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
    () => findWorkflowImageAttachmentFieldName(allFieldNames),
    [allFieldNames],
  );
  const workflowImageMetadataFieldName = useMemo(
    () => findWorkflowImageMetadataFieldName(allFieldNames),
    [allFieldNames],
  );
  const workflowImageMetadata = useMemo(
    () => parseWorkflowImageMetadata(workflowImageMetadataFieldName ? (originalFieldValues[workflowImageMetadataFieldName] ?? '') : ''),
    [originalFieldValues, workflowImageMetadataFieldName],
  );
  const workflowImageAttachments = useMemo(
    () => {
      const attachments = parseWorkflowImageAttachments(workflowImageAttachmentFieldName ? (originalFieldValues[workflowImageAttachmentFieldName] ?? '') : '');
      if (workflowImageMetadata.length === 0) return attachments;

      const sortOrderByUrl = new Map(
        workflowImageMetadata.map((record) => [record.url.trim().toLowerCase(), record.sortOrder] as const),
      );

      return [...attachments].sort((left, right) => {
        const leftOrder = sortOrderByUrl.get(left.url.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = sortOrderByUrl.get(right.url.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.filename.localeCompare(right.filename);
      });
    },
    [originalFieldValues, workflowImageAttachmentFieldName, workflowImageMetadata],
  );
  const selectedWorkflowImageUrls = useMemo(() => {
    const currentRows = parseWorkflowSelectedImageRows(
      imageUrlSourceField ? (formValues[imageUrlSourceField] ?? '') : '',
      imageAltTextSourceField ? (formValues[imageAltTextSourceField] ?? '') : '',
      shopifyImagePayloadFieldName ? (formValues[shopifyImagePayloadFieldName] ?? '') : '',
    );
    if (currentRows.length === 0) {
      return buildWorkflowListingSelectionFromMetadata(workflowImageMetadata);
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

  useEffect(() => {
    if (!shopifySetup.shopifyBodyHtmlFieldName) return;

    const nextBodyHtml = derivedBodyHtmlPreview;
    const currentBodyHtml = formValues[shopifySetup.shopifyBodyHtmlFieldName] ?? '';

    if (currentBodyHtml !== nextBodyHtml) {
      setDerivedFormValue(shopifySetup.shopifyBodyHtmlFieldName, nextBodyHtml);
    }
  }, [
    derivedBodyHtmlPreview,
    setDerivedFormValue,
    shopifySetup.shopifyBodyHtmlFieldName,
    formValues,
  ]);

  useEffect(() => {
    if (!ebaySetup.ebayBodyHtmlFieldName) return;

    const nextBodyHtml = derivedBodyHtmlPreview;
    const currentBodyHtml = formValues[ebaySetup.ebayBodyHtmlFieldName] ?? '';

    if (currentBodyHtml !== nextBodyHtml) {
      setDerivedFormValue(ebaySetup.ebayBodyHtmlFieldName, nextBodyHtml);
    }
  }, [derivedBodyHtmlPreview, ebaySetup.ebayBodyHtmlFieldName, formValues, setDerivedFormValue]);

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