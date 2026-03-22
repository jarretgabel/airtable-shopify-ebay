import { useEffect, useMemo } from 'react';

import {
  CONDITION_FIELD,
  getDropdownOptions,
  isAllowOffersField,
  isShippingServiceField,
  SHIPPING_SERVICE_FIELD,
  SHIPPING_SERVICE_OPTIONS,
} from '@/stores/approvalStore';
import { buildShopifyBodyHtml } from '@/services/shopifyBodyHtml';
import { ImageUrlListEditor } from './ImageUrlListEditor';
import { ShopifyBodyHtmlPreview } from './ShopifyBodyHtmlPreview';
import { ShopifyKeyFeaturesEditor } from './ShopifyKeyFeaturesEditor';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';

function toHumanReadableLabel(fieldName: string): string {
  if (fieldName === CONDITION_FIELD) return 'Condition';

  const withSpaces = fieldName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withSpaces) return fieldName;

  return withSpaces
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z0-9]+$/.test(word)) return word;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function isReadOnlyApprovalField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest product id' || normalized === 'shopify product id';
}

function isShopifyBodyHtmlField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html'
    || normalized === 'shopify body html'
    || normalized === 'shopify graphql description html'
    || normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'shopify_rest_body_html'
    || normalized === 'shopify rest body html template'
    || normalized === 'shopify body html template'
    || normalized === 'shopify_rest_body_html_template'
    || normalized === 'shopify_body_html_template';
}

function isShopifyBodyDescriptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify body description'
    || normalized === 'shopify rest body description'
    || normalized === 'item description'
    || normalized === 'description'
    || normalized === 'shopify_body_description'
    || normalized === 'shopify_rest_body_description';
}

function isShopifyKeyFeaturesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'shopify body key features'
    || normalized === 'shopify rest body key features'
    || normalized === 'shopify body key features json'
    || normalized === 'shopify rest body key features json'
    || normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json'
    || normalized === 'shopify_body_key_features'
    || normalized === 'shopify_rest_body_key_features'
    || normalized === 'shopify_body_key_features_json'
    || normalized === 'shopify_rest_body_key_features_json') {
    return true;
  }

  const squashed = normalized.replace(/[^a-z0-9]/g, '');
  return squashed.includes('keyfeature')
    || squashed.includes('keyvaluepair')
    || squashed.includes('featurevaluepair')
    || squashed.includes('featurepairs')
    || squashed.includes('keypairs');
}

function isShopifyBodyHtmlPrimaryField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html'
    || normalized === 'shopify body html'
    || normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'shopify_rest_body_html';
}

function isShopifyBodyHtmlTemplateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html template'
    || normalized === 'shopify body html template'
    || normalized === 'shopify_rest_body_html_template'
    || normalized === 'shopify_body_html_template';
}

function isLegacyShopifySingleImageField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();

  // Human-readable naming variants from Airtable templates.
  if (/^shopify\s+rest\s+image(\s+\d+)?\s+(src|position|alt|alt\s+text)$/.test(normalized)) return true;

  // API-style snake_case naming variants.
  if (/^shopify_rest_image(_\d+)?_(src|position|alt|alt_text)$/.test(normalized)) return true;

  // Generic legacy image position fields that should not be edited directly.
  if (normalized === 'image position' || normalized === 'image_position') return true;
  if (/^image\s+position\s+\d+$/.test(normalized)) return true;
  if (/^image_position_\d+$/.test(normalized)) return true;
  if (/^image\s+\d+\s+position$/.test(normalized)) return true;
  if (/^image_\d+_position$/.test(normalized)) return true;

  // Generic legacy image alt fields that should not be edited directly.
  if (normalized === 'image alt' || normalized === 'image_alt') return true;
  if (normalized === 'image alt text' || normalized === 'image_alt_text') return true;
  if (/^image\s+alt\s+\d+$/.test(normalized)) return true;
  if (/^image_alt_\d+$/.test(normalized)) return true;
  if (/^image\s+alt\s+text\s+\d+$/.test(normalized)) return true;
  if (/^image_alt_text_\d+$/.test(normalized)) return true;
  if (/^image\s+\d+\s+alt$/.test(normalized)) return true;
  if (/^image_\d+_alt$/.test(normalized)) return true;
  if (/^image\s+\d+\s+alt\s+text$/.test(normalized)) return true;
  if (/^image_\d+_alt_text$/.test(normalized)) return true;

  return false;
}

