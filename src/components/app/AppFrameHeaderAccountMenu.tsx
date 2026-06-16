import type { ReactNode } from 'react';
import { SecondaryActionButton } from '@/components/app/SecondaryActionButton';
import type { OpenDropdown } from '@/components/app/appFrameTypes';
import { appFrameMenuItemClass, appFrameMenuPanelClass } from '@/components/app/appFrameHeaderStyles';
import { TabBadge, handleDropdownTriggerKeyDown } from '@/components/app/AppFrameHeaderShared';
import { useNotificationStore } from '@/stores/notificationStore';

function userInitials(userLabel: string): string {
  const name = userLabel.split('·')[0]?.trim() ?? '';
  if (!name) return 'U';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

interface AppFrameHeaderAccountMenuProps {
  currentUserLabel: string;
  canManageUsers: boolean;
  openDropdown: OpenDropdown;
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void;
  onCloseDropdowns: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement: () => void;
  onLogout: () => void;
}

export function AppFrameHeaderAccountMenu({
  currentUserLabel,
  canManageUsers,
  openDropdown,
  onToggleDropdown,
  onCloseDropdowns,
  onOpenNotifications,
  onOpenSettings,
  onOpenUserManagement,
  onLogout,
}: AppFrameHeaderAccountMenuProps): ReactNode {
  const notificationCount = useNotificationStore((state) => state.notifications.filter((item) => !item.seen).length);
  const initials = userInitials(currentUserLabel);

  return (
    <div className="relative" data-export-ignore="true">
      <SecondaryActionButton
        aria-haspopup="menu"
        aria-controls="account-menu"
        aria-expanded={openDropdown === 'account'}
        aria-label="Open account menu"
        onClick={() => onToggleDropdown('account')}
        onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'account', onToggleDropdown, onCloseDropdowns)}
        className="!px-2.5 !py-2 sm:!px-3 lg:!px-3 lg:!py-2 xl:!px-4 xl:!py-2.5"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft-bg)] text-[0.66rem] font-bold text-[var(--accent-soft-ink)] lg:h-5 lg:w-5 lg:text-[0.62rem] xl:h-6 xl:w-6 xl:text-[0.66rem]">{initials}</span>
          <span className={`text-[0.72rem] transition-transform ${openDropdown === 'account' ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
        </span>
      </SecondaryActionButton>

      {openDropdown === 'account' && (
        <div
          id="account-menu"
          role="menu"
          aria-label="Account menu"
          className={`${appFrameMenuPanelClass} min-w-[220px]`}
        >
          <button
            role="menuitem"
            type="button"
            autoFocus
            onClick={() => {
              onCloseDropdowns();
              onOpenNotifications();
            }}
            className={`${appFrameMenuItemClass} justify-between`}
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
            className={appFrameMenuItemClass}
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
                className={appFrameMenuItemClass}
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
            className={appFrameMenuItemClass}
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}