import type { ReactNode } from 'react';
import type { AppTab, OpenDropdown } from '@/components/app/appFrameTypes';
import {
  DropdownTabList,
  DropdownTrigger,
  TabButton,
  handleDropdownTriggerKeyDown,
} from '@/components/app/AppFrameHeaderShared';

interface TabSection {
  title: string;
  tabs: AppTab[];
}

const INTAKE_SECTION_KEYS = {
  forms: ['manual-intake', 'jotform'] as const,
  parkingLots: ['parking-lot-1', 'parking-lot-2'] as const,
  trash: ['trash-review'] as const,
};

const INVENTORY_PROCESSING_SECTION_KEYS = {
  hub: ['inventory'] as const,
  reviewQueues: ['testing-queue', 'photography-queue'] as const,
  forms: ['testing', 'photos'] as const,
};

const SELLING_SECTION_KEYS = {
  review: ['listings'] as const,
  followThrough: ['post-publish'] as const,
  channels: ['shopify', 'ebay'] as const,
};

interface AppFrameHeaderNavigationProps {
  tabs: AppTab[];
  intakeTabs: AppTab[];
  listingsTabs: AppTab[];
  postPublishTabs: AppTab[];
  inventoryProcessingTabs: AppTab[];
  postEbayTabs: AppTab[];
  utilityTabs: AppTab[];
  exportDisabled: boolean;
  onExportCurrentPage: () => void;
  onExportAllPages: () => void;
  openDropdown: OpenDropdown;
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void;
  onCloseDropdowns: () => void;
}

