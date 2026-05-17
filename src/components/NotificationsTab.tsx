import { useMemo, useState } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { PageTitleHeader } from '@/components/app/PageTitleHeader';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
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

function ResetIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M16.25 5.833V10h-4.167" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.26 11.667a5.833 5.833 0 1 1 .397-4.962L16.25 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const compactIconButtonClassName = 'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[var(--line)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50';

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

  function resetControls(): void {
    setSearch('');
    setToneFilter('all');
    setStatusFilter('all');
    setSortBy('newest');
  }

  return (
    <AppPageLayout>
      <PageTitleHeader
        eyebrow="User"
        title="Notifications"
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
        <QueueSearchToolbar
          className="rounded-xl border border-[var(--line)] bg-[rgba(9,16,26,0.45)] p-3"
          searchAriaLabel="Search notifications"
          searchPlaceholder="Search title, message, or key"
          searchValue={search}
          onSearchChange={setSearch}
          sortAriaLabel="Sort notifications"
          sortValue={sortBy}
          sortOptions={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'unread-first', label: 'Unread first' },
            { value: 'tone', label: 'Tone priority' },
          ]}
          onSortChange={(value) => setSortBy(value as NotificationSort)}
          filters={[
            {
              ariaLabel: 'Filter by notification tone',
              value: toneFilter,
              onChange: (value) => setToneFilter(value as 'all' | NotificationTone),
              options: [
                { value: 'all', label: 'All tones' },
                { value: 'info', label: 'Info' },
                { value: 'success', label: 'Success' },
                { value: 'warning', label: 'Warning' },
                { value: 'error', label: 'Error' },
              ],
            },
            {
              ariaLabel: 'Filter by read status',
              value: statusFilter,
              onChange: (value) => setStatusFilter(value as NotificationStatusFilter),
              options: [
                { value: 'all', label: 'All status' },
                { value: 'unread', label: 'Unread' },
                { value: 'seen', label: 'Seen' },
              ],
            },
          ]}
          compactFilters
          actions={(
            <button
              type="button"
              onClick={resetControls}
              disabled={!hasActiveControls}
              className={compactIconButtonClassName}
              aria-label="Reset notification search and filters"
              title="Reset"
            >
              <ResetIcon />
            </button>
          )}
        />

        {filteredNotifications.length === 0 ? (
          <p className="mt-4 rounded-lg border border-[var(--line)] px-4 py-3 text-[0.86rem] text-[var(--muted)]">
            {notifications.length === 0 ? 'No active notifications right now.' : 'No notifications match your current search and filters.'}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredNotifications.map((notification) => (
              <article
                key={notification.id}
                className={[
                  'rounded-xl border bg-[rgba(9,16,26,0.55)] px-4 py-3 transition-colors',
                  notification.seen
                    ? 'border-[var(--line)]'
                    : 'border-rose-400/35 bg-[linear-gradient(90deg,rgba(244,63,94,0.08),rgba(9,16,26,0.55)_16%)]',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] ${toneClassMap[notification.tone]}`}>
                        {toneLabelMap[notification.tone]}
                      </span>
                      <span className="text-[0.72rem] text-[var(--muted)]">{formatTimestamp(notification.createdAt)}</span>
                      {notification.key && <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[0.66rem] font-bold text-slate-300">{notification.key}</span>}
                    </div>
                    <h4 className="mt-2 flex items-center gap-2 text-[0.95rem] font-bold text-[var(--ink)]">
                      {!notification.seen ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400 shadow-[0_0_0_4px_rgba(251,113,133,0.14)]" aria-hidden="true" /> : null}
                      <span>{notification.title}</span>
                    </h4>
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
    </AppPageLayout>
  );
}
