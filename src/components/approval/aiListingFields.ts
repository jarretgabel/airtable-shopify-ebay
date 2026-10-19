import { SHOPIFY_SEO_DESCRIPTION_FIELD_NAME, SHOPIFY_SEO_TITLE_FIELD_NAME } from '@/components/approval/ShopifySeoFieldsEditor';

// The listing facts sent to the AI: short, text-only values, without machine fields or the SEO fields themselves.
export function collectAiListingFields(
  formValues: Record<string, string>,
  excludedFieldNames: string[] = [],
): Record<string, string> {
  const excluded = new Set([...excludedFieldNames, SHOPIFY_SEO_TITLE_FIELD_NAME, SHOPIFY_SEO_DESCRIPTION_FIELD_NAME]);
  return Object.fromEntries(
    Object.entries(formValues).filter(([name, value]) => (
      !excluded.has(name)
      && typeof value === 'string'
      && value.trim().length > 0
      && value.length <= 1500
      && !/json|html|image|photo|url|^id$|record|categor|^(shopify |product )?type$/i.test(name)
    )),
  );
}
