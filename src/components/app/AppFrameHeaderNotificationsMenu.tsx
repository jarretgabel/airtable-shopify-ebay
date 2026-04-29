import { useMemo, useState, type ReactNode } from 'react';
import { secondaryActionButtonClass } from '@/components/app/buttonStyles';
import type { OpenDropdown } from '@/components/app/appFrameTypes';
import { handleDropdownTriggerKeyDown } from '@/components/app/AppFrameHeaderShared';
import { useNotificationStore } from '@/stores/notificationStore';

type NotificationQuickFilter = 'all' | 'unread' | 'error';

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface AppFrameHeaderNotificationsMenuProps {
  openDropdown: OpenDropdown;
  onToggleDropdown: (next: Exclude<OpenDropdown, null>) => void;
  onCloseDropdowns: () => void;
  onOpenNotifications: () => void;
}

export function AppFrameHeaderNotificationsMenu({
  openDropdown,
  onToggleDropdown,
  onCloseDropdowns,
  onOpenNotifications,
}: AppFrameHeaderNotificationsMenuProps): ReactNode {
  const notifications = useNotificationStore((state) => state.notifications);
  const notificationCount = notifications.filter((item) => !item.seen).length;
  const markSeen = useNotificationStore((state) => state.markSeen);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const [notificationQuickFilter, setNotificationQuickFilter] = useState<NotificationQuickFilter>('all');
  const recentNotifications = useMemo(() => {
    const sorted = [...notifications].sort((left, right) => right.createdAt - left.createdAt);
    const filtered = sorted.filter((notification) => {
      if (notificationQuickFilter === 'unread') return !notification.seen;
      if (notificationQuickFilter === 'error') return notification.tone === 'error';
      return true;
    });
    return filtered.slice(0, 5);
  }, [notificationQuickFilter, notifications]);

  return (
    <div className="relative" data-export-ignore="true">
      <button
        type="button"
        aria-haspopup="menu"
        aria-controls="notifications-menu"
        aria-expanded={openDropdown === 'notifications'}
        aria-label="Open notifications menu"
        onClick={() => onToggleDropdown('notifications')}
        onKeyDown={(event) => handleDropdownTriggerKeyDown(event, 'notifications', onToggleDropdown, onCloseDropdowns)}
        className={`${secondaryActionButtonClass} relative px-2.5`}
      >
        <span className="relative inline-flex h-6 w-6 items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="M6 9a6 6 0 0 1 12 0v4.4l1.6 2.1a1 1 0 0 1-.8 1.6H5.2a1 1 0 0 1-.8-1.6L6 13.4V9Z" />
            <path d="M9.7 18.2a2.4 2.4 0 0 0 4.6 0" />
          </svg>
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.62rem] font-bold leading-none text-white">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </span>
      </button>

      {openDropdown === 'notifications' && (
        <div
          id="notifications-menu"
          role="menu"
          aria-label="Notifications menu"
          className="absolute right-0 top-[calc(100%+0.45rem)] z-[70] w-[min(420px,92vw)] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_14px_28px_rgba(2,6,23,0.35)]"
        >
          <div className="flex items-center justify-between px-3 pb-1.5 pt-1">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Recent notifications</span>
            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.66rem] font-bold text-[var(--muted)]">{notificationCount} unread</span>
          </div>

          <div className="flex items-center gap-1 px-2 pb-1">
            <button
              type="button"
              onClick={() => setNotificationQuickFilter('all')}
              className={`rounded-full border px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.06em] transition ${notificationQuickFilter === 'all' ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-200' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setNotificationQuickFilter('unread')}
              className={`rounded-full border px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.06em] transition ${notificationQuickFilter === 'unread' ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-200' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setNotificationQuickFilter('error')}
              className={`rounded-full border px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.06em] transition ${notificationQuickFilter === 'error' ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-200' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              Errors
            </button>
          </div>

          {recentNotifications.length === 0 ? (
            <p className="mx-1.5 mb-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-[0.82rem] text-[var(--muted)]">
              {notifications.length === 0 ? 'No notifications yet.' : 'No notifications match this filter.'}
            </p>
          ) : (
            <div className="max-h-[320px] space-y-1 overflow-auto px-1 pb-1">
              {recentNotifications.map((notification, index) => (
                <article
                  key={notification.id}
                  className="rounded-lg border border-[var(--line)] bg-[rgba(9,16,26,0.55)] px-3 py-2"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-[0.82rem] font-semibold text-[var(--ink)]">{notification.title}</span>
                    {!notification.seen && <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-cyan-200">New</span>}
                  </div>
                  <span className="mt-1 line-clamp-2 text-[0.76rem] leading-relaxed text-[var(--muted)]">{notification.message}</span>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[0.66rem] text-[var(--muted)]">{formatTimestamp(notification.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      {!notification.seen && (
                        <button
                          autoFocus={index === 0}
                          role="menuitem"
                          type="button"
                          onClick={() => markSeen(notification.id)}
                          className="rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-cyan-200 transition hover:bg-cyan-500/20"
                        >
                          Seen
                        </button>
                      )}
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => dismiss(notification.id)}
                        className="rounded-md border border-[var(--line)] px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-[var(--muted)] transition hover:text-[var(--ink)]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <button
            role="menuitem"
            type="button"
            onClick={() => {
              onCloseDropdowns();
              onOpenNotifications();
            }}
            className="mx-1 mt-1.5 flex w-[calc(100%-0.5rem)] items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-[0.76rem] font-bold uppercase tracking-[0.07em] text-cyan-200 transition hover:bg-cyan-500/20"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}