import { describe, expect, it } from 'vitest';
import {
  fromFormValueForField,
  inferFieldKindForField,
  toFormValueForField,
} from '@/stores/approval/approvalStoreFieldUtils';

describe('approvalStoreFieldUtils single-value selection fields', () => {
  it('hydrates component type arrays as plain text', () => {
    expect(toFormValueForField('Component Type', ['Receiver'])).toBe('Receiver');
    expect(inferFieldKindForField('Component Type', ['Receiver'])).toBe('text');
  });

  it('wraps component type back into a single-item array on save', () => {
    expect(fromFormValueForField('Component Type', 'Receiver', 'text')).toEqual(['Receiver']);
    expect(fromFormValueForField('Component Type', '', 'text')).toEqual([]);
  });

  it('hydrates eBay category arrays as plain text values', () => {
    expect(toFormValueForField('Categories', ['14990'])).toBe('14990');
    expect(inferFieldKindForField('Categories', ['14990'])).toBe('text');
  });

  it('joins multi-value eBay category arrays into comma-delimited text', () => {
    expect(toFormValueForField('Categories', ['14990', '15032'])).toBe('14990, 15032');
    expect(inferFieldKindForField('Categories', ['14990', '15032'])).toBe('text');
  });

  it('leaves unrelated json fields unchanged', () => {
    expect(toFormValueForField('Custom JSON', ['Audio', 'Vintage'])).toBe('[\n  "Audio",\n  "Vintage"\n]');
    expect(inferFieldKindForField('Custom JSON', ['Audio', 'Vintage'])).toBe('json');
  });

  it('hydrates readable wrapped objects as plain text instead of json', () => {
    expect(toFormValueForField('SKU', { text: 'SAMPLE-WORKFLOW-QUEUE-12' })).toBe('SAMPLE-WORKFLOW-QUEUE-12');
    expect(inferFieldKindForField('SKU', { text: 'SAMPLE-WORKFLOW-QUEUE-12' })).toBe('text');
  });

  it('keeps multi-property objects as json when they are not simple wrappers', () => {
    expect(toFormValueForField('Custom JSON', { text: 'SKU-100', locale: 'en-US' })).toBe('{\n  "text": "SKU-100",\n  "locale": "en-US"\n}');
    expect(inferFieldKindForField('Custom JSON', { text: 'SKU-100', locale: 'en-US' })).toBe('json');
  });
});