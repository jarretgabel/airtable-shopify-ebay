import { describe, expect, it } from 'vitest';
import { getImageVariantUrl } from '@/services/imageVariantUrl';

describe('getImageVariantUrl', () => {
  it('requests a size only for hosted workflow images', () => {
    expect(getImageVariantUrl('/api/media/used-gear-workflow/r/testing/a.jpg', 400)).toBe('/api/media/used-gear-workflow/r/testing/a.jpg?w=400');
    expect(getImageVariantUrl('/api/media/used-gear-workflow/thumbnail?id=1', 400)).toBe('/api/media/used-gear-workflow/thumbnail?id=1');
  });
});
