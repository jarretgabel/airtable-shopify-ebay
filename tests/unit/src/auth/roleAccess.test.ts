import { describe, expect, it } from 'vitest';
import { getRoleDefaultPages, normalizeRolePages } from '@/auth/roleAccess';

describe('roleAccess', () => {
  it('includes jotform-audit in the default bundles for admin, owner, processor, and developer', () => {
    expect(getRoleDefaultPages('admin')).toContain('jotform-audit');
    expect(getRoleDefaultPages('owner')).toContain('jotform-audit');
    expect(getRoleDefaultPages('processor')).toContain('jotform-audit');
    expect(getRoleDefaultPages('developer')).toContain('jotform-audit');
  });

  it('includes commerce and account pages in the processor default page bundle', () => {
    expect(getRoleDefaultPages('processor')).toEqual(expect.arrayContaining([
      'create-intake-item',
      'jotform',
      'jotform-audit',
      'listings',
      'shopify',
      'ebay',
      'settings',
      'notifications',
    ]));
  });

  it('restores commerce and account pages for processor users normalized from legacy inventory access', () => {
    expect(normalizeRolePages(['dashboard', 'inventory'], 'processor')).toEqual(expect.arrayContaining([
      'create-intake-item',
      'jotform',
      'jotform-audit',
      'listings',
      'shopify',
      'ebay',
      'settings',
      'notifications',
    ]));
  });

  it('adds create-intake-item and jotform-audit when legacy users only have the parent intake pages', () => {
    expect(normalizeRolePages(['dashboard', 'manual-intake', 'jotform'], 'processor')).toEqual(expect.arrayContaining([
      'manual-intake',
      'create-intake-item',
      'jotform',
      'jotform-audit',
    ]));
  });
});