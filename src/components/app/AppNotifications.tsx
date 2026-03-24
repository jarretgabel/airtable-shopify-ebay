import type { ReactNode } from 'react';
import { useNotificationStore, type NotificationTone } from '@/stores/notificationStore';

const toneClassMap: Record<NotificationTone, string> = {
  info: 'border-sky-500/40 bg-sky-950/25 text-sky-100',
  success: 'border-emerald-500/40 bg-emerald-950/25 text-emerald-100',
  warning: 'border-amber-500/40 bg-amber-950/25 text-amber-100',
  error: 'border-rose-500/40 bg-rose-950/25 text-rose-100',
};

function NotificationCard({
  id,
  tone,
  title,
  message,
  actionLabel,
  onAction,
  dismissible,
}: {
  id: string;
  tone: NotificationTone;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissible: boolean;
}): ReactNode {
  const dismiss = useNotificationStore((state) => state.dismiss);

  function handleAction() {
    onAction?.();
    dismiss(id);
  }

  return (
    <article className={`rounded-xl border px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.26)] ${toneClassMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.82rem] font-extrabold uppercase tracking-[0.07em]">{title}</p>
          <p className="mt-1 text-[0.84rem] leading-relaxed text-white/90">{message}</p>
        </div>

        {dismissible && (
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/20 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
            onClick={() => dismiss(id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        )}
      </div>

      {actionLabel && onAction && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleAction}
            className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-[0.78rem] font-bold uppercase tracking-[0.05em] text-white transition hover:bg-white/18"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </article>
  );
}

export function AppNotifications(): ReactNode {
  const notifications = useNotificationStore((state) => state.notifications);
  const visibleNotifications = notifications.slice(0, 4);

  return (
    <div
      className="pointer-events-none fixed right-3 top-20 z-[80] w-[min(420px,calc(100vw-1.5rem))] space-y-2 sm:right-4 sm:top-24"
      aria-live="polite"
      aria-label="Action notifications"
    >
      {visibleNotifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationCard
            id={notification.id}
            tone={notification.tone}
            title={notification.title}
            message={notification.message}
            actionLabel={notification.actionLabel}
            onAction={notification.onAction}
            dismissible={notification.dismissible}
          />
        </div>
      ))}
    </div>
  );
}
