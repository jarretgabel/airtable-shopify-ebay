import { describe, expect, it } from 'vitest';
import { mergeEbayImageCaches } from '@/services/ebayImageCache';
import { parseWorkflowImageMetadata, serializeWorkflowImageMetadata, updateWorkflowImageAltText } from '@/services/workflowImageMetadata';

const cache = { url: 'https://i.ebayimg.com/image.jpg', sha256: 'a'.repeat(64) };
const sourceUrl = 'https://drive.google.com/uc?id=photo-1';

describe('eBay image reuse metadata', () => {
  it('merges cache data without changing order, inclusion, roles or unknown annotations', () => {
    const entries = [
      { url: sourceUrl, sortOrder: 2, includedInListing: false, imageRole: 'rear', annotation: 'keep me' },
      { url: 'https://drive.google.com/uc?id=photo-2', sortOrder: 1, includedInListing: true },
    ];
    const result = mergeEbayImageCaches(JSON.stringify(entries), new Map([[sourceUrl, cache]]));
    expect(JSON.parse(result)).toEqual([{ ...entries[0], ebayHostedImageCache: cache }, entries[1]]);
    expect(mergeEbayImageCaches(result, new Map([[sourceUrl, cache]]))).toBe(result);
  });

  it('preserves cache data through hydration, editing alt text and serialization', () => {
    const raw = JSON.stringify([{ url: sourceUrl, filename: 'bel-canto-pre1-preamplifier-front.jpg', sortOrder: 1, sourceStage: 'photos', ebayHostedImageCache: cache }]);
    const records = parseWorkflowImageMetadata(raw);
    const edited = updateWorkflowImageAltText(records, sourceUrl, 'Bel Canto Pre1 preamplifier front', '2026-10-13T23:00:00.000Z');
    expect(JSON.parse(serializeWorkflowImageMetadata(edited))[0].ebayHostedImageCache).toEqual(cache);
  });

  it('blocks publishing when an uploaded image was removed from the saved record', () => {
    expect(() => mergeEbayImageCaches('[]', new Map([[sourceUrl, cache]]))).toThrow('Approved images changed');
  });

  it('reports invalid saved metadata instead of replacing it with an empty list', () => {
    expect(() => mergeEbayImageCaches('{}', new Map([[sourceUrl, cache]]))).toThrow('not an array');
    expect(() => mergeEbayImageCaches('invalid JSON', new Map([[sourceUrl, cache]]))).toThrow();
  });
});
