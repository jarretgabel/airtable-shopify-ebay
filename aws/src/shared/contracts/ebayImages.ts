export interface EbayHostedImageCache {
  url: string;
  sha256: string;
}

export function isEbayHostedImageCache(value: unknown): value is EbayHostedImageCache {
  if (!value || typeof value !== 'object') return false;
  if (!('sha256' in value) || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) return false;
  if (!('url' in value) || typeof value.url !== 'string') return false;
  try {
    const url = new URL(value.url);
    return url.protocol === 'https:' && url.hostname.toLowerCase().endsWith('.ebayimg.com');
  } catch {
    return false;
  }
}
