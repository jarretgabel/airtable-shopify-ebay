import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckOptionalEnv } = vi.hoisted(() => ({
  mockCheckOptionalEnv: vi.fn<(name: string) => string>(() => ''),
}));

vi.mock('@/config/runtimeEnv', () => ({
  checkOptionalEnv: mockCheckOptionalEnv,
}));

import { getRuntimeFeatureCapabilities } from '@/config/runtimeCapabilities';

describe('getRuntimeFeatureCapabilities', () => {
  beforeEach(() => {
    mockCheckOptionalEnv.mockReset();
    mockCheckOptionalEnv.mockImplementation(() => '');
  });

  it('marks optional features unavailable when config is missing', () => {
    const capabilities = getRuntimeFeatureCapabilities();

    expect(capabilities.jotform.available).toBe(false);
    expect(capabilities.jotform.message).toContain('VITE_JOTFORM_FORM_ID');
    expect(capabilities.ebay.available).toBe(false);
    expect(capabilities.ebay.message).toContain('VITE_EBAY_AUTH_HOST');
    expect(capabilities.approvalCombined.available).toBe(false);
  });

  it('accepts approval sources when either a reference or table name is configured and requires the full eBay bundle', () => {
    mockCheckOptionalEnv.mockImplementation((name: string) => {
      const values: Record<string, string> = {
        VITE_AIRTABLE_APPROVAL_TABLE_NAME: 'Approval Queue',
        VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF: 'appBase/shopifyApproval',
        VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME: 'Combined Listings',
        VITE_EBAY_AUTH_HOST: 'api.example.test',
        VITE_EBAY_OAUTH_SCOPES: 'scope-a scope-b',
      };

      return values[name] ?? '';
    });

    const capabilities = getRuntimeFeatureCapabilities();

    expect(capabilities.approvalEbay.available).toBe(true);
    expect(capabilities.approvalShopify.available).toBe(true);
    expect(capabilities.approvalCombined.available).toBe(true);
    expect(capabilities.ebay.available).toBe(false);
    expect(capabilities.ebay.message).toContain('VITE_EBAY_APP_SCOPE');
  });
});