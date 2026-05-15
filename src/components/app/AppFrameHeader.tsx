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
      <div className="mx-auto flex w-[min(1200px,96vw)] items-center justify-between gap-4 py-3">
        <div>
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Inventory Operations</span>
          <h1 className="m-0 text-[1rem] font-bold leading-none text-[var(--ink)]">Listing Control Center</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-export-ignore="true">
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
      <AppFrameHeaderNavigation
        tabs={tabs}
        intakeTabs={intakeTabs}
        listingsTabs={listingsTabs}
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
    </header>
  );
}