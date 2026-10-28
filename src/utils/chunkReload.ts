const RELOAD_KEY = 'chunk-reload-at';
const RELOAD_WINDOW_MS = 30_000;

const CHUNK_ERROR_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_ERROR_PATTERN.test(message);
}

// Reloads once per window so a genuinely missing asset can't cause a reload loop.
export function reloadForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function installChunkReloadHandlers(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForChunkError()) event.preventDefault();
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) reloadForChunkError();
  });
}
