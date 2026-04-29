import type { ReactNode } from 'react';
import { secondaryActionButtonClass } from '@/components/app/buttonStyles';
import type { OpenDropdown } from '@/components/app/appFrameTypes';
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
      <button
        type="button"
        aria-haspopup="menu"
        aria-controls="account-menu"
        aria-expanded={openDropdown === 'account'}
        aria-label="Open account menu"
        onClick={() => onToggleDropdown('account')}
        onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'account', onToggleDropdown, onCloseDropdowns)}
        className={secondaryActionButtonClass}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-[0.66rem] font-bold text-cyan-200">{initials}</span>
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
  );
}