function isHiddenApprovalField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest product id'
    || normalized === 'shopify product id'
    || normalized === 'shopify rest vendor'
    || normalized === 'shopify vendor'
    || normalized === 'vendor'
    || normalized === 'published'
    || normalized === 'shopify published'
    || normalized === 'shopify rest published at'
    || normalized === 'shopify published at'
    || normalized === 'shopify rest published scope'
    || normalized === 'shopify published scope'
    || isLegacyShopifySingleImageField(fieldName);
}

function isBooleanLikeValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'false';
}

function isGenericImageUrlField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'image url'
    || normalized === 'image urls'
    || normalized === 'image-url'
    || normalized === 'image-urls'
    || normalized === 'image_url'
    || normalized === 'image_urls'
    || /^image\s+url\s+\d+$/.test(normalized)
    || /^image\s+urls\s+\d+$/.test(normalized)
    || /^image-url-\d+$/.test(normalized)
    || /^image-urls-\d+$/.test(normalized)
    || /^image_url_\d+$/.test(normalized)
    || /^image_urls_\d+$/.test(normalized)
    || /^image\s+\d+\s+url$/.test(normalized)
    || /^image\s+\d+\s+urls$/.test(normalized)
    || /^image-\d+-url$/.test(normalized)
    || /^image-\d+-urls$/.test(normalized)
    || /^image_\d+_url$/.test(normalized)
    || /^image_\d+_urls$/.test(normalized);
}

function isGenericImagePositionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'image position'
    || normalized === 'image_position'
    || /^image\s+position\s+\d+$/.test(normalized)
    || /^image_position_\d+$/.test(normalized)
    || /^image\s+\d+\s+position$/.test(normalized)
    || /^image_\d+_position$/.test(normalized);
}

function isGenericImageAltField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'image alt'
    || normalized === 'image_alt'
    || normalized === 'image alt text'
    || normalized === 'image_alt_text'
    || /^image\s+alt\s+\d+$/.test(normalized)
    || /^image_alt_\d+$/.test(normalized)
    || /^image\s+alt\s+text\s+\d+$/.test(normalized)
    || /^image_alt_text_\d+$/.test(normalized)
    || /^image\s+\d+\s+alt$/.test(normalized)
    || /^image_\d+_alt$/.test(normalized)
    || /^image\s+\d+\s+alt\s+text$/.test(normalized)
    || /^image_\d+_alt_text$/.test(normalized);
}

function isGenericImageScalarField(fieldName: string): boolean {
  return isGenericImageUrlField(fieldName)
    || isGenericImagePositionField(fieldName)
    || isGenericImageAltField(fieldName);
}

/**
 * Returns true for fields that store a list of image URLs — either as a
 * JSON array of strings or as a JSON array of Shopify image objects { src, alt, position }.
 * These fields get the drag-and-droppable ImageUrlListEditor instead of a textarea.
 */
function isImageUrlListField(fieldName: string): boolean {
  const n = fieldName.trim().toLowerCase();
  // Shopify REST/GraphQL images JSON  (e.g. "Shopify REST Images JSON", "shopify_rest_images_json")
  if (/shopify\s*(rest|graphql)?\s*images?\s*json/.test(n)) return true;
  if (n === 'shopify_rest_images_json' || n === 'shopify_images_json') return true;

  // Shopify list-style images fields without explicit "JSON" suffix.
  if (n === 'shopify rest images' || n === 'shopify images') return true;
  if (n === 'shopify_rest_images' || n === 'shopify_images') return true;

  // Generic Airtable field used by the Shopify listing detail page.
  // Value is commonly a comma-separated list that ImageUrlListEditor can parse.
  if (isGenericImageUrlField(fieldName)) return true;

  // eBay inventory product image URLs JSON
  if (/ebay\s*inventory\s*product\s*image\s*url/.test(n)) return true;
  if (n === 'ebay_inventory_product_imageurls_json') return true;
  return false;
}

interface ApprovalFormFieldsProps {
  allFieldNames: string[];
  approvedFieldName: string;
  formValues: Record<string, string>;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  listingFormatOptions: string[];
  saving: boolean;
  setFormValue: (fieldName: string, value: string) => void;
  suppressImageScalarFields?: boolean;
  originalFieldValues?: Record<string, string>;
}

