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
      listingsBadgeCount: 0,
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
    expect(result.intakeNavTabs.find((tab) => tab.key === 'jotform')).toMatchObject({
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
    expect(result.postPublishNavTabs).toEqual([]);
  });

  it('places the workflow guide in the utility navigation group', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'workflow-guide', 'workflow-guide-editor', 'market'],
      activeTab: 'workflow-guide',
      exportingPdf: false,
      workflowInventoryBadgeCount: 0,
      listingsBadgeCount: 0,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.tabs).toEqual([expect.objectContaining({ key: 'dashboard' })]);
    expect(result.utilityNavTabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'workflow-guide', label: 'User Guide', active: true }),
    ]));
    expect(result.tabs.find((tab) => tab.key === 'workflow-guide-editor')).toBeUndefined();
    expect(result.utilityNavTabs.find((tab) => tab.key === 'workflow-guide-editor')).toBeUndefined();
    expect(result.utilityNavTabs.find((tab) => tab.key === 'market')).toBeUndefined();
    expect(result.postPublishNavTabs).toEqual([]);
  });

  it('does not show a badge on the workflow hub tab', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'manual-intake', 'inventory', 'testing', 'photos'],
      activeTab: 'dashboard',
      exportingPdf: false,
      workflowInventoryBadgeCount: 7,
      listingsBadgeCount: 0,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.tabs.find((tab) => tab.key === 'inventory')).toMatchObject({ badgeCount: undefined, label: 'Workflow Hub' });
    expect(result.inventoryProcessingNavTabs.find((tab) => tab.key === 'testing')).toBeUndefined();
    expect(result.inventoryProcessingNavTabs.find((tab) => tab.key === 'photos')).toBeUndefined();
    expect(result.postPublishNavTabs).toEqual([]);
  });

  it('uses clearer operator labels for inventory processing navigation while hiding form-only tabs', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['manual-intake', 'inventory', 'testing-queue', 'photography-queue', 'testing', 'photos'],
      activeTab: 'inventory',
      exportingPdf: false,
      workflowInventoryBadgeCount: 0,
      listingsBadgeCount: 0,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.tabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'inventory', label: 'Workflow Hub', active: true }),
    ]));
    expect(result.inventoryProcessingNavTabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'testing-queue', label: 'Testing' }),
      expect.objectContaining({ key: 'photography-queue', label: 'Photography' }),
    ]));
    expect(result.inventoryProcessingNavTabs.find((tab) => tab.key === 'testing')).toBeUndefined();
    expect(result.inventoryProcessingNavTabs.find((tab) => tab.key === 'photos')).toBeUndefined();
    expect(result.intakeNavTabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'manual-intake', label: 'Manual Intake' }),
    ]));
    expect(result.postPublishNavTabs).toEqual([]);
  });

  it('preserves intake, processing, and commerce order from the canonical page sequence', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'manual-intake', 'create-intake-item', 'jotform', 'jotform-audit', 'parking-lot-1', 'trash-review', 'inventory', 'testing-queue', 'photography-queue', 'testing', 'photos', 'listings', 'post-publish', 'shopify', 'ebay'],
      activeTab: 'dashboard',
      exportingPdf: false,
      workflowInventoryBadgeCount: 0,
      listingsBadgeCount: 0,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.intakeNavTabs.map((tab) => tab.key)).toEqual(['manual-intake', 'jotform', 'parking-lot-1', 'trash-review']);
    expect(result.tabs.map((tab) => tab.key)).toEqual(['dashboard', 'inventory']);
    expect(result.tabs.find((tab) => tab.key === 'jotform-audit')).toBeUndefined();
    expect(result.intakeNavTabs.find((tab) => tab.key === 'create-intake-item')).toBeUndefined();
    expect(result.inventoryProcessingNavTabs.map((tab) => tab.key)).toEqual(['testing-queue', 'photography-queue']);
    expect(result.listingsNavTabs.map((tab) => tab.key)).toEqual(['listings', 'post-publish', 'shopify', 'ebay']);
    expect(result.postPublishNavTabs).toEqual([]);
  });

  it('shows listing-phase work volume on the listings tab badge', () => {
    const result = buildAppFrameNavTabs({
      visibleTabs: ['dashboard', 'inventory', 'listings', 'shopify', 'ebay'],
      activeTab: 'dashboard',
      exportingPdf: false,
      workflowInventoryBadgeCount: 2,
      listingsBadgeCount: 4,
      navigateToTab: vi.fn(),
      navigateToUsersList: vi.fn(),
    });

    expect(result.tabs.find((tab) => tab.key === 'inventory')).toMatchObject({ badgeCount: undefined, label: 'Workflow Hub' });
    expect(result.listingsNavTabs.find((tab) => tab.key === 'listings')).toMatchObject({ badgeCount: 4 });
    expect(result.listingsNavTabs.find((tab) => tab.key === 'shopify')).toMatchObject({ badgeCount: undefined });
    expect(result.postPublishNavTabs).toEqual([]);
  });
});