export interface ImageEditorRow {
  src: string;
  alt: string;
}

function normalizeImageFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/g, '').trim();
}

export function isGenericImageUrlField(fieldName: string): boolean {
  const normalized = normalizeImageFieldName(fieldName);
  return normalized === 'images'
    || normalized === 'image url'
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

export function isGenericImagePositionField(fieldName: string): boolean {
  const normalized = normalizeImageFieldName(fieldName);
  return normalized === 'image position'
    || normalized === 'image_position'
    || /^image\s+position\s+\d+$/.test(normalized)
    || /^image_position_\d+$/.test(normalized)
    || /^image\s+\d+\s+position$/.test(normalized)
    || /^image_\d+_position$/.test(normalized);
}

export function isGenericImageAltField(fieldName: string): boolean {
  const normalized = normalizeImageFieldName(fieldName);
  return normalized === 'image alt'
    || normalized === 'images alt'
    || normalized === 'image_alt'
    || normalized === 'images_alt'
    || normalized === 'image alt text'
    || normalized === 'images alt text'
    || normalized === 'image_alt_text'
    || normalized === 'images_alt_text'
    || /^image\s+alt\s+\d+$/.test(normalized)
    || /^image_alt_\d+$/.test(normalized)
    || /^image\s+alt\s+text\s+\d+$/.test(normalized)
    || /^image_alt_text_\d+$/.test(normalized)
    || /^image\s+\d+\s+alt$/.test(normalized)
    || /^image_\d+_alt$/.test(normalized)
    || /^image\s+\d+\s+alt\s+text$/.test(normalized)
    || /^image_\d+_alt_text$/.test(normalized);
}

export function isGenericImageScalarField(fieldName: string): boolean {
  return isGenericImageUrlField(fieldName)
    || isGenericImagePositionField(fieldName)
    || isGenericImageAltField(fieldName);
}

export function isHiddenCombinedFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'images (comma separated) 2'
    || compact === 'imagescommaseparated2'
    || normalized === 'shopify approved'
    || normalized === 'ebay approved'
    || compact === 'shopifyapproved'
    || compact === 'ebayapproved';
}

export function isShopifyImagePayloadField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest images json'
    || normalized === 'shopify images json'
    || normalized === 'shopify_rest_images_json'
    || normalized === 'shopify_images_json'
    || normalized === 'shopify rest images'
    || normalized === 'shopify images'
    || normalized === 'shopify_rest_images'
    || normalized === 'shopify_images';
}

export function isEbayInventoryImageUrlsField(fieldName: string): boolean {
  const normalized = normalizeImageFieldName(fieldName);
  return normalized === 'ebay inventory product image urls json'
    || normalized === 'ebay inventory product imageurls json'
    || normalized === 'ebay_inventory_product_imageurls_json';
}

export function isEbayPhotoCountMaxField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/g, '').trim();
  return normalized === 'photo count max'
    || normalized === 'photo_count_max'
    || normalized === 'ebay photo count max'
    || normalized === 'ebay_photo_count_max';
}

export function parseImageEditorRows(raw: string): ImageEditorRow[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
      const values = Array.isArray(parsed) ? parsed : [parsed];
      return values
        .map((item) => {
          if (typeof item === 'string') return { src: item.trim(), alt: '' };
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            const directUrl = typeof record.url === 'string' ? record.url.trim() : '';
            const thumbnailLarge =
              record.thumbnails
              && typeof record.thumbnails === 'object'
              && (record.thumbnails as Record<string, unknown>).large
              && typeof (record.thumbnails as Record<string, unknown>).large === 'object'
                ? ((record.thumbnails as Record<string, unknown>).large as Record<string, unknown>).url
                : '';
            return {
              src: (typeof record.src === 'string' ? record.src.trim() : '') || directUrl || (typeof thumbnailLarge === 'string' ? thumbnailLarge.trim() : ''),
              alt: typeof record.alt === 'string' ? record.alt.trim() : '',
            };
          }
          return { src: '', alt: '' };
        })
        .filter((row) => row.src.length > 0 || row.alt.length > 0);
    }
  } catch {
    // fall back to plain-text parsing
  }

  return trimmed
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((src) => ({ src, alt: '' }));
}

export function toCommaSeparatedImageValues(values: string[]): string {
  return values.map((value) => value.trim()).join(', ');
}

export function pickPreferredField(
  candidates: string[],
  preferredNames: string[],
  values: Record<string, string>,
): string | undefined {
  if (candidates.length === 0) return undefined;

  const preferredLookup = preferredNames.map((name) => name.toLowerCase());
  const hasValue = (fieldName: string) => (values[fieldName] ?? '').trim().length > 0;

  for (const preferredName of preferredLookup) {
    const match = candidates.find((fieldName) => fieldName.toLowerCase() === preferredName && hasValue(fieldName));
    if (match) return match;
  }

  const firstWithValue = candidates.find((fieldName) => hasValue(fieldName));
  if (firstWithValue) return firstWithValue;

  for (const preferredName of preferredLookup) {
    const match = candidates.find((fieldName) => fieldName.toLowerCase() === preferredName);
    if (match) return match;
  }

  return candidates[0];
}

export function isImageUrlListField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (/shopify\s*(rest|graphql)?\s*images?\s*json/.test(normalized)) return true;
  if (normalized === 'shopify_rest_images_json' || normalized === 'shopify_images_json') return true;
  if (normalized === 'shopify rest images' || normalized === 'shopify images') return true;
  if (normalized === 'shopify_rest_images' || normalized === 'shopify_images') return true;
  if (isGenericImageUrlField(fieldName)) return true;
  if (/ebay\s*inventory\s*product\s*image\s*url/.test(normalized)) return true;
  if (normalized === 'ebay_inventory_product_imageurls_json') return true;
  return false;
}