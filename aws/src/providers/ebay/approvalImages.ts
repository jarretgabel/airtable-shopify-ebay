import { normalizeKey, type ApprovalFieldMap } from './approvalShared.js';

export function parseImageUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const imageLike = item as Record<string, unknown>;
        const src = imageLike.src;
        if (typeof src === 'string' && src.trim()) return src.trim();
        const directUrl = imageLike.url;
        if (typeof directUrl === 'string' && directUrl.trim()) return directUrl.trim();
        const thumbnails = imageLike.thumbnails;
        if (thumbnails && typeof thumbnails === 'object') {
          const thumbnailsObj = thumbnails as Record<string, unknown>;
          const largeThumb = thumbnailsObj.large;
          if (largeThumb && typeof largeThumb === 'object') {
            const largeUrl = (largeThumb as Record<string, unknown>).url;
            if (typeof largeUrl === 'string' && largeUrl.trim()) return largeUrl.trim();
          }
          const fullThumb = thumbnailsObj.full;
          if (fullThumb && typeof fullThumb === 'object') {
            const fullUrl = (fullThumb as Record<string, unknown>).url;
            if (typeof fullUrl === 'string' && fullUrl.trim()) return fullUrl.trim();
          }
        }
      }
      return '';
    }).filter(Boolean);
  }

  if (raw && typeof raw === 'object') {
    const rawObject = raw as Record<string, unknown>;
    const nestedImages = rawObject.attachments ?? rawObject.images ?? rawObject.items ?? rawObject.data;
    if (Array.isArray(nestedImages)) {
      const parsedNested = parseImageUrls(nestedImages);
      if (parsedNested.length > 0) return parsedNested;
    }
    const parsedObject = parseImageUrls([raw]);
    if (parsedObject.length > 0) return parsedObject;
  }

  const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parseImageUrls(parsed);
    if (parsed && typeof parsed === 'object') return parseImageUrls([parsed]);
  } catch {
    // Fall through.
  }

  return text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collectImageUrlsFromFields(fields: ApprovalFieldMap): string[] {
  const collected: string[] = [];
  Object.entries(fields).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    const looksLikeExplicitImageList = normalized.includes('ebayinventoryproductimageurls')
      || normalized.includes('photourls')
      || normalized.includes('imageurls')
      || normalized === 'images'
      || normalized === 'image'
      || normalized === 'imagescommaseparated';
    const looksLikeIndexedImageUrl = (normalized.includes('ebayinventoryproductimageurl') || normalized.includes('imageurl') || normalized.includes('photourl')) && /\d+$/.test(normalized);
    if (!looksLikeExplicitImageList && !looksLikeIndexedImageUrl) return;
    collected.push(...parseImageUrls(value));
  });
  return dedupeCaseInsensitive(collected);
}