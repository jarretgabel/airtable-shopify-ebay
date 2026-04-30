import { describe, expect, it, vi } from 'vitest';
import { buildAppFrameNavTabs } from '@/app/appShellNav';

describe('buildAppFrameNavTabs', () => {
  it('marks runtime-disabled tabs as unavailable before they are clicked', () => {
    const navigateToTab = vi.fn();
    const navigateToApprovalList = vi.fn();
    const navigateToUsersList = vi.fn();

    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'listings', 'jotform', 'ebay', 'approval', 'shopify', 'shopify-approval', 'market'],
      activeTab: 'dashboard',
      exportingPdf: false,
      approvalPending: 3,
      shopifyApprovalPending: 2,
      totalNewSubmissions: 5,
      disabledTabReasons: {
        jotform: 'Missing public runtime config: VITE_JOTFORM_FORM_ID.',
        ebay: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
        approval: 'Missing public runtime config: VITE_AIRTABLE_APPROVAL_TABLE_REF.',
        'shopify-approval': 'Missing public runtime config: VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF.',
        listings: 'Missing public runtime config: VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF.',
      },
      navigateToTab,
      navigateToApprovalList,
      navigateToUsersList,
    });

    expect(result.tabs.find((tab) => tab.key === 'jotform')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_JOTFORM_FORM_ID.',
    });
    expect(result.tabs.find((tab) => tab.key === 'listings')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF.',
    });
    expect(result.ebayNavTabs.find((tab) => tab.key === 'ebay')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
    });
    expect(result.ebayNavTabs.find((tab) => tab.key === 'approval')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_AIRTABLE_APPROVAL_TABLE_REF.',
    });
    expect(result.shopifyNavTabs.find((tab) => tab.key === 'shopify')).toMatchObject({
      disabled: false,
      disabledReason: undefined,
    });
  });
});