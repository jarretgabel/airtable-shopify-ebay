import { fireEvent, render, screen } from '@testing-library/react';
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
  it('renders separated intake sections for forms, parking lots, and trash', () => {
    render(
      <AppFrameHeaderNavigation
        tabs={[createTab('dashboard', 'Dashboard')]}
        intakeTabs={[
          createTab('manual-intake', 'Manual Intake'),
          createTab('jotform', 'JotForm'),
          createTab('parking-lot-1', 'Parking Lot 1'),
          createTab('parking-lot-2', 'Parking Lot 2'),
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

    expect(screen.getByText('Intake Forms')).toBeInTheDocument();
    expect(screen.getByText('Parking Lots')).toBeInTheDocument();
    expect(screen.getByText('Trash')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Manual Intake' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'JotForm' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Parking Lot 1' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Parking Lot 2' })).toBeInTheDocument();
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
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Follow-Through')).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Listings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Post-Publish' })).toBeInTheDocument();
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
});