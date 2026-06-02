import { useEffect, type ReactNode, type Ref } from 'react';
import type { AppTab, OpenDropdown } from '@/components/app/appFrameTypes';
import { AppFrameHeaderAccountMenu } from '@/components/app/AppFrameHeaderAccountMenu';
import { AppFrameHeaderNavigation } from '@/components/app/AppFrameHeaderNavigation';
import { AppFrameHeaderNotificationsMenu } from '@/components/app/AppFrameHeaderNotificationsMenu';

interface AppFrameHeaderProps {
  headerRef: Ref<HTMLElement>;
  currentUserLabel: string;
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
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement: () => void;
  canManageUsers: boolean;
  onLogout: () => void;
  openDropdown: OpenDropdown;
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void;
  onCloseDropdowns: () => void;
}

export function AppFrameHeader({
  headerRef,
  currentUserLabel,
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
  onOpenNotifications,
  onOpenSettings,
  onOpenUserManagement,
  canManageUsers,
  onLogout,
  openDropdown,
  onToggleDropdown,
  onCloseDropdowns,
}: AppFrameHeaderProps): ReactNode {
  useEffect(() => {
    if (!openDropdown) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseDropdowns();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCloseDropdowns, openDropdown]);

  return (
    <header ref={headerRef} className="relative z-40 border-b border-[var(--line)] bg-[rgba(7,17,28,0.85)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2.5 px-4 py-2 sm:px-5 xl:px-0 xl:gap-4 xl:py-3">
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 max-w-[9ch] text-[0.82rem] font-semibold leading-[1.02] tracking-[-0.01em] text-[var(--ink)] sm:max-w-none sm:text-[0.88rem] xl:max-w-[12ch] xl:text-[0.96rem]">
            <span>ResolutionAV</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 xl:gap-2" data-export-ignore="true">
          <AppFrameHeaderNotificationsMenu
            openDropdown={openDropdown}
            onToggleDropdown={onToggleDropdown}
            onCloseDropdowns={onCloseDropdowns}
            onOpenNotifications={onOpenNotifications}
          />
          <AppFrameHeaderAccountMenu
            currentUserLabel={currentUserLabel}
            canManageUsers={canManageUsers}
            openDropdown={openDropdown}
            onToggleDropdown={onToggleDropdown}
            onCloseDropdowns={onCloseDropdowns}
            onOpenNotifications={onOpenNotifications}
            onOpenSettings={onOpenSettings}
            onOpenUserManagement={onOpenUserManagement}
            onLogout={onLogout}
          />
        </div>
      </div>
      <div className="pb-4 md:pb-0">
        <AppFrameHeaderNavigation
          tabs={tabs}
          intakeTabs={intakeTabs}
          listingsTabs={listingsTabs}
          postPublishTabs={postPublishTabs}
          inventoryProcessingTabs={inventoryProcessingTabs}
          postEbayTabs={postEbayTabs}
          utilityTabs={utilityTabs}
          exportDisabled={exportDisabled}
          onExportCurrentPage={onExportCurrentPage}
          onExportAllPages={onExportAllPages}
          openDropdown={openDropdown}
          onToggleDropdown={onToggleDropdown}
          onCloseDropdowns={onCloseDropdowns}
        />
      </div>
    </header>
  );
}