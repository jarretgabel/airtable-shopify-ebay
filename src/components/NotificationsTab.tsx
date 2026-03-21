import { useMemo, useState } from 'react';
import { PageTitleHeader } from '@/components/app/PageTitleHeader';
import { useNotificationStore, type NotificationTone } from '@/stores/notificationStore';

const toneLabelMap: Record<NotificationTone, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

const toneClassMap: Record<NotificationTone, string> = {
  info: 'bg-sky-900/35 text-sky-200 border-sky-500/35',
  success: 'bg-emerald-900/35 text-emerald-200 border-emerald-500/35',
  warning: 'bg-amber-900/35 text-amber-200 border-amber-500/35',
  error: 'bg-rose-900/35 text-rose-200 border-rose-500/35',
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type NotificationStatusFilter = 'all' | 'unread' | 'seen';
type NotificationSort = 'newest' | 'oldest' | 'unread-first' | 'tone';

const tonePriority: Record<NotificationTone, number> = {
  error: 0,
  warning: 1,
  info: 2,
  success: 3,
};

export function NotificationsTab() {
  const notifications = useNotificationStore((state) => state.notifications);
  const markSeen = useNotificationStore((state) => state.markSeen);
  const markAllSeen = useNotificationStore((state) => state.markAllSeen);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const clear = useNotificationStore((state) => state.clear);
  const [search, setSearch] = useState('');
  const [toneFilter, setToneFilter] = useState<'all' | NotificationTone>('all');
  const [statusFilter, setStatusFilter] = useState<NotificationStatusFilter>('all');
  const [sortBy, setSortBy] = useState<NotificationSort>('newest');
  const unreadCount = notifications.filter((notification) => !notification.seen).length;
  const hasActiveControls = search.trim().length > 0 || toneFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'newest';

  const filteredNotifications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return notifications
      .filter((notification) => {
        if (toneFilter !== 'all' && notification.tone !== toneFilter) return false;
        if (statusFilter === 'unread' && notification.seen) return false;
        if (statusFilter === 'seen' && !notification.seen) return false;

        if (!normalizedSearch) return true;
        const searchable = [
          notification.title,
          notification.message,
          notification.key,
          toneLabelMap[notification.tone],
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return a.createdAt - b.createdAt;
        if (sortBy === 'unread-first') {
          if (a.seen === b.seen) return b.createdAt - a.createdAt;
          return a.seen ? 1 : -1;
        }
        if (sortBy === 'tone') {
          const toneDelta = tonePriority[a.tone] - tonePriority[b.tone];
          if (toneDelta !== 0) return toneDelta;
          return b.createdAt - a.createdAt;
        }
        return b.createdAt - a.createdAt;
      });
  }, [notifications, search, sortBy, statusFilter, toneFilter]);

  const filteredUnreadCount = filteredNotifications.filter((notification) => !notification.seen).length;

  return (
    <section className="space-y-5">
      <PageTitleHeader
        title="Notifications"
        description="Review active notifications, run quick actions, and clear resolved items."
        descriptionClassName="max-w-[720px]"
        actions={(
          <>
            <button
              type="button"
              onClick={markAllSeen}
              disabled={unreadCount === 0}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[var(--muted)] transition hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark All Seen
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={notifications.length === 0}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[var(--muted)] transition hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear all notifications
            </button>
          </>
        )}
      />

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Active Notifications</h3>
          <div className="flex items-center gap-2">
            {filteredUnreadCount > 0 && (
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[0.72rem] font-bold text-cyan-200">
                {filteredUnreadCount} new
              </span>
            )}
            <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.72rem] font-bold text-[var(--muted)]">
              {filteredNotifications.length} shown
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-[var(--line)] bg-[rgba(9,16,26,0.45)] p-3 lg:grid-cols-[minmax(0,1fr)_160px_140px_170px_auto]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, message, or key"
            className="w-full rounded-lg border border-white/15 bg-slate-950/55 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
            aria-label="Search notifications"
          />

          <select
            value={toneFilter}
            onChange={(event) => setToneFilter(event.target.value as 'all' | NotificationTone)}
            className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[0.82rem] text-[var(--ink)]"
            aria-label="Filter by notification tone"
          >
            <option value="all">All tones</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as NotificationStatusFilter)}
            className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[0.82rem] text-[var(--ink)]"
            aria-label="Filter by read status"
          >
            <option value="all">All status</option>
            <option value="unread">Unread</option>
            <option value="seen">Seen</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as NotificationSort)}
            className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[0.82rem] text-[var(--ink)]"
            aria-label="Sort notifications"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="unread-first">Unread first</option>
            <option value="tone">Tone priority</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch('');
              setToneFilter('all');
              setStatusFilter('all');
              setSortBy('newest');
            }}
            disabled={!hasActiveControls}
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[var(--muted)] transition hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        </div>

        {filteredNotifications.length === 0 ? (
          <p className="mt-4 rounded-lg border border-[var(--line)] px-4 py-3 text-[0.86rem] text-[var(--muted)]">
            {notifications.length === 0 ? 'No active notifications right now.' : 'No notifications match your current search and filters.'}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredNotifications.map((notification) => (
              <article key={notification.id} className="rounded-xl border border-[var(--line)] bg-[rgba(9,16,26,0.55)] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notification.seen && (
                        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-cyan-200">
                          New
                        </span>
                      )}
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] ${toneClassMap[notification.tone]}`}>
                        {toneLabelMap[notification.tone]}
                      </span>
                      <span className="text-[0.72rem] text-[var(--muted)]">{formatTimestamp(notification.createdAt)}</span>
                      {notification.key && <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[0.66rem] font-bold text-slate-300">{notification.key}</span>}
                    </div>
                    <h4 className="mt-2 text-[0.95rem] font-bold text-[var(--ink)]">{notification.title}</h4>
                    <p className="mt-1 text-[0.85rem] leading-relaxed text-[var(--muted)]">{notification.message}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {!notification.seen && (
                      <button
                        type="button"
                        onClick={() => markSeen(notification.id)}
                        className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.05em] text-cyan-200 transition hover:bg-cyan-500/20"
                      >
                        Mark Seen
                      </button>
                    )}
                    {notification.actionLabel && notification.onAction && (
                      <button
                        type="button"
                        onClick={() => {
                          markSeen(notification.id);
                          notification.onAction?.();
                          dismiss(notification.id);
                        }}
                        className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.05em] text-[var(--ink)] transition hover:bg-white/5"
                      >
                        {notification.actionLabel}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => dismiss(notification.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
                      aria-label="Dismiss notification"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
