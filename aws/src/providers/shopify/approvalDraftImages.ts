import type { ApprovalFieldMap, ShopifyProduct } from './approvalDraftTypes.js';
import { getField, getRawField, parseInteger, parseJsonArray } from './approvalDraftFieldUtils.js';

function parseImageAltTextList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const value = (item as Record<string, unknown>).alt;
        return typeof value === 'string' ? value.trim() : '';
      }
      return '';
    }).filter((value) => value.length > 0);
  }

  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = parseJsonArray<unknown>(trimmed);
  if (parsed) return parseImageAltTextList(parsed);
  return trimmed.split(/[\n,]/).map((value) => value.trim()).filter((value) => value.length > 0);
}

function getStructuredImageSource(image: Record<string, unknown>): string {
  const directSource = typeof image.src === 'string' ? image.src.trim() : '';
  if (directSource) return directSource;
  const directUrl = typeof image.url === 'string' ? image.url.trim() : '';
  if (directUrl) return directUrl;
  const originalSource = typeof image.originalSource === 'string'
    ? image.originalSource.trim()
    : typeof image.original_source === 'string'
      ? image.original_source.trim()
      : '';
  if (originalSource) return originalSource;
  const thumbnails = image.thumbnails;
  if (thumbnails && typeof thumbnails === 'object') {
    const large = (thumbnails as Record<string, unknown>).large;
    if (large && typeof large === 'object') {
      const url = (large as Record<string, unknown>).url;
      if (typeof url === 'string') return url.trim();
    }
  }
  return '';
}

export function buildImages(fields: ApprovalFieldMap): ShopifyProduct['images'] | undefined {
  const imageAltTexts = parseImageAltTextList(getRawField(fields, ['Images Alt Text', 'Images Alt Text (comma separated)', 'Images Alt Text (comma-separated)', 'Image Alt Text', 'images_alt_text', 'image_alt_text']));
  const rawImages = getRawField(fields, ['Shopify REST Images JSON', 'Shopify Images JSON', 'shopify_rest_images_json', 'shopify_images_json', 'Shopify REST Images', 'Shopify Images', 'shopify_rest_images', 'shopify_images', 'Images', 'Images (comma separated)', 'Images (comma-separated)', 'images', 'Image URL', 'Image URLs', 'Image-URL', 'Image-URLs', 'image_url', 'image_urls']);
  const imagesJson = parseJsonArray<unknown>(rawImages);
  if (imagesJson && imagesJson.length > 0) {
    const normalizedImages = imagesJson.map((item, index) => {
      if (typeof item === 'string') {
        const src = item.trim();
        if (!src) return null;
        return { src, alt: imageAltTexts[index] ?? '', position: index + 1 };
      }
      if (!item || typeof item !== 'object') return null;
      const image = item as Record<string, unknown>;
      const src = getStructuredImageSource(image);
      if (!src) return null;
      const rawAlt = image.alt;
      const altFromImage = typeof rawAlt === 'string' ? rawAlt : typeof image.altText === 'string' ? image.altText : typeof image.alt_text === 'string' ? image.alt_text : '';
      const rawPosition = image.position;
      const position = typeof rawPosition === 'number' && Number.isFinite(rawPosition) ? rawPosition : index + 1;
      return { src, alt: imageAltTexts[index] ?? altFromImage, position };
    }).filter((image): image is { src: string; alt: string; position: number } => image !== null);
    if (normalizedImages.length > 0) return normalizedImages;
  }

  if (typeof rawImages === 'string' && rawImages.trim()) {
    const parts = rawImages.trim().split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
    if (parts.length > 0) return parts.map((url, index) => ({ src: url, alt: imageAltTexts[index] ?? '', position: index + 1 }));
  }

  const images: NonNullable<ShopifyProduct['images']> = [];
  for (let i = 1; i <= 10; i += 1) {
    const src = getField(fields, [`Shopify REST Image ${i} Src`, `Shopify Image ${i} Src`, `Shopify GraphQL Media ${i} Original Source`, `Shopify Extra Media ${i} Original Source`, `shopify_rest_image_${i}_src`]);
    if (!src) continue;
    images.push({
      src,
      alt: getField(fields, [`Shopify REST Image ${i} Alt`, `Shopify Image ${i} Alt`, `Shopify GraphQL Media ${i} Alt`, `Shopify Extra Media ${i} Alt`, `shopify_rest_image_${i}_alt`]) || imageAltTexts[i - 1] || undefined,
      position: parseInteger(getField(fields, [`Shopify REST Image ${i} Position`, `shopify_rest_image_${i}_position`])),
    });
  }
  return images.length > 0 ? images : undefined;
}