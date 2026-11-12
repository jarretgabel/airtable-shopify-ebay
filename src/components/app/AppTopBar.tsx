import { useEffect, type ReactNode, type Ref } from 'react';
import { AppFrameHeaderAccountMenu } from '@/components/app/AppFrameHeaderAccountMenu';
import { AppFrameHeaderNotificationsMenu } from '@/components/app/AppFrameHeaderNotificationsMenu';
import { NavIcon } from '@/components/app/navIcons';
import { SecondaryActionButton } from '@/components/app/SecondaryActionButton';
import type { OpenDropdown } from '@/components/app/appFrameTypes';
import type { AppTheme } from '@/services/themePreference';

interface AppTopBarProps {
  barRef: Ref<HTMLElement>;
  groupTitle: string | null;
  pageLabel: string | null;
  currentUserLabel: string;
  canManageUsers: boolean;
  theme: AppTheme;
  onToggleTheme: () => void;
  onOpenMobileNav: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement: () => void;
  onLogout: () => void;
  openDropdown: OpenDropdown;
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void;
  onCloseDropdowns: () => void;
}

export function AppTopBar({
  barRef,
  groupTitle,
  pageLabel,
  currentUserLabel,
  canManageUsers,
  theme,
  onToggleTheme,
  onOpenMobileNav,
  onOpenNotifications,
  onOpenSettings,
  onOpenUserManagement,
  onLogout,
  openDropdown,
  onToggleDropdown,
  onCloseDropdowns,
}: AppTopBarProps): ReactNode {
  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseDropdowns(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCloseDropdowns, openDropdown]);

  return (
    <header ref={barRef} className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--header-surface)] px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3" data-export-ignore="true">
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={onOpenMobileNav}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink)] md:hidden"
        >
          <NavIcon page="menu" className="h-5 w-5" />
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          {groupTitle ? <><span className="hidden text-[var(--muted)] sm:inline">{groupTitle}</span><span className="hidden text-[var(--muted)] sm:inline" aria-hidden="true">/</span></> : null}
          <span className="truncate font-semibold text-[var(--ink)]">{pageLabel ?? 'ResolutionAV'}</span>
        </nav>
      </div>
      <div className="flex items-center gap-1.5" data-export-ignore="true">
        <SecondaryActionButton
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={onToggleTheme}
          className="!h-9 !w-9 !rounded-lg !p-0 focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-sky-400/60"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center" aria-hidden="true">
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2.75v2.2M12 19.05v2.2M4.92 4.92l1.56 1.56M17.52 17.52l1.56 1.56M2.75 12h2.2M19.05 12h2.2M4.92 19.08l1.56-1.56M17.52 6.48l1.56-1.56" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M20.6 14.3A8.4 8.4 0 1 1 9.7 3.4 7.2 7.2 0 0 0 20.6 14.3Z" />
              </svg>
            )}
          </span>
        </SecondaryActionButton>
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
    </header>
  );
}
