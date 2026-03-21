import { create } from 'zustand';
import { useAuthStore } from '@/stores/auth/authStore';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type UserNotificationPreferences } from '@/stores/auth/authTypes';

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';
const SEEN_REGISTRY_KEY = 'listing-control-center.notification-seen-registry';

export interface AppNotification {
  id: string;
  key?: string;
  tone: NotificationTone;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissible: boolean;
  seen: boolean;
  createdAt: number;
}

interface NotificationInput {
  key?: string;
  tone: NotificationTone;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
}

interface NotificationStore {
  notifications: AppNotification[];
  push: (input: NotificationInput) => string;
  upsertByKey: (key: string, input: Omit<NotificationInput, 'key'>) => string;
  markSeen: (id: string) => void;
  markAllSeen: () => void;
  dismiss: (id: string) => void;
  dismissByKey: (key: string) => void;
  applyCurrentUserPreferences: () => void;
  clear: () => void;
}

const notificationTimers = new Map<string, number>();

interface SeenRegistryByUser {
  [userId: string]: Record<string, string>;
}

function clearNotificationTimer(id: string): void {
  const timerId = notificationTimers.get(id);
  if (typeof timerId !== 'number') return;

  window.clearTimeout(timerId);
  notificationTimers.delete(id);
}

function makeNotificationId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function currentUserIdOrGuest(): string {
  return useAuthStore.getState().currentUserId ?? 'guest';
}

function readSeenRegistry(): SeenRegistryByUser {
  try {
    const raw = window.localStorage.getItem(SEEN_REGISTRY_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as SeenRegistryByUser;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function persistSeenRegistry(next: SeenRegistryByUser): void {
  window.localStorage.setItem(SEEN_REGISTRY_KEY, JSON.stringify(next));
}

function seenSignatureFor(tone: NotificationTone, title: string, message: string, actionLabel?: string): string {
  return JSON.stringify({ tone, title, message, actionLabel: actionLabel ?? '' });
}

function isSeenForCurrentUser(key: string, signature: string): boolean {
  const registry = readSeenRegistry();
  const userMap = registry[currentUserIdOrGuest()] ?? {};
  return userMap[key] === signature;
}

function markSeenForCurrentUser(key: string, signature: string): void {
  const registry = readSeenRegistry();
  const userId = currentUserIdOrGuest();
  const userMap = registry[userId] ?? {};
  registry[userId] = {
    ...userMap,
    [key]: signature,
  };
  persistSeenRegistry(registry);
}

function getCurrentUserNotificationPreferences(): UserNotificationPreferences {
  const { users, currentUserId } = useAuthStore.getState();
  if (!currentUserId) return DEFAULT_USER_NOTIFICATION_PREFERENCES;

  const currentUser = users.find((user) => user.id === currentUserId);
  return currentUser?.notificationPreferences ?? DEFAULT_USER_NOTIFICATION_PREFERENCES;
}

function isToneEnabled(preferences: UserNotificationPreferences, tone: NotificationTone): boolean {
  if (tone === 'info') return preferences.infoEnabled;
  if (tone === 'success') return preferences.successEnabled;
  if (tone === 'warning') return preferences.warningEnabled;
  return preferences.errorEnabled;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  push: (input) => {
    const preferences = getCurrentUserNotificationPreferences();
    if (!isToneEnabled(preferences, input.tone)) {
      return '';
    }

    const id = makeNotificationId();
    const signature = seenSignatureFor(input.tone, input.title, input.message, input.actionLabel);
    const notification: AppNotification = {
      id,
      key: input.key,
      tone: input.tone,
      title: input.title,
      message: input.message,
      actionLabel: input.actionLabel,
      onAction: input.onAction,
      dismissible: input.dismissible ?? true,
      seen: input.key ? isSeenForCurrentUser(input.key, signature) : false,
      createdAt: Date.now(),
    };

    set((state) => ({
      notifications: [notification, ...state.notifications],
    }));

    return id;
  },
  upsertByKey: (key, input) => {
    const preferences = getCurrentUserNotificationPreferences();
    if (!isToneEnabled(preferences, input.tone)) {
      get().dismissByKey(key);
      return '';
    }

    const existing = get().notifications.find((item) => item.key === key);

    if (!existing) {
      return get().push({ ...input, key });
    }

    clearNotificationTimer(existing.id);

    const nextSignature = seenSignatureFor(input.tone, input.title, input.message, input.actionLabel);

    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === existing.id
          ? (() => {
              const hasContentChanged =
                item.tone !== input.tone
                || item.title !== input.title
                || item.message !== input.message
                || item.actionLabel !== input.actionLabel;

              return {
                ...item,
                tone: input.tone,
                title: input.title,
                message: input.message,
                actionLabel: input.actionLabel,
                onAction: input.onAction,
                dismissible: input.dismissible ?? item.dismissible,
                seen: hasContentChanged
                  ? (item.key ? isSeenForCurrentUser(item.key, nextSignature) : false)
                  : item.seen,
                createdAt: hasContentChanged ? Date.now() : item.createdAt,
              };
            })()
          : item,
      ),
    }));

    return existing.id;
  },
  markSeen: (id) => {
    set((state) => {
      const target = state.notifications.find((item) => item.id === id);
      if (target?.key) {
        markSeenForCurrentUser(target.key, seenSignatureFor(target.tone, target.title, target.message, target.actionLabel));
      }

      return {
        notifications: state.notifications.map((item) => (item.id === id ? { ...item, seen: true } : item)),
      };
    });
  },
  markAllSeen: () => {
    set((state) => {
      for (const item of state.notifications) {
        if (item.key) {
          markSeenForCurrentUser(item.key, seenSignatureFor(item.tone, item.title, item.message, item.actionLabel));
        }
      }

      return {
        notifications: state.notifications.map((item) => (item.seen ? item : { ...item, seen: true })),
      };
    });
  },
  dismiss: (id) => {
    clearNotificationTimer(id);
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    }));
  },
  dismissByKey: (key) => {
    const target = get().notifications.find((item) => item.key === key);
    if (!target) return;

    get().dismiss(target.id);
  },
  applyCurrentUserPreferences: () => {
    const preferences = getCurrentUserNotificationPreferences();

    set((state) => {
      const filteredNotifications = state.notifications.filter((notification) =>
        isToneEnabled(preferences, notification.tone),
      );

      for (const notification of state.notifications) {
        if (!filteredNotifications.some((item) => item.id === notification.id)) {
          clearNotificationTimer(notification.id);
        }
      }

      return {
        notifications: filteredNotifications,
      };
    });
  },
  clear: () => {
    for (const item of get().notifications) {
      clearNotificationTimer(item.id);
    }

    set({ notifications: [] });
  },
}));
