import { describe, expect, it } from 'vitest';
import { displayReadableValue, extractReadableValue } from '@/utils/valueDisplay';

describe('valueDisplay', () => {
  it('unwraps preferred object keys into readable text', () => {
    expect(extractReadableValue({ id: 'sel-1', name: 'Stereo Receiver' })).toBe('Stereo Receiver');
    expect(extractReadableValue({ text: 'SKU-100' })).toBe('SKU-100');
  });

  it('formats arrays of wrapped values as plain text', () => {
    expect(displayReadableValue([
      { id: 'sku-1', value: 'SKU-100' },
      { id: 'type-1', label: 'Integrated Amplifier' },
    ], 'N/A')).toBe('SKU-100, Integrated Amplifier');
  });

  it('falls back when no readable value can be extracted', () => {
    expect(displayReadableValue({ id: 'rec123', url: 'https://example.com' }, 'N/A')).toBe('N/A');
  });
});