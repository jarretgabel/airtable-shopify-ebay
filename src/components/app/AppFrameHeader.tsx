import { useEffect, type ReactNode, type Ref } from 'react';
import { accentActionButtonClass, primaryActionButtonClass } from '@/components/app/buttonStyles';
import type { AppTab, OpenDropdown } from '@/components/app/appFrameTypes';
import { AppFrameHeaderAccountMenu } from '@/components/app/AppFrameHeaderAccountMenu';
import { AppFrameHeaderNavigation } from '@/components/app/AppFrameHeaderNavigation';
import { AppFrameHeaderNotificationsMenu } from '@/components/app/AppFrameHeaderNotificationsMenu';
import { handleDropdownTriggerKeyDown } from '@/components/app/AppFrameHeaderShared';

interface AppFrameHeaderProps {
  headerRef: Ref<HTMLElement>;
  currentUserLabel: string;
  tabs: AppTab[];
  ebayTabs: AppTab[];
  inventoryProcessingTabs: AppTab[];
  shopifyTabs: AppTab[];
  postEbayTabs: AppTab[];
  utilityTabs: AppTab[];
  refreshLabel: string;
  refreshDisabled: boolean;
  onRefresh: () => void;
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
  ebayTabs,
  inventoryProcessingTabs,
  shopifyTabs,
  postEbayTabs,
  utilityTabs,
  refreshLabel,
  refreshDisabled,
  onRefresh,
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
          <button type="button" onClick={onRefresh} disabled={refreshDisabled} className={primaryActionButtonClass}>{refreshLabel}</button>
          <div className="relative" data-export-ignore="true">
            <button
              type="button"
              onClick={() => !exportDisabled && onToggleDropdown('pdf')}
              aria-haspopup="menu"
              aria-controls="pdf-menu"
              aria-expanded={openDropdown === 'pdf'}
              onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'pdf', onToggleDropdown, onCloseDropdowns)}
              className={`${accentActionButtonClass} ${exportDisabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              <span className="inline-flex items-center gap-1.5">
                Download PDF
                <span className={`text-[0.72rem] transition-transform ${openDropdown === 'pdf' ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
              </span>
            </button>
            {openDropdown === 'pdf' && (
              <div
                id="pdf-menu"
                role="menu"
                aria-label="PDF export options"
                className="absolute right-0 top-[calc(100%+0.45rem)] z-[70] min-w-[230px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
              >
                <button role="menuitem" type="button" autoFocus={!exportDisabled} disabled={exportDisabled} onClick={() => { onCloseDropdowns(); onExportCurrentPage(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Download Current Page</button>
                <button role="menuitem" type="button" disabled={exportDisabled} onClick={() => { onCloseDropdowns(); onExportAllPages(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Download All Pages</button>
              </div>
            )}
          </div>
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
        ebayTabs={ebayTabs}
        inventoryProcessingTabs={inventoryProcessingTabs}
        shopifyTabs={shopifyTabs}
        postEbayTabs={postEbayTabs}
        utilityTabs={utilityTabs}
        openDropdown={openDropdown}
        onToggleDropdown={onToggleDropdown}
        onCloseDropdowns={onCloseDropdowns}
      />
    </header>
  );
}