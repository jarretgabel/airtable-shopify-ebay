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

interface MobileNavSection {
  title: string;
  tabs: AppTab[];
}

const INTAKE_SECTION_KEYS = {
  forms: ['manual-intake', 'create-intake-item', 'jotform', 'jotform-audit'] as const,
  parkingLots: ['parking-lot'] as const,
  trash: ['trash-review'] as const,
};

const INVENTORY_PROCESSING_SECTION_KEYS = {
  reviewQueues: ['testing-queue', 'photography-queue'] as const,
  forms: ['testing', 'photos'] as const,
};

const SELLING_SECTION_KEYS = {
  review: ['listings'] as const,
  lifecycle: ['post-publish', 'archive'] as const,
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
  const inventoryProcessingBadgeTotal = inventoryProcessingTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const utilityBadgeTotal = utilityTabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
  const sellingMobileTabs = [...listingsTabs, ...postPublishTabs, ...postEbayTabs];
  const activeMobileTab = [...tabs, ...intakeTabs, ...inventoryProcessingTabs, ...sellingMobileTabs, ...utilityTabs].find((tab) => tab.active) ?? null;
  const intakeTabLookup = new Map(intakeTabs.map((tab) => [tab.key, tab]));
  const intakeSections: TabSection[] = [
    {
      title: 'Intake Forms',
      tabs: INTAKE_SECTION_KEYS.forms
        .map((key) => intakeTabLookup.get(key))
        .filter((tab): tab is AppTab => Boolean(tab)),
    },
    {
      title: 'Parking Lot',
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
      title: 'Lifecycle',
      tabs: SELLING_SECTION_KEYS.lifecycle
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
  const mobileSections: MobileNavSection[] = [
    { title: 'Main', tabs },
    { title: 'Intake', tabs: intakeTabs },
    { title: 'Processing', tabs: inventoryProcessingTabs },
    { title: 'Selling', tabs: sellingMobileTabs },
    { title: 'Utilities', tabs: utilityTabs },
  ].filter((section) => section.tabs.length > 0);

  function handleSelectTab(tab: AppTab) {
    onCloseDropdowns();
    tab.onClick();
  }

  return (
    <nav className="w-full" aria-label="Main navigation">
      <div className="md:hidden" data-export-ignore="true">
        <div className="border-t border-[var(--line)]/80 px-4 pt-2 sm:px-5">
          <button
            type="button"
            aria-haspopup="menu"
            aria-controls="mobile-navigation-menu"
            aria-expanded={openDropdown === 'mobile-nav'}
            aria-label="Open navigation menu"
            onClick={() => onToggleDropdown('mobile-nav')}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[rgba(9,16,26,0.72)] px-3 py-3 text-left shadow-[0_10px_24px_rgba(2,6,23,0.18)] transition hover:border-sky-400/35 hover:bg-[rgba(9,16,26,0.88)]"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Navigation</span>
              <span className="truncate text-sm font-semibold text-[var(--ink)]">{activeMobileTab?.label ?? 'Browse pages'}</span>
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] bg-[rgba(17,30,47,0.72)] text-[var(--ink)]">
              <svg viewBox="0 0 24 24" className={`h-4.5 w-4.5 transition-transform ${openDropdown === 'mobile-nav' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </span>
          </button>

          {openDropdown === 'mobile-nav' && (
            <div
              id="mobile-navigation-menu"
              role="menu"
              aria-label="Mobile navigation menu"
              className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-[0_18px_40px_rgba(2,6,23,0.28)]"
            >
              <div className="space-y-3">
                {mobileSections.map((section) => (
                  <section key={section.title} className="rounded-xl border border-white/6 bg-white/[0.03] p-1.5">
                    <p className="px-2 pb-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">{section.title}</p>
                    <DropdownTabList tabs={section.tabs} onSelect={handleSelectTab} autoFocusFirst={section.title === 'Main'} />
                  </section>
                ))}

                <section className="rounded-xl border border-white/6 bg-white/[0.03] p-1.5">
                  <p className="px-2 pb-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Export</p>
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
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative mx-auto hidden w-full max-w-6xl md:flex md:flex-wrap md:items-end md:gap-1 md:px-5 xl:flex-nowrap xl:px-0">
        <div className="flex min-w-0 flex-wrap items-end gap-1 md:flex-1">
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
                          <DropdownTabList
                            tabs={section.tabs}
                            onSelect={handleSelectTab}
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
                          <DropdownTabList
                            tabs={section.tabs}
                            onSelect={handleSelectTab}
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
                          <DropdownTabList
                            tabs={section.tabs}
                            onSelect={handleSelectTab}
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
          <div className="relative flex-shrink-0 xl:ml-auto" data-export-ignore="true">
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
                {utilityTabs.length > 0 ? <DropdownTabList tabs={utilityTabs} onSelect={handleSelectTab} autoFocusFirst /> : null}
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