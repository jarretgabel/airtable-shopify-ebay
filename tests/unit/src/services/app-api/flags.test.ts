import { afterEach, describe, expect, it, vi } from 'vitest';

describe('app-api flags', () => {
  afterEach(() => {
    delete window.__APP_RUNTIME_CONFIG__;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('warns when localhost has a remote configured app api base url', async () => {
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: 'https://example.execute-api.us-east-1.amazonaws.com',
    };

    const { getLocalAppApiRoutingWarning } = await import('@/services/app-api/flags');

    expect(getLocalAppApiRoutingWarning()).toEqual({
      configuredBaseUrl: 'https://example.execute-api.us-east-1.amazonaws.com',
    });
  });

  it('suppresses the warning when localhost is already using same-origin api routing', async () => {
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: '/api',
    };

    const { getLocalAppApiRoutingWarning } = await import('@/services/app-api/flags');

    expect(getLocalAppApiRoutingWarning()).toBeNull();
  });

  it('reports localhost diagnostics with a forced local api route and ignored remote base url', async () => {
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: 'https://example.execute-api.us-east-1.amazonaws.com',
    };

    const { getAppApiSessionDiagnostics } = await import('@/services/app-api/flags');

    expect(getAppApiSessionDiagnostics()).toEqual({
      effectiveRoute: '/api',
      configuredBaseUrl: 'https://example.execute-api.us-east-1.amazonaws.com',
      ignoredConfiguredBaseUrl: 'https://example.execute-api.us-east-1.amazonaws.com',
      localProxyHealthPath: '/api/health',
      shouldProbeLocalProxy: true,
    });
  });
});