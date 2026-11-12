import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppTab } from '@/components/app/appFrameTypes';
import { TabBadge } from '@/components/app/AppFrameHeaderShared';
import { NavIcon } from '@/components/app/navIcons';
import { useNotificationStore } from '@/stores/notificationStore';

export interface SidebarGroup {
  id: string;
  title: string;
  tabs: AppTab[];
}

interface AppSidebarProps {
  groups: SidebarGroup[];
  collapsed: boolean;
  mobileOpen: boolean;
  exportDisabled: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onExportCurrentPage: () => void;
  onExportAllPages: () => void;
  currentUserLabel: string;
  canManageUsers: boolean;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement: () => void;
  onLogout: () => void;
}

function userInitials(userLabel: string): string {
  const parts = (userLabel.split('·')[0] ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

const itemBase = 'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[0.86rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55';

function NavItem({ tab, collapsed, onSelect, showIcon = true }: { tab: AppTab; collapsed: boolean; onSelect: (tab: AppTab) => void; showIcon?: boolean }): ReactNode {
  return (
    <button
      type="button"
      disabled={tab.disabled}
      title={tab.disabledReason ?? (collapsed ? tab.label : undefined)}
      aria-label={tab.label}
      aria-current={tab.active ? 'page' : undefined}
      onClick={() => onSelect(tab)}
      className={`${itemBase} ${collapsed ? 'justify-center px-0' : ''} ${showIcon ? '' : 'pl-9'} ${tab.active ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-ink)]' : 'text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-active-ink)]'}`}
    >
      {showIcon ? <NavIcon page={tab.key} className="h-[1.1rem] w-[1.1rem] shrink-0" /> : null}
      {collapsed ? (
        tab.badgeCount ? <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> : null
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{tab.label}</span>
          <TabBadge count={tab.badgeCount} />
        </>
      )}
    </button>
  );
}

export function AppSidebar({
  groups,
  collapsed,
  mobileOpen,
  exportDisabled,
  onToggleCollapsed,
  onCloseMobile,
  onExportCurrentPage,
  onExportAllPages,
  currentUserLabel,
  canManageUsers,
  onOpenNotifications,
  onOpenSettings,
  onOpenUserManagement,
  onLogout,
}: AppSidebarProps): ReactNode {
  const unreadCount = useNotificationStore((state) => state.notifications.filter((item) => !item.seen).length);
  const [accountOpen, setAccountOpen] = useState(false);
  const activeGroupId = groups.find((group) => group.tabs.some((tab) => tab.active))?.id;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroupId ? [activeGroupId] : []));
  const mainGroup = groups.find((group) => group.id === 'main');
  const sections = useMemo(() => groups.filter((group) => group.id !== 'main'), [groups]);
  const rail = collapsed && !mobileOpen;
  const [flyout, setFlyout] = useState<{ id: string; top: number } | null>(null);
  const flyoutGroup = flyout ? sections.find((group) => group.id === flyout.id) : undefined;

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((current) => (current.has(activeGroupId) ? current : new Set(current).add(activeGroupId)));
  }, [activeGroupId]);

  useEffect(() => {
    if (!flyout) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFlyout(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [flyout]);

  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!rail) setFlyout(null);
  }, [rail]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseMobile(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  function select(tab: AppTab) {
    setFlyout(null);
    onCloseMobile();
    tab.onClick();
  }

  function toggleGroup(id: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <>
      {mobileOpen ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onCloseMobile} data-export-ignore="true" /> : null}
      <aside
        data-export-ignore="true"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--sidebar-line)] bg-[var(--sidebar-bg)] text-[var(--sidebar-ink)] transition-[width,transform] duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${rail ? 'w-64 md:w-[4.25rem]' : 'w-64'}`}
      >
        <div className={`flex h-14 shrink-0 items-center border-b border-[var(--sidebar-line)] ${rail ? 'justify-center' : 'justify-between px-4'}`}>
          {rail ? (
            <span className="text-sm font-bold tracking-tight text-[var(--sidebar-active-ink)]" aria-label="ResolutionAV">RA</span>
          ) : (
            <span className="flex flex-col leading-tight">
              <span className="text-[0.95rem] font-bold tracking-[0.02em] text-[var(--sidebar-active-ink)]">ResolutionAV</span>
              <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--sidebar-muted)]">Operations portal</span>
            </span>
          )}
        </div>

        <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {mainGroup ? mainGroup.tabs.map((tab) => <NavItem key={tab.key} tab={tab} collapsed={rail} onSelect={select} />) : null}

          {sections.map((group) => {
            const open = openGroups.has(group.id);
            const badge = group.tabs.reduce((sum, tab) => sum + (tab.badgeCount ?? 0), 0);
            if (rail) {
              const groupActive = group.tabs.some((tab) => tab.active);
              return (
                <div key={group.id} className="mt-2 border-t border-[var(--sidebar-line)] pt-2">
                  <button
                    type="button"
                    aria-label={group.title}
                    aria-haspopup="menu"
                    aria-expanded={flyout?.id === group.id}
                    title={group.title}
                    onClick={(event) => {
                      const top = event.currentTarget.getBoundingClientRect().top;
                      setFlyout((current) => (current?.id === group.id ? null : { id: group.id, top }));
                    }}
                    className={`${itemBase} justify-center px-0 ${groupActive ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-ink)]' : 'text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-active-ink)]'}`}
                  >
                    <NavIcon page={`group-${group.id}`} className="h-[1.1rem] w-[1.1rem] shrink-0" />
                    {badge > 0 ? <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> : null}
                  </button>
                </div>
              );
            }
            return (
              <div key={group.id} className="pt-2">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`sidebar-group-${group.id}`}
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--sidebar-muted)] transition-colors hover:text-[var(--sidebar-active-ink)]"
                >
                  <span className="inline-flex items-center gap-2"><NavIcon page={`group-${group.id}`} className="h-[1.1rem] w-[1.1rem] shrink-0" />{group.title}{!open && badge > 0 ? <TabBadge count={badge} /> : null}</span>
                  <span aria-hidden="true" className="text-base leading-none">{open ? '−' : '+'}</span>
                </button>
                {open ? (
                  <div id={`sidebar-group-${group.id}`} className="mt-0.5 space-y-0.5">
                    {group.tabs.map((tab) => <NavItem key={tab.key} tab={tab} collapsed={false} onSelect={select} showIcon={false} />)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-[var(--sidebar-line)] px-2 py-2">
          {!rail ? (
            <div>
              <button
                type="button"
                aria-expanded={exportOpen}
                aria-controls="sidebar-export-menu"
                onClick={() => setExportOpen((value) => !value)}
                className={`${itemBase} justify-between text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)]`}
              >
                <span className="inline-flex items-center gap-3"><NavIcon page="export" className="h-[1.1rem] w-[1.1rem] shrink-0" />Export</span>
                <span aria-hidden="true" className="text-base leading-none">{exportOpen ? '−' : '+'}</span>
              </button>
              {exportOpen ? (
                <div id="sidebar-export-menu" className="mt-0.5 space-y-0.5">
                  <button type="button" disabled={exportDisabled} onClick={() => { onCloseMobile(); onExportCurrentPage(); }} className={`${itemBase} pl-10 text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)]`}>Export page as PDF</button>
                  <button type="button" disabled={exportDisabled} onClick={() => { onCloseMobile(); onExportAllPages(); }} className={`${itemBase} pl-10 text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)]`}>Export full PDF</button>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            title={rail ? 'Notifications' : undefined}
            onClick={() => { onCloseMobile(); onOpenNotifications(); }}
            className={`${itemBase} relative text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)] ${rail ? 'justify-center px-0' : ''}`}
          >
            <NavIcon page="notifications" className="h-[1.1rem] w-[1.1rem] shrink-0" />
            {rail ? (
              unreadCount > 0 ? <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> : null
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">Notifications</span>
                <TabBadge count={unreadCount > 0 ? unreadCount : undefined} />
              </>
            )}
          </button>
          <div className="relative">
            {accountOpen ? (
              <>
                <button type="button" aria-label="Close account menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setAccountOpen(false)} />
                <div
                  role="menu"
                  aria-label="Account menu"
                  className={`absolute z-50 w-56 rounded-xl border border-[var(--sidebar-line)] bg-[var(--sidebar-bg)] p-1.5 shadow-xl ${rail ? 'bottom-0 left-full ml-2' : 'bottom-full left-0 mb-2'}`}
                >
                  <button role="menuitem" type="button" className={`${itemBase} text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)]`} onClick={() => { setAccountOpen(false); onCloseMobile(); onOpenSettings(); }}>Settings</button>
                  {canManageUsers ? (
                    <button role="menuitem" type="button" className={`${itemBase} text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)]`} onClick={() => { setAccountOpen(false); onCloseMobile(); onOpenUserManagement(); }}>User Management</button>
                  ) : null}
                  <button role="menuitem" type="button" className={`${itemBase} text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)]`} onClick={() => { setAccountOpen(false); onLogout(); }}>Log Out</button>
                </div>
              </>
            ) : null}
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label="Open account menu"
              title={rail ? currentUserLabel : undefined}
              onClick={() => setAccountOpen((open) => !open)}
              className={`${itemBase} text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)] ${rail ? 'justify-center px-0' : ''}`}
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft-bg)] text-[0.66rem] font-bold text-[var(--accent-soft-ink)]">{userInitials(currentUserLabel)}</span>
              {rail ? null : <span className="min-w-0 flex-1 truncate">{(currentUserLabel.split('·')[0] ?? '').trim() || 'Account'}</span>}
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`${itemBase} hidden text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover-bg)] md:flex ${rail ? 'justify-center px-0' : ''}`}
          >
            <NavIcon page={collapsed ? 'expand' : 'collapse'} className="h-[1.1rem] w-[1.1rem] shrink-0" />
            {rail ? null : 'Collapse'}
          </button>
        </div>
      </aside>
      {rail && flyoutGroup && flyout ? (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 hidden cursor-default md:block" onClick={() => setFlyout(null)} data-export-ignore="true" />
          <div
            role="menu"
            aria-label={flyoutGroup.title}
            data-export-ignore="true"
            style={{ top: Math.max(8, flyout.top) }}
            className="fixed left-[4.5rem] z-50 hidden w-56 rounded-xl border border-[var(--sidebar-line)] bg-[var(--sidebar-bg)] p-2 shadow-xl md:block"
          >
            <p className="m-0 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--sidebar-muted)]">{flyoutGroup.title}</p>
            {flyoutGroup.tabs.map((tab) => <NavItem key={tab.key} tab={tab} collapsed={false} onSelect={select} showIcon={false} />)}
          </div>
        </>
      ) : null}
    </>
  );
}