function isScalarImageField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (!normalized.includes('image')) return false;
  if (isImageUrlListField(fieldName)) return false;
  return /(url|src|position|alt|alt\s+text|alt_text)/.test(normalized);
}

function isConditionMirrorSourceField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'item condition'
    || normalized === 'condition'
    || normalized === 'shopify condition'
    || normalized === 'shopify rest condition'
    || normalized === 'ebay inventory condition';
}

export function ApprovalFormFields({
  allFieldNames,
  approvedFieldName,
  formValues,
  fieldKinds,
  listingFormatOptions,
  saving,
  setFormValue,
  suppressImageScalarFields = false,
  originalFieldValues = {},
}: ApprovalFormFieldsProps) {
  const imageUrlSourceField = allFieldNames.find((fieldName) => isGenericImageUrlField(fieldName));
  const hasCanonicalConditionField = allFieldNames.some((fieldName) => fieldName.trim().toLowerCase() === CONDITION_FIELD.toLowerCase());
  const shopifyBodyDescriptionFieldName = allFieldNames.find((fieldName) => isShopifyBodyDescriptionField(fieldName));
  const shopifyKeyFeaturesFieldName = allFieldNames.find((fieldName) => isShopifyKeyFeaturesField(fieldName));
  const shopifyBodyHtmlFieldName = allFieldNames.find((fieldName) => isShopifyBodyHtmlPrimaryField(fieldName));
  const shopifyBodyHtmlTemplateFieldName = allFieldNames.find((fieldName) => isShopifyBodyHtmlTemplateField(fieldName));
  const derivedShopifyBodyHtml = useMemo(() => {
    if (!shopifyBodyDescriptionFieldName && !shopifyKeyFeaturesFieldName) return '';

    const descriptionValue = shopifyBodyDescriptionFieldName ? (formValues[shopifyBodyDescriptionFieldName] ?? '') : '';
    const keyFeaturesValue = shopifyKeyFeaturesFieldName ? (formValues[shopifyKeyFeaturesFieldName] ?? '') : '';
    const templateValue = shopifyBodyHtmlTemplateFieldName
      ? (originalFieldValues[shopifyBodyHtmlTemplateFieldName] ?? '')
      : shopifyBodyHtmlFieldName
        ? (originalFieldValues[shopifyBodyHtmlFieldName] ?? '')
        : '';

    return buildShopifyBodyHtml(descriptionValue, keyFeaturesValue, templateValue);
  }, [formValues, originalFieldValues, shopifyBodyDescriptionFieldName, shopifyBodyHtmlTemplateFieldName, shopifyKeyFeaturesFieldName]);

  useEffect(() => {
    if (!shopifyBodyHtmlFieldName) return;

    const nextBodyHtml = derivedShopifyBodyHtml;
    const currentBodyHtml = formValues[shopifyBodyHtmlFieldName] ?? '';

    if (currentBodyHtml !== nextBodyHtml) {
      setFormValue(shopifyBodyHtmlFieldName, nextBodyHtml);
    }
  }, [
    derivedShopifyBodyHtml,
    setFormValue,
    shopifyBodyHtmlFieldName,
    formValues,
  ]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {allFieldNames.map((fieldName) => {
        if (isShippingServiceField(fieldName)) return null;
        if (fieldName === approvedFieldName) return null;
        if (isHiddenApprovalField(fieldName)) return null;
        if (isShopifyBodyDescriptionField(fieldName)) return null;
        if (isShopifyBodyHtmlField(fieldName)) return null;
        if (isShopifyKeyFeaturesField(fieldName)) return null;
        if (isGenericImageScalarField(fieldName)) return null;
        if (suppressImageScalarFields && isScalarImageField(fieldName)) return null;
        if (hasCanonicalConditionField && fieldName !== CONDITION_FIELD && isConditionMirrorSourceField(fieldName)) return null;

        const value = formValues[fieldName] ?? '';
        const kind = fieldKinds[fieldName] ?? 'text';
        const readOnlyField = isReadOnlyApprovalField(fieldName) || isShopifyBodyHtmlField(fieldName);
        const inputDisabled = saving || readOnlyField;
        const isLongText = kind === 'json' || value.length > 120;
        const booleanLike = isBooleanLikeValue(value);
        const dropdownOptions =
          fieldName.trim().toLowerCase() === 'listing format' ? listingFormatOptions : getDropdownOptions(fieldName);

        if (isAllowOffersField(fieldName) || kind === 'boolean' || booleanLike) {
          const normalizedBooleanValue = value.trim().toLowerCase() === 'true' ? 'true' : 'false';
          return (
            <label key={fieldName} className="flex flex-col gap-1.5">
              <span className={labelClass}>{toHumanReadableLabel(fieldName)}</span>
              <select
                className={inputBaseClass}
                value={normalizedBooleanValue}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={inputDisabled}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </label>
          );
        }

        if (dropdownOptions) {
          const optionSet = new Set(dropdownOptions);
          const options = value && !optionSet.has(value) ? [value, ...dropdownOptions] : dropdownOptions;

          return (
            <label key={fieldName} className="flex flex-col gap-1.5">
              <span className={labelClass}>{toHumanReadableLabel(fieldName)}</span>
              <select
                className={inputBaseClass}
                value={value}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={inputDisabled}
              >
                <option value="">Select an option</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        // Image URL list fields — must come before isLongText since kind === 'json' for these fields.
        if (isImageUrlListField(fieldName)) {
          return (
            <ImageUrlListEditor
              key={fieldName}
              fieldLabel={toHumanReadableLabel(fieldName)}
              value={value}
              onChange={(newValue) => setFormValue(fieldName, newValue)}
              disabled={inputDisabled}
            />
          );
        }

        if (isLongText) {
          return (
            <label key={fieldName} className="col-span-1 flex flex-col gap-1.5 md:col-span-2">
              <span className={labelClass}>{toHumanReadableLabel(fieldName)}</span>
              <textarea
                className={`${inputBaseClass} min-h-[110px] resize-y font-mono leading-[1.4]`}
                value={value}
                onChange={(event) => setFormValue(fieldName, event.target.value)}
                disabled={inputDisabled}
              />
            </label>
          );
        }

        return (
          <label key={fieldName} className="flex flex-col gap-1.5">
            <span className={labelClass}>{toHumanReadableLabel(fieldName)}</span>
            <input
              className={inputBaseClass}
              type={kind === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(event) => setFormValue(fieldName, event.target.value)}
              disabled={inputDisabled}
            />
          </label>
        );
      })}

      {shopifyBodyDescriptionFieldName && (
        <label className="col-span-1 flex flex-col gap-1.5 md:col-span-2">
          <span className={labelClass}>Description</span>
          <textarea
            className={`${inputBaseClass} min-h-[110px] resize-y leading-[1.4]`}
            value={formValues[shopifyBodyDescriptionFieldName] ?? ''}
            onChange={(event) => setFormValue(shopifyBodyDescriptionFieldName, event.target.value)}
            placeholder="Short product description used in listing body HTML"
            disabled={saving}
          />
        </label>
      )}

      {shopifyKeyFeaturesFieldName && (
        <ShopifyKeyFeaturesEditor
          keyFeaturesFieldName={shopifyKeyFeaturesFieldName}
          keyFeaturesValue={formValues[shopifyKeyFeaturesFieldName] ?? ''}
          setFormValue={setFormValue}
          disabled={saving}
        />
      )}

      {(shopifyBodyDescriptionFieldName || shopifyKeyFeaturesFieldName || shopifyBodyHtmlFieldName) && (
        <ShopifyBodyHtmlPreview value={derivedShopifyBodyHtml} />
      )}

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Shipping Services</span>
        <select
          className={inputBaseClass}
          value={formValues[SHIPPING_SERVICE_FIELD] ?? ''}
          onChange={(event) => setFormValue(SHIPPING_SERVICE_FIELD, event.target.value)}
          disabled={saving}
        >
          <option value="">Select an option</option>
          {SHIPPING_SERVICE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {imageUrlSourceField && (
        <ImageUrlListEditor
          key={imageUrlSourceField}
          fieldLabel="Images"
          value={formValues[imageUrlSourceField] ?? ''}
          onChange={(newValue) => setFormValue(imageUrlSourceField, newValue)}
          disabled={saving || isReadOnlyApprovalField(imageUrlSourceField)}
        />
      )}
    </div>
  );
}
