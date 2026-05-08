import type { ReactNode } from 'react';
import type { AppTab, OpenDropdown } from '@/components/app/appFrameTypes';
import {
  DropdownTabList,
  DropdownTrigger,
  TabButton,
  handleDropdownTriggerKeyDown,
} from '@/components/app/AppFrameHeaderShared';

interface AppFrameHeaderNavigationProps {
  tabs: AppTab[];
  intakeTabs: AppTab[];
  listingsTabs: AppTab[];
  inventoryProcessingTabs: AppTab[];
  postEbayTabs: AppTab[];
  utilityTabs: AppTab[];
  openDropdown: OpenDropdown;
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void;
  onCloseDropdowns: () => void;
}

export function AppFrameHeaderNavigation({
  tabs,
  intakeTabs,
  listingsTabs,
  inventoryProcessingTabs,
  postEbayTabs,
  utilityTabs,
  openDropdown,
  onToggleDropdown,
  onCloseDropdowns,
}: AppFrameHeaderNavigationProps): ReactNode {
  const hasActiveIntakeTab = intakeTabs.some((tab) => tab.active);
  const hasActiveListingsTab = listingsTabs.some((tab) => tab.active);
  const hasActiveInventoryProcessingTab = inventoryProcessingTabs.some((tab) => tab.active);
  const hasActiveUtilityTab = utilityTabs.some((tab) => tab.active);
  const intakeBadgeTotal = intakeTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const listingsBadgeTotal = listingsTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const inventoryProcessingBadgeTotal = inventoryProcessingTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const utilityBadgeTotal = utilityTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);

  return (
    <nav className="mx-auto w-[min(1200px,96vw)]" aria-label="Main navigation">
      <div className="relative flex flex-wrap items-end gap-1">
        <div className="flex min-w-0 flex-1 items-end gap-1">
          {tabs.map((tab) => <TabButton key={tab.key} tab={tab} />)}

          {intakeTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveIntakeTab}
                expanded={openDropdown === 'intake'}
                label="Intake"
                menuId="intake-menu"
                badgeCount={intakeBadgeTotal > 0 ? intakeBadgeTotal : undefined}
                onClick={() => onToggleDropdown('intake')}
                onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'intake', onToggleDropdown, onCloseDropdowns)}
              />
              {openDropdown === 'intake' && (
                <div
                  id="intake-menu"
                  role="menu"
                  aria-label="Intake tabs"
                  className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
                >
                  <DropdownTabList tabs={intakeTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} autoFocusFirst />
                </div>
              )}
            </div>
          )}

          {listingsTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveListingsTab}
                expanded={openDropdown === 'listings'}
                label="Listings"
                menuId="listings-menu"
                badgeCount={listingsBadgeTotal > 0 ? listingsBadgeTotal : undefined}
                onClick={() => onToggleDropdown('listings')}
                onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'listings', onToggleDropdown, onCloseDropdowns)}
              />
              {openDropdown === 'listings' && (
                <div
                  id="listings-menu"
                  role="menu"
                  aria-label="Listings tabs"
                  className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
                >
                  <DropdownTabList tabs={listingsTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} autoFocusFirst />
                </div>
              )}
            </div>
          )}

          {inventoryProcessingTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveInventoryProcessingTab}
                expanded={openDropdown === 'inventory-processing'}
                label="Workflow"
                menuId="inventory-processing-menu"
                badgeCount={inventoryProcessingBadgeTotal > 0 ? inventoryProcessingBadgeTotal : undefined}
                onClick={() => onToggleDropdown('inventory-processing')}
                onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'inventory-processing', onToggleDropdown, onCloseDropdowns)}
              />
              {openDropdown === 'inventory-processing' && (
                <div
                  id="inventory-processing-menu"
                  role="menu"
                  aria-label="Workflow tabs"
                  className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
                >
                  <DropdownTabList tabs={inventoryProcessingTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} autoFocusFirst />
                </div>
              )}
            </div>
          )}

          {postEbayTabs.map((tab) => <TabButton key={tab.key} tab={tab} />)}
        </div>

        {utilityTabs.length > 0 && (
          <div className="relative flex-shrink-0" data-export-ignore="true">
            <DropdownTrigger
              active={hasActiveUtilityTab}
              expanded={openDropdown === 'utilities'}
              label="Utilities"
              menuId="utilities-menu"
              badgeCount={utilityBadgeTotal > 0 ? utilityBadgeTotal : undefined}
              onClick={() => onToggleDropdown('utilities')}
              onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'utilities', onToggleDropdown, onCloseDropdowns)}
            />
            {openDropdown === 'utilities' && (
              <div
                id="utilities-menu"
                role="menu"
                aria-label="Utility tabs"
                className="absolute right-0 top-[calc(100%+0.45rem)] z-[70] min-w-[240px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
              >
                <DropdownTabList tabs={utilityTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} autoFocusFirst />
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}