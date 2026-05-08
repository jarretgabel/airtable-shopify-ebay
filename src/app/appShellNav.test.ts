import { describe, expect, it, vi } from 'vitest';
import { buildAppFrameNavTabs } from '@/app/appShellNav';

describe('buildAppFrameNavTabs', () => {
  it('marks runtime-disabled tabs as unavailable before they are clicked', () => {
    const navigateToTab = vi.fn();
    const navigateToUsersList = vi.fn();

    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'listings', 'jotform', 'ebay', 'shopify', 'market'],
      activeTab: 'dashboard',
      exportingPdf: false,
      workflowInventoryBadgeCount: 0,
      totalNewSubmissions: 5,
      disabledTabReasons: {
        jotform: 'Missing public runtime config: VITE_JOTFORM_FORM_ID.',
        ebay: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
        listings: 'Missing public runtime config: VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF.',
      },
      navigateToTab,
      navigateToUsersList,
    });

    expect(result.intakeNavTabs.find((tab) => tab.key === 'jotform')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_JOTFORM_FORM_ID.',
    });
    expect(result.listingsNavTabs.find((tab) => tab.key === 'listings')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF.',
    });
    expect(result.listingsNavTabs.find((tab) => tab.key === 'ebay')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
    });
    expect(result.listingsNavTabs.find((tab) => tab.key === 'shopify')).toMatchObject({
      disabled: false,
      disabledReason: undefined,
    });
  });

  it('shows workflow queue volume on the inventory tab badge', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'inventory', 'incoming-gear', 'testing', 'photos'],
      activeTab: 'dashboard',
      exportingPdf: false,
      workflowInventoryBadgeCount: 7,
      totalNewSubmissions: 0,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.inventoryProcessingNavTabs.find((tab) => tab.key === 'inventory')).toMatchObject({ badgeCount: 7 });
    expect(result.inventoryProcessingNavTabs.find((tab) => tab.key === 'testing')).toMatchObject({ badgeCount: undefined });
  });
});