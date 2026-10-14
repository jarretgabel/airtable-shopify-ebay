import type { EbayHostedImageCache } from '@contracts/ebayImages';

export function mergeEbayImageCaches(
  rawMetadata: unknown,
  updates: ReadonlyMap<string, EbayHostedImageCache>,
): string {
  const entries: unknown = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
  if (!Array.isArray(entries)) {
    throw new Error('Cannot save eBay image reuse data: saved workflow image metadata is not an array.');
  }
  const matched = new Set<string>();
  const nextEntries = entries.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('url' in entry) || typeof entry.url !== 'string') return entry;
    const sourceUrl = entry.url.trim();
    const cache = updates.get(sourceUrl);
    if (!cache) return entry;
    matched.add(sourceUrl);
    return { ...entry, ebayHostedImageCache: cache };
  });
  if (matched.size !== updates.size) {
    throw new Error('Approved images changed while preparing eBay images. Reload and review the images before publishing.');
  }
  return JSON.stringify(nextEntries);
}
