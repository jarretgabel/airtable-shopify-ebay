import { describe, expect, it, vi } from 'vitest';
import { buildAppFrameNavTabs } from '@/app/appShellNav';

describe('buildAppFrameNavTabs', () => {
  it('marks runtime-disabled tabs as unavailable before they are clicked', () => {
    const navigateToTab = vi.fn();
    const navigateToUsersList = vi.fn();

    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'listings', 'parking-lot-1', 'jotform', 'ebay', 'shopify', 'market'],
      activeTab: 'dashboard',
      exportingPdf: false,
      workflowInventoryBadgeCount: 0,
      disabledTabReasons: {
        jotform: 'Missing public runtime config: VITE_JOTFORM_FORM_ID.',
        listings: 'Missing public runtime config: VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF.',
      },
      navigateToTab,
      navigateToUsersList,
    });

    expect(result.intakeNavTabs.find((tab) => tab.key === 'parking-lot-1')).toMatchObject({
      disabled: false,
      disabledReason: undefined,
    });
    expect(result.utilityNavTabs.find((tab) => tab.key === 'jotform')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_JOTFORM_FORM_ID.',
    });
    expect(result.listingsNavTabs.find((tab) => tab.key === 'listings')).toMatchObject({
      disabled: true,
      disabledReason: 'Missing public runtime config: VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF.',
    });
    expect(result.listingsNavTabs.find((tab) => tab.key === 'ebay')).toMatchObject({
      disabled: false,
      disabledReason: undefined,
    });
    expect(result.listingsNavTabs.find((tab) => tab.key === 'shopify')).toMatchObject({
      disabled: false,
      disabledReason: undefined,
    });
  });

  it('places the workflow guide in the utility navigation group', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'workflow-guide', 'market'],
      activeTab: 'workflow-guide',
      exportingPdf: false,
      workflowInventoryBadgeCount: 0,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.tabs).toEqual([expect.objectContaining({ key: 'dashboard' })]);
    expect(result.utilityNavTabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'workflow-guide', label: 'Workflow Guide', active: true }),
      expect.objectContaining({ key: 'market', label: 'HiFi Shark' }),
    ]));
  });

  it('shows workflow queue volume on the inventory tab badge', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'inventory', 'incoming-gear', 'testing', 'photos'],
      activeTab: 'dashboard',
      exportingPdf: false,
      workflowInventoryBadgeCount: 7,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.inventoryProcessingNavTabs.find((tab) => tab.key === 'inventory')).toMatchObject({ badgeCount: 7 });
    expect(result.inventoryProcessingNavTabs.find((tab) => tab.key === 'testing')).toMatchObject({ badgeCount: undefined });
  });

  it('uses clearer operator labels for inventory processing navigation', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['inventory', 'testing-queue', 'photography-queue', 'pre-listing-queue', 'incoming-gear', 'testing', 'photos'],
      activeTab: 'inventory',
      exportingPdf: false,
      workflowInventoryBadgeCount: 0,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.inventoryProcessingNavTabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'inventory', label: 'Workflow Hub' }),
      expect.objectContaining({ key: 'testing-queue', label: 'Testing Review' }),
      expect.objectContaining({ key: 'photography-queue', label: 'Photography Review' }),
      expect.objectContaining({ key: 'pre-listing-queue', label: 'Pre-Listing Review' }),
      expect.objectContaining({ key: 'incoming-gear', label: 'Incoming Gear Form' }),
      expect.objectContaining({ key: 'testing', label: 'Testing Form' }),
      expect.objectContaining({ key: 'photos', label: 'Photo Form' }),
    ]));
  });
});