export function isShopifyTypeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'type' || normalized === 'shopify type';
}

export function isShopifyTypesFreeformField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === 'shopify types';
}

export function isShopifyTemplateVariantNameField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'shopify template variant name'
    || compact === 'shopifytemplatevariantname';
}

export function isShopifyOptionValuesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return /^shopify\s+(rest|graphql)?\s*option\s+\d+\s+value\s+\d+$/.test(normalized)
    || /^shopify_(rest|graphql)?_option_\d+_value_\d+$/.test(normalized)
    || /^shopify\s+option\s+values?(?:\s+\d+)?$/.test(normalized)
    || /^option\s+values?(?:\s+\d+)?$/.test(normalized)
    || normalized === 'shopify option values'
    || normalized === 'shopify_option_values'
    || compact === 'shopifyoptionvalues'
    || compact.startsWith('shopifyoptionvalues')
    || compact === 'optionvalues'
    || compact.startsWith('optionvalues');
}

export function isShopifyVariantOptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return /^shopify\s+(rest|graphql)?\s*variant\s+\d+\s+option\s+\d+$/.test(normalized)
    || /^shopify_(rest|graphql)?_variant_\d+_option_\d+$/.test(normalized)
    || /^variant\s+\d+\s+option\s+\d+$/.test(normalized)
    || /^variant\s+option(?:\s+\d+)?$/.test(normalized)
    || normalized === 'shopify variant option'
    || normalized === 'shopify_variant_option'
    || compact === 'shopifyvariantoption'
    || compact.startsWith('shopifyvariantoption')
    || compact === 'variantoption'
    || compact.startsWith('variantoption');
}

export function isShopifyVariantStatusField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'shopify variant status'
    || normalized === 'shopify variant status active'
    || normalized === 'shopify_variant_status'
    || normalized === 'shopify_variant_status_active'
    || compact === 'shopifyvariantstatus'
    || compact === 'shopifyvariantstatusactive';
}

export function isShopifyBodyDescriptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify body description'
    || normalized === 'shopify rest body description'
    || normalized === 'item description'
    || normalized === 'description'
    || normalized === 'shopify_body_description'
    || normalized === 'shopify_rest_body_description';
}

export function isShopifyKeyFeaturesField(fieldName: string): boolean {
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

export function isShopifyBodyHtmlPrimaryField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'shopify rest body html'
    || normalized === 'shopify body html'
    || normalized === 'shopify body (html)'
    || normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'shopify_rest_body_html'
    || compact === 'shopifybodyhtml';
}

export function isShopifyBodyHtmlTemplateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest body html template'
    || normalized === 'shopify body html template'
    || normalized === 'shopify_rest_body_html_template'
    || normalized === 'shopify_body_html_template';
}

export function isLegacyShopifySingleImageField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (/^shopify\s+rest\s+image(\s+\d+)?\s+(src|position|alt|alt\s+text)$/.test(normalized)) return true;
  if (/^shopify_rest_image(_\d+)?_(src|position|alt|alt_text)$/.test(normalized)) return true;
  if (normalized === 'image position' || normalized === 'image_position') return true;
  if (/^image\s+position\s+\d+$/.test(normalized)) return true;
  if (/^image_position_\d+$/.test(normalized)) return true;
  if (/^image\s+\d+\s+position$/.test(normalized)) return true;
  if (/^image_\d+_position$/.test(normalized)) return true;
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

export function isHiddenApprovalField(fieldName: string): boolean {
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

export function isShopifyVariantBooleanField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  const isVariantField = normalized.includes('variant') || compact.includes('variant');
  if (!isVariantField) return false;

  const isTaxableField = normalized.includes('taxable') || compact.includes('taxable');
  const isRequiresShippingField = normalized.includes('requires shipping') || normalized.includes('requires_shipping') || compact.includes('requiresshipping');

  return isTaxableField || isRequiresShippingField;
}