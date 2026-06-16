import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppFrameHeaderNavigation } from '@/components/app/AppFrameHeaderNavigation';
import type { AppTab } from '@/components/app/appFrameTypes';

function createTab(key: AppTab['key'], label: string): AppTab {
  return {
    key,
    label,
    active: false,
    onClick: vi.fn(),
  };
}

describe('AppFrameHeaderNavigation', () => {
  it('renders separated intake sections for forms, parking lot, and trash', () => {
    render(
      <AppFrameHeaderNavigation
        tabs={[createTab('dashboard', 'Dashboard')]}
        intakeTabs={[
          createTab('manual-intake', 'Manual Intake'),
          createTab('create-intake-item', 'Create Intake Item'),
          createTab('jotform', 'JotForm'),
          createTab('jotform-audit', 'JotForm Audit'),
          createTab('parking-lot', 'Parking Lot'),
          createTab('trash-review', 'Trash Review'),
        ]}
        listingsTabs={[]}
        postPublishTabs={[]}
        inventoryProcessingTabs={[]}
        postEbayTabs={[]}
        utilityTabs={[]}
        exportDisabled={false}
        onExportCurrentPage={vi.fn()}
        onExportAllPages={vi.fn()}
        openDropdown="intake"
        onToggleDropdown={vi.fn()}
        onCloseDropdowns={vi.fn()}
      />,
    );

    expect(screen.queryByText('Intake Forms')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Parking Lot' })).toBeInTheDocument();
    expect(screen.queryByText('Trash')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Manual Intake' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Create Intake Item' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')[0]).toHaveTextContent('Create Intake Item');
    expect(screen.getByRole('menuitem', { name: 'JotForm' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'JotForm Audit' })).toBeInTheDocument();
    expect(screen.getAllByText('Parking Lot')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: 'Trash Review' })).toBeInTheDocument();
  });

  it('opens the intake dropdown from the trigger when closed', () => {
    const onToggleDropdown = vi.fn();

    render(
      <AppFrameHeaderNavigation
        tabs={[createTab('dashboard', 'Dashboard')]}
        intakeTabs={[createTab('manual-intake', 'Manual Intake')]}
        listingsTabs={[]}
        postPublishTabs={[]}
        inventoryProcessingTabs={[]}
        postEbayTabs={[]}
        utilityTabs={[]}
        exportDisabled={false}
        onExportCurrentPage={vi.fn()}
        onExportAllPages={vi.fn()}
        openDropdown={null}
        onToggleDropdown={onToggleDropdown}
        onCloseDropdowns={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Intake/ }));

    expect(onToggleDropdown).toHaveBeenCalledWith('intake');
  });

  it('renders the selling dropdown label for listings-phase tabs', () => {
    render(
      <AppFrameHeaderNavigation
        tabs={[createTab('dashboard', 'Dashboard')]}
        intakeTabs={[]}
        listingsTabs={[
          createTab('listings', 'Listings'),
          createTab('post-publish', 'Post-Publish'),
          createTab('archive', 'Completed Shipments'),
          createTab('shopify', 'Shopify'),
        ]}
        postPublishTabs={[]}
        inventoryProcessingTabs={[]}
        postEbayTabs={[]}
        utilityTabs={[]}
        exportDisabled={false}
        onExportCurrentPage={vi.fn()}
        onExportAllPages={vi.fn()}
        openDropdown="listings"
        onToggleDropdown={vi.fn()}
        onCloseDropdowns={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Selling/ })).toBeInTheDocument();
    expect(screen.queryByText('Review')).not.toBeInTheDocument();
    expect(screen.queryByText('Lifecycle')).not.toBeInTheDocument();
    expect(screen.queryByText('Channels')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Listings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Post-Publish' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Completed Shipments' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Shopify' })).toBeInTheDocument();
  });

  it('does not show an aggregate red badge on the Selling dropdown trigger', () => {
    render(
      <AppFrameHeaderNavigation
        tabs={[createTab('dashboard', 'Dashboard')]}
        intakeTabs={[]}
        listingsTabs={[
          { ...createTab('listings', 'Listings'), badgeCount: 4 },
          createTab('post-publish', 'Post-Publish'),
          createTab('archive', 'Completed Shipments'),
          createTab('shopify', 'Shopify'),
        ]}
        postPublishTabs={[]}
        inventoryProcessingTabs={[]}
        postEbayTabs={[]}
        utilityTabs={[]}
        exportDisabled={false}
        onExportCurrentPage={vi.fn()}
        onExportAllPages={vi.fn()}
        openDropdown={null}
        onToggleDropdown={vi.fn()}
        onCloseDropdowns={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^Selling/ })).toHaveTextContent('Selling');
    expect(screen.getByRole('button', { name: /^Selling/ })).not.toHaveTextContent('4');
  });

  it('renders a compact navigation menu with grouped sections when mobile nav is open', () => {
    render(
      <AppFrameHeaderNavigation
        tabs={[{ ...createTab('dashboard', 'Dashboard'), active: true }, createTab('inventory', 'Workflow Hub')]}
        intakeTabs={[createTab('manual-intake', 'Manual Intake')]}
        listingsTabs={[createTab('listings', 'Listings')]}
        postPublishTabs={[createTab('post-publish', 'Post-Publish')]}
        inventoryProcessingTabs={[createTab('testing-queue', 'Testing Queue')]}
        postEbayTabs={[]}
        utilityTabs={[createTab('settings', 'Settings')]}
        exportDisabled={false}
        onExportCurrentPage={vi.fn()}
        onExportAllPages={vi.fn()}
        openDropdown="mobile-nav"
        onToggleDropdown={vi.fn()}
        onCloseDropdowns={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();

    const mobileMenu = screen.getByRole('menu', { name: 'Mobile navigation menu' });
    const mobileMenuQueries = within(mobileMenu);

    expect(mobileMenuQueries.getByText('Main')).toBeInTheDocument();
    expect(mobileMenuQueries.getByText('Processing')).toBeInTheDocument();
    expect(mobileMenuQueries.getByText('Export')).toBeInTheDocument();
    expect(mobileMenuQueries.getByRole('menuitem', { name: 'Dashboard' })).toBeInTheDocument();
    expect(mobileMenuQueries.getByRole('menuitem', { name: 'Manual Intake' })).toBeInTheDocument();
    expect(mobileMenuQueries.getByRole('menuitem', { name: 'Listings' })).toBeInTheDocument();
    expect(mobileMenuQueries.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
  });
});