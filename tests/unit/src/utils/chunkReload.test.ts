import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '../../../../src/utils/chunkReload';

describe('isChunkLoadError', () => {
  it('detects stale chunk errors', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true);
    expect(isChunkLoadError('Importing a module script failed.')).toBe(true);
  });
  it('ignores other errors', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
