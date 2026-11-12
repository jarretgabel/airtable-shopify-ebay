export type AppTheme = 'dark' | 'light';
export type ThemeMode = AppTheme | 'system';

const DEFAULT_THEME_MODE: ThemeMode = 'system';
// v2 stores the mode (including "system"); v1 stored only the last resolved theme, so it is ignored.
const THEME_STORAGE_KEY_PREFIX = 'ui-theme-mode:v2';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
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

export function loadThemePreference(userId?: string): ThemeMode {
  const key = getStorageKey(userId);

  if (canUseSessionStorage()) {
    const sessionValue = readStorage(window.sessionStorage, key);
    if (isThemeMode(sessionValue)) {
      return sessionValue;
    }
  }

  if (canUseLocalStorage()) {
    const localValue = readStorage(window.localStorage, key);
    if (isThemeMode(localValue)) {
      return localValue;
    }
  }

  return DEFAULT_THEME_MODE;
}

export function saveThemePreference(theme: ThemeMode, userId?: string): void {
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

export function getSystemTheme(): AppTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveTheme(mode: ThemeMode): AppTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}
