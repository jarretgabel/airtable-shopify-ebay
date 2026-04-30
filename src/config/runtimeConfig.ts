export interface PublicRuntimeConfig {
  VITE_AIRTABLE_TABLE_NAME?: string;
  VITE_AIRTABLE_VIEW_ID?: string;
  VITE_AI_PROVIDER?: 'github' | 'openai' | 'none';
  VITE_AIRTABLE_USERS_TABLE_REF?: string;
  VITE_AIRTABLE_USERS_TABLE_NAME?: string;
  VITE_AIRTABLE_APPROVAL_TABLE_REF?: string;
  VITE_AIRTABLE_APPROVAL_TABLE_NAME?: string;
  VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF?: string;
  VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME?: string;
  VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF?: string;
  VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME?: string;
  VITE_APP_API_BASE_URL?: string;
  VITE_SHOPIFY_STORE_DOMAIN?: string;
  VITE_JOTFORM_FORM_ID?: string;
  VITE_EBAY_AUTH_HOST?: string;
  VITE_EBAY_OAUTH_SCOPES?: string;
  VITE_EBAY_APP_SCOPE?: string;
  VITE_ANALYTICS_ENABLED?: string;
}

declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: Partial<PublicRuntimeConfig>;
  }
}

export interface RuntimeConfigLoadState {
  status: 'idle' | 'loaded' | 'missing-file' | 'http-error' | 'fetch-failed' | 'invalid-format';
  message: string;
}

let runtimeConfigLoadState: RuntimeConfigLoadState = {
  status: 'idle',
  message: 'Runtime config has not been loaded yet.',
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function loadRuntimeConfig(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const response = await fetch('/runtime-config.json', { cache: 'no-store' });
    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(`[runtime-config] Failed to load /runtime-config.json (${response.status}). Falling back to bundled config.`);
      }
      runtimeConfigLoadState = response.status === 404
        ? {
          status: 'missing-file',
          message: 'No public runtime-config.json file was found. The app is using bundled values only.',
        }
        : {
          status: 'http-error',
          message: `runtime-config.json returned HTTP ${response.status}. The app is using bundled values only.`,
        };
      window.__APP_RUNTIME_CONFIG__ = {};
      return;
    }

    const parsed = await response.json();
    if (!isObject(parsed)) {
      runtimeConfigLoadState = {
        status: 'invalid-format',
        message: 'runtime-config.json loaded but did not contain an object payload. The app is using bundled values only.',
      };
      window.__APP_RUNTIME_CONFIG__ = {};
      return;
    }

    runtimeConfigLoadState = {
      status: 'loaded',
      message: 'Loaded browser-safe settings from runtime-config.json.',
    };
    window.__APP_RUNTIME_CONFIG__ = parsed as Partial<PublicRuntimeConfig>;
  } catch (error) {
    console.warn('[runtime-config] Failed to load /runtime-config.json. Falling back to bundled config.', error);
    runtimeConfigLoadState = {
      status: 'fetch-failed',
      message: 'runtime-config.json could not be fetched. The app is using bundled values only.',
    };
    window.__APP_RUNTIME_CONFIG__ = {};
  }
}

export function getRuntimeConfigLoadState(): RuntimeConfigLoadState {
  return runtimeConfigLoadState;
}

export function readRuntimeConfigValue(name: keyof PublicRuntimeConfig): string {
  if (typeof window === 'undefined') return '';

  const value = window.__APP_RUNTIME_CONFIG__?.[name];
  return typeof value === 'string' ? value.trim() : '';
}