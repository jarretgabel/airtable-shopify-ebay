import { useEffect, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from 'react';
import { accentActionButtonClass, primaryActionButtonClass, secondaryActionButtonClass } from '@/components/app/buttonStyles';
import type { AppTab, OpenDropdown } from '@/components/app/appFrameTypes';
import { useNotificationStore } from '@/stores/notificationStore';

interface AppFrameHeaderProps {
  headerRef: Ref<HTMLElement>;
  currentUserLabel: string;
  tabs: AppTab[];
  ebayTabs: AppTab[];
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

function tabClassName(active: boolean): string {
  const base =
    'relative inline-flex items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55';
  if (active) {
    return `${base} text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-[var(--accent)]`;
  }
  return `${base} text-[var(--muted)] hover:text-[var(--ink)]`;
}

function TabBadge({ count }: { count?: number }): ReactNode {
  if (typeof count !== 'number' || count <= 0) return null;

  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white">
      {count}
    </span>
  );
}

function TabButton({ tab }: { tab: AppTab }): ReactNode {
  return (
    <button type="button" className={tabClassName(tab.active)} disabled={tab.disabled} onClick={tab.onClick}>
      {tab.label}
      <TabBadge count={tab.badgeCount} />
    </button>
  );
}

function DropdownTabList({
  tabs,
  onSelect,
  autoFocusFirst,
}: {
  tabs: AppTab[];
  onSelect: (tab: AppTab) => void;
  autoFocusFirst?: boolean;
}): ReactNode {
  const firstEnabledIndex = autoFocusFirst ? tabs.findIndex((t) => !t.disabled) : -1;
  return (
    <>
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={index === firstEnabledIndex}
          role="menuitem"
          type="button"
          disabled={tab.disabled}
          onClick={() => onSelect(tab)}
          className={[
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition',
            tab.active
              ? 'bg-sky-500/15 text-sky-200'
              : 'text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]',
            tab.disabled ? 'cursor-not-allowed opacity-60' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span>{tab.label}</span>
          <TabBadge count={tab.badgeCount} />
        </button>
      ))}
    </>
  );
}

function DropdownTrigger({
  active,
  expanded,
  label,
  menuId,
  badgeCount,
  onClick,
  onKeyDown,
}: {
  active: boolean;
  expanded: boolean;
  label: string;
  menuId: string;
  badgeCount?: number;
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-controls={menuId}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={tabClassName(active || expanded)}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        <TabBadge count={badgeCount} />
        <span className={`text-[0.72rem] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
      </span>
    </button>
  );
}

function userInitials(userLabel: string): string {
  const name = userLabel.split('·')[0]?.trim() ?? '';
  if (!name) return 'U';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function AppFrameHeader({
  headerRef,
  currentUserLabel,
  tabs,
  ebayTabs,
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
  const notifications = useNotificationStore((state) => state.notifications);
  const hasActiveEbayTab = ebayTabs.some((tab) => tab.active);
  const hasActiveShopifyTab = shopifyTabs.some((tab) => tab.active);
  const hasActiveUtilityTab = utilityTabs.some((tab) => tab.active);
  const ebayBadgeTotal = ebayTabs.reduce((sum, t) => sum + (t.badgeCount ?? 0), 0);
  const shopifyBadgeTotal = shopifyTabs.reduce((sum, t) => sum + (t.badgeCount ?? 0), 0);
  const utilityBadgeTotal = utilityTabs.reduce((sum, t) => sum + (t.badgeCount ?? 0), 0);
  const notificationCount = notifications.filter((item) => !item.seen).length;
  const initials = userInitials(currentUserLabel);

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

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, target: Exclude<OpenDropdown, null>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleDropdown(target);
    }
    if (event.key === 'Escape') {
      onCloseDropdowns();
    }
  }

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
              onKeyDown={(event) => handleTriggerKeyDown(event, 'pdf')}
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
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <button role="menuitem" type="button" autoFocus={!exportDisabled} disabled={exportDisabled} onClick={() => { onCloseDropdowns(); onExportCurrentPage(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Download Current Page</button>
                <button role="menuitem" type="button" disabled={exportDisabled} onClick={() => { onCloseDropdowns(); onExportAllPages(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Download All Pages</button>
              </div>
            )}
          </div>
          <div className="relative" data-export-ignore="true">
            <button
              type="button"
              aria-haspopup="menu"
              aria-controls="account-menu"
              aria-expanded={openDropdown === 'account'}
              aria-label="Open account menu"
              onClick={() => onToggleDropdown('account')}
              onKeyDown={(event) => handleTriggerKeyDown(event, 'account')}
              className={secondaryActionButtonClass}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-[0.66rem] font-bold text-cyan-200">{initials}</span>
                <TabBadge count={notificationCount > 0 ? notificationCount : undefined} />
                <span className={`text-[0.72rem] transition-transform ${openDropdown === 'account' ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
              </span>
            </button>

            {openDropdown === 'account' && (
              <div
                id="account-menu"
                role="menu"
                aria-label="Account menu"
                className="absolute right-0 top-[calc(100%+0.45rem)] z-[70] min-w-[220px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
              >
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <button
                  role="menuitem"
                  type="button"
                  autoFocus
                  onClick={() => {
                    onCloseDropdowns();
                    onOpenNotifications();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5"
                >
                  <span>Notifications</span>
                  <TabBadge count={notificationCount > 0 ? notificationCount : undefined} />
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onCloseDropdowns();
                    onOpenSettings();
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5"
                >
                  Settings
                </button>
                {canManageUsers && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      onCloseDropdowns();
                      onOpenUserManagement();
                    }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5"
                  >
                    User Management
                  </button>
                )}
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onCloseDropdowns();
                    onLogout();
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--ink)] transition hover:bg-white/5"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
                  onKeyDown={(event) => handleTriggerKeyDown(event, 'ebay')}
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
                  onKeyDown={(event) => handleTriggerKeyDown(event, 'shopify')}
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
                onKeyDown={(event) => handleTriggerKeyDown(event, 'utilities')}
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
    </header>
  );
}