export function AppFrameHeaderNavigation({
  tabs,
  intakeTabs,
  listingsTabs,
  postPublishTabs,
  inventoryProcessingTabs,
  postEbayTabs,
  utilityTabs,
  exportDisabled,
  onExportCurrentPage,
  onExportAllPages,
  openDropdown,
  onToggleDropdown,
  onCloseDropdowns,
}: AppFrameHeaderNavigationProps): ReactNode {
  const hasActiveIntakeTab = intakeTabs.some((tab) => tab.active);
  const hasActiveListingsTab = listingsTabs.some((tab) => tab.active);
  const hasActiveInventoryProcessingTab = inventoryProcessingTabs.some((tab) => tab.active);
  const hasActiveUtilityTab = utilityTabs.some((tab) => tab.active);
  const hasUtilityActions = true;
  const intakeBadgeTotal = intakeTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const listingsBadgeTotal = listingsTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const inventoryProcessingBadgeTotal = inventoryProcessingTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const utilityBadgeTotal = utilityTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const intakeTabLookup = new Map(intakeTabs.map((tab) => [tab.key, tab]));
  const intakeSections: TabSection[] = [
    {
      title: 'Intake Forms',
      tabs: INTAKE_SECTION_KEYS.forms
        .map((key) => intakeTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
    {
      title: 'Parking Lots',
      tabs: INTAKE_SECTION_KEYS.parkingLots
        .map((key) => intakeTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
    {
      title: 'Trash',
      tabs: INTAKE_SECTION_KEYS.trash
        .map((key) => intakeTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
  ].filter((section) => section.tabs.length > 0);
  const inventoryProcessingTabLookup = new Map(inventoryProcessingTabs.map((tab) => [tab.key, tab]));
  const inventoryProcessingSections: TabSection[] = [
    {
      title: 'Hub',
      tabs: INVENTORY_PROCESSING_SECTION_KEYS.hub
        .map((key) => inventoryProcessingTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
    {
      title: 'Review Queues',
      tabs: INVENTORY_PROCESSING_SECTION_KEYS.reviewQueues
        .map((key) => inventoryProcessingTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
    {
      title: 'Forms',
      tabs: INVENTORY_PROCESSING_SECTION_KEYS.forms
        .map((key) => inventoryProcessingTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
  ].filter((section) => section.tabs.length > 0);
  const sellingTabLookup = new Map(listingsTabs.map((tab) => [tab.key, tab]));
  const sellingSections: TabSection[] = [
    {
      title: 'Review',
      tabs: SELLING_SECTION_KEYS.review
        .map((key) => sellingTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
    {
      title: 'Follow-Through',
      tabs: SELLING_SECTION_KEYS.followThrough
        .map((key) => sellingTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
    {
      title: 'Channels',
      tabs: SELLING_SECTION_KEYS.channels
        .map((key) => sellingTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
  ].filter((section) => section.tabs.length > 0);

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
                  <div className="space-y-1">
                    {intakeSections.map((section, index) => {
                      const hasEnabledTab = section.tabs.some((tab) => !tab.disabled);
                      const shouldAutoFocus = index === intakeSections.findIndex((candidate) => candidate.tabs.some((tab) => !tab.disabled));

                      return (
                        <div key={section.title} className="rounded-lg border border-white/5 bg-white/[0.03] px-1.5 py-1.5">
                          <p className="px-2 pb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{section.title}</p>
                          <DropdownTabList
                            tabs={section.tabs}
                            onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }}
                            autoFocusFirst={shouldAutoFocus && hasEnabledTab}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {inventoryProcessingTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveInventoryProcessingTab}
                expanded={openDropdown === 'inventory-processing'}
                label="Processing"
                menuId="inventory-processing-menu"
                badgeCount={inventoryProcessingBadgeTotal > 0 ? inventoryProcessingBadgeTotal : undefined}
                onClick={() => onToggleDropdown('inventory-processing')}
                onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'inventory-processing', onToggleDropdown, onCloseDropdowns)}
              />
              {openDropdown === 'inventory-processing' && (
                <div
                  id="inventory-processing-menu"
                  role="menu"
                  aria-label="Inventory processing tabs"
                  className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[320px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
                >
                  <div className="space-y-1">
                    {inventoryProcessingSections.map((section, index) => {
                      const hasEnabledTab = section.tabs.some((tab) => !tab.disabled);
                      const shouldAutoFocus = index === inventoryProcessingSections.findIndex((candidate) => candidate.tabs.some((tab) => !tab.disabled));

                      return (
                        <div key={section.title} className="rounded-lg border border-white/5 bg-white/[0.03] px-1.5 py-1.5">
                          <p className="px-2 pb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{section.title}</p>
                          <DropdownTabList
                            tabs={section.tabs}
                            onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }}
                            autoFocusFirst={shouldAutoFocus && hasEnabledTab}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {listingsTabs.length > 0 && (
            <div className="relative flex-shrink-0" data-export-ignore="true">
              <DropdownTrigger
                active={hasActiveListingsTab}
                expanded={openDropdown === 'listings'}
                label="Selling"
                menuId="listings-menu"
                badgeCount={listingsBadgeTotal > 0 ? listingsBadgeTotal : undefined}
                onClick={() => onToggleDropdown('listings')}
                onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'listings', onToggleDropdown, onCloseDropdowns)}
              />
              {openDropdown === 'listings' && (
                <div
                  id="listings-menu"
                  role="menu"
                  aria-label="Selling tabs"
                  className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] min-w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
                >
                  <div className="space-y-1">
                    {sellingSections.map((section, index) => {
                      const hasEnabledTab = section.tabs.some((tab) => !tab.disabled);
                      const shouldAutoFocus = index === sellingSections.findIndex((candidate) => candidate.tabs.some((tab) => !tab.disabled));

                      return (
                        <div key={section.title} className="rounded-lg border border-white/5 bg-white/[0.03] px-1.5 py-1.5">
                          <p className="px-2 pb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{section.title}</p>
                          <DropdownTabList
                            tabs={section.tabs}
                            onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }}
                            autoFocusFirst={shouldAutoFocus && hasEnabledTab}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {postPublishTabs.map((tab) => <TabButton key={tab.key} tab={tab} />)}

          {postEbayTabs.map((tab) => <TabButton key={tab.key} tab={tab} />)}
        </div>

        {(utilityTabs.length > 0 || hasUtilityActions) && (
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
                {utilityTabs.length > 0 ? <DropdownTabList tabs={utilityTabs} onSelect={(tab) => { onCloseDropdowns(); tab.onClick(); }} autoFocusFirst /> : null}
                <div className={`${utilityTabs.length > 0 ? 'mt-1.5 border-t border-white/8 pt-1.5' : ''}`.trim()}>
                  <p className="px-3 pb-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Export</p>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={exportDisabled}
                    onClick={() => {
                      onCloseDropdowns();
                      onExportCurrentPage();
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Download Current Page PDF
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={exportDisabled}
                    onClick={() => {
                      onCloseDropdowns();
                      onExportAllPages();
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Download Full PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}