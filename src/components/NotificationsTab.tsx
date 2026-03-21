import { useMemo } from 'react';
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

export function NotificationsTab() {
  const notifications = useNotificationStore((state) => state.notifications);
  const markSeen = useNotificationStore((state) => state.markSeen);
  const markAllSeen = useNotificationStore((state) => state.markAllSeen);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const clear = useNotificationStore((state) => state.clear);
  const unreadCount = notifications.filter((notification) => !notification.seen).length;

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => b.createdAt - a.createdAt),
    [notifications],
  );

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">Action Center</p>
            <h2 className="m-0 text-[1.35rem] font-extrabold text-[var(--ink)]">Notifications</h2>
            <p className="mt-2 max-w-[720px] text-[0.9rem] leading-relaxed text-[var(--muted)]">
              Review active notifications, run quick actions, and clear resolved items.
            </p>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Active Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[0.72rem] font-bold text-cyan-200">
                {unreadCount} new
              </span>
            )}
            <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.72rem] font-bold text-[var(--muted)]">
              {sortedNotifications.length} active
            </span>
          </div>
        </div>

        {sortedNotifications.length === 0 ? (
          <p className="mt-4 rounded-lg border border-[var(--line)] px-4 py-3 text-[0.86rem] text-[var(--muted)]">
            No active notifications right now.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedNotifications.map((notification) => (
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
