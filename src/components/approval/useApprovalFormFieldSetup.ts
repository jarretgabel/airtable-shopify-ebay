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

  const ebaySetup = useApprovalFormEbaySetup({
    recordId,
    approvalChannel,
    isCombinedApproval,
    allFieldNames,
    writableFieldNames,
    formValues,
    originalFieldValues,
    setFormValue,
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
  });

  const derivedBodyHtmlPreview = normalizedBodyHtmlPreview ?? '';

  useEffect(() => {
    if (!shopifySetup.shopifyBodyHtmlFieldName) return;

    const nextBodyHtml = derivedBodyHtmlPreview;
    const currentBodyHtml = formValues[shopifySetup.shopifyBodyHtmlFieldName] ?? '';

    if (currentBodyHtml !== nextBodyHtml) {
      setFormValue(shopifySetup.shopifyBodyHtmlFieldName, nextBodyHtml);
    }
  }, [
    derivedBodyHtmlPreview,
    setFormValue,
    shopifySetup.shopifyBodyHtmlFieldName,
    formValues,
  ]);

  useEffect(() => {
    if (!ebaySetup.ebayBodyHtmlFieldName) return;

    const nextBodyHtml = derivedBodyHtmlPreview;
    const currentBodyHtml = formValues[ebaySetup.ebayBodyHtmlFieldName] ?? '';

    if (currentBodyHtml !== nextBodyHtml) {
      setFormValue(ebaySetup.ebayBodyHtmlFieldName, nextBodyHtml);
    }
  }, [derivedBodyHtmlPreview, ebaySetup.ebayBodyHtmlFieldName, formValues, setFormValue]);

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
    shopifyImagePayloadFieldName,
    useCombinedImageAltEditor,
  };
}