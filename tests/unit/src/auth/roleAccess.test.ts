import { describe, expect, it } from 'vitest';
import { getRoleDefaultPages, normalizeRolePages } from '@/auth/roleAccess';

describe('roleAccess', () => {
  it('includes commerce and account pages in the processor default page bundle', () => {
    expect(getRoleDefaultPages('processor')).toEqual(expect.arrayContaining([
      'jotform',
      'listings',
      'shopify',
      'ebay',
      'settings',
      'notifications',
    ]));
  });

  it('restores commerce and account pages for processor users normalized from legacy inventory access', () => {
    expect(normalizeRolePages(['dashboard', 'inventory'], 'processor')).toEqual(expect.arrayContaining([
      'jotform',
      'listings',
      'shopify',
      'ebay',
      'settings',
      'notifications',
    ]));
  });
});