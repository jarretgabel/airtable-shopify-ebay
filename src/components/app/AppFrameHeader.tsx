import { useEffect, type ReactNode, type Ref } from 'react';
import type { AppTab, OpenDropdown } from '@/components/app/appFrameTypes';
import { AppFrameHeaderAccountMenu } from '@/components/app/AppFrameHeaderAccountMenu';
import { AppFrameHeaderNavigation } from '@/components/app/AppFrameHeaderNavigation';
import { AppFrameHeaderNotificationsMenu } from '@/components/app/AppFrameHeaderNotificationsMenu';
import { SecondaryActionButton } from '@/components/app/SecondaryActionButton';
import type { AppTheme } from '@/services/themePreference';

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
  theme: AppTheme;
  onToggleTheme: () => void;
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
  theme,
  onToggleTheme,
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
    <header ref={headerRef} className="relative z-40 border-b border-[var(--line)] bg-[var(--header-surface)] backdrop-blur-md">
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
          <SecondaryActionButton
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={onToggleTheme}
            className="!px-2.5 !py-2 sm:!px-3 lg:!px-3 lg:!py-2 xl:!px-4 xl:!py-2.5"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center lg:h-5 lg:w-5 xl:h-6 xl:w-6" aria-hidden="true">
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 lg:h-4 lg:w-4 xl:h-4.5 xl:w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2.75v2.2M12 19.05v2.2M4.92 4.92l1.56 1.56M17.52 17.52l1.56 1.56M2.75 12h2.2M19.05 12h2.2M4.92 19.08l1.56-1.56M17.52 6.48l1.56-1.56" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 lg:h-4 lg:w-4 xl:h-4.5 xl:w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M20.6 14.3A8.4 8.4 0 1 1 9.7 3.4 7.2 7.2 0 0 0 20.6 14.3Z" />
                </svg>
              )}
            </span>
          </SecondaryActionButton>
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