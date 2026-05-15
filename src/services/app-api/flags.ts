import { checkOptionalEnv } from '@/config/runtimeEnv';

const AI_PROVIDER_HINTS = new Set(['github', 'openai', 'none']);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

export interface AppApiSessionDiagnostics {
  effectiveRoute: string;
  configuredBaseUrl: string | null;
  ignoredConfiguredBaseUrl: string | null;
  localProxyHealthPath: string | null;
  shouldProbeLocalProxy: boolean;
}

export function getLambdaAiProviderHint(): 'github' | 'openai' | 'none' {
  const value = checkOptionalEnv('VITE_AI_PROVIDER').toLowerCase();
  if (AI_PROVIDER_HINTS.has(value)) {
    return value as 'github' | 'openai' | 'none';
  }

  return 'none';
}

export function getConfiguredAppApiBaseUrl(): string {
  return checkOptionalEnv('VITE_APP_API_BASE_URL');
}

export function isLocalBrowserSession(): boolean {
  if (typeof window === 'undefined') return false;
  return LOCAL_HOSTNAMES.has(window.location.hostname.toLowerCase());
}

export function getLocalAppApiRoutingWarning(): { configuredBaseUrl: string } | null {
  if (!isLocalBrowserSession()) return null;

  const configuredBaseUrl = getConfiguredAppApiBaseUrl().trim();
  if (!configuredBaseUrl) return null;
  if (configuredBaseUrl === '/api') return null;
  if (!/^(https?:)?\/\//i.test(configuredBaseUrl)) return null;

  return { configuredBaseUrl };
}

export function getAppApiSessionDiagnostics(): AppApiSessionDiagnostics {
  const configuredBaseUrl = getConfiguredAppApiBaseUrl().trim();
  const localRoutingWarning = getLocalAppApiRoutingWarning();

  if (isLocalBrowserSession()) {
    return {
      effectiveRoute: '/api',
      configuredBaseUrl: configuredBaseUrl || null,
      ignoredConfiguredBaseUrl: localRoutingWarning?.configuredBaseUrl ?? null,
      localProxyHealthPath: '/api/health',
      shouldProbeLocalProxy: true,
    };
  }

  return {
    effectiveRoute: configuredBaseUrl || '/api',
    configuredBaseUrl: configuredBaseUrl || null,
    ignoredConfiguredBaseUrl: null,
    localProxyHealthPath: null,
    shouldProbeLocalProxy: false,
  };
}

export function getAppApiBaseUrl(): string {
  if (isLocalBrowserSession()) {
    return '';
  }

  return getConfiguredAppApiBaseUrl();
}