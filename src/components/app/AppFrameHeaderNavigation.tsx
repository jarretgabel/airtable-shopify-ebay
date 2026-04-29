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
  ebayTabs: AppTab[];
  inventoryProcessingTabs: AppTab[];
  shopifyTabs: AppTab[];
  postEbayTabs: AppTab[];
  utilityTabs: AppTab[];
  openDropdown: OpenDropdown;
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void;
  onCloseDropdowns: () => void;
}

export function AppFrameHeaderNavigation({
  tabs,
  ebayTabs,
  inventoryProcessingTabs,
  shopifyTabs,
  postEbayTabs,
  utilityTabs,
  openDropdown,
  onToggleDropdown,
  onCloseDropdowns,
}: AppFrameHeaderNavigationProps): ReactNode {
  const hasActiveEbayTab = ebayTabs.some((tab) => tab.active);
  const hasActiveInventoryProcessingTab = inventoryProcessingTabs.some((tab) => tab.active);
  const hasActiveShopifyTab = shopifyTabs.some((tab) => tab.active);
  const hasActiveUtilityTab = utilityTabs.some((tab) => tab.active);
  const ebayBadgeTotal = ebayTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const inventoryProcessingBadgeTotal = inventoryProcessingTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const shopifyBadgeTotal = shopifyTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const utilityBadgeTotal = utilityTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);

  return (
    <nav className="mx-auto w-[min(1200px,96vw)]" aria-label="Main navigation">
      <div className="relative flex flex-wrap items-end gap-1">
        <div className="flex min-w-0 flex-1 items-end gap-1">
          {tabs.map((tab) => <TabButton key={tab.key} tab={tab} />)}

          {ebayTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveEbayTab}
                expanded={openDropdown === 'ebay'}
                label="eBay"
                menuId="ebay-menu"
                badgeCount={ebayBadgeTotal > 0 ? ebayBadgeTotal : undefined}
                onClick={() => onToggleDropdown('ebay')}
                onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'ebay', onToggleDropdown, onCloseDropdowns)}
              />
              {openDropdown === 'ebay' && (
                <div
                  id="ebay-menu"
                  role="menu"
                  aria-label="eBay tabs"
                  className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
                >
                  <DropdownTabList tabs={ebayTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} autoFocusFirst />
                </div>
              )}
            </div>
          )}

          {shopifyTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveShopifyTab}
                expanded={openDropdown === 'shopify'}
                label="Shopify"
                menuId="shopify-menu"
                badgeCount={shopifyBadgeTotal > 0 ? shopifyBadgeTotal : undefined}
                onClick={() => onToggleDropdown('shopify')}
                onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'shopify', onToggleDropdown, onCloseDropdowns)}
              />
              {openDropdown === 'shopify' && (
                <div
                  id="shopify-menu"
                  role="menu"
                  aria-label="Shopify tabs"
                  className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
                >
                  <DropdownTabList tabs={shopifyTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} autoFocusFirst />
                </div>
              )}
            </div>
          )}

          {inventoryProcessingTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveInventoryProcessingTab}
                expanded={openDropdown === 'inventory-processing'}
                label="Inventory"
                menuId="inventory-processing-menu"
                badgeCount={inventoryProcessingBadgeTotal > 0 ? inventoryProcessingBadgeTotal : undefined}
                onClick={() => onToggleDropdown('inventory-processing')}
                onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'inventory-processing', onToggleDropdown, onCloseDropdowns)}
              />
              {openDropdown === 'inventory-processing' && (
                <div
                  id="inventory-processing-menu"
                  role="menu"
                  aria-label="Inventory tabs"
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