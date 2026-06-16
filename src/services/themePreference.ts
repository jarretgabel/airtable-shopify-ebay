export type AppTheme = 'dark' | 'light';

const DEFAULT_THEME: AppTheme = 'dark';
const THEME_STORAGE_KEY_PREFIX = 'ui-theme-preference:v1';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function isTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light';
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage write failures (private mode / blocked persistence).
  }
}

function getStorageKey(userId?: string): string {
  if (!userId) return THEME_STORAGE_KEY_PREFIX;
  return `${THEME_STORAGE_KEY_PREFIX}:${userId}`;
}

export function loadThemePreference(userId?: string): AppTheme {
  const key = getStorageKey(userId);

  if (canUseSessionStorage()) {
    const sessionValue = readStorage(window.sessionStorage, key);
    if (isTheme(sessionValue)) {
      return sessionValue;
    }
  }

  if (canUseLocalStorage()) {
    const localValue = readStorage(window.localStorage, key);
    if (isTheme(localValue)) {
      return localValue;
    }
  }

  return DEFAULT_THEME;
}

export function saveThemePreference(theme: AppTheme, userId?: string): void {
  const key = getStorageKey(userId);

  if (canUseSessionStorage()) {
    writeStorage(window.sessionStorage, key, theme);
  }

  if (canUseLocalStorage()) {
    writeStorage(window.localStorage, key, theme);
  }
}

export function applyThemeToDocument(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}
