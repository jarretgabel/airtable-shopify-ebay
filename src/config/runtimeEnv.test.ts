import { afterEach, describe, expect, it, vi } from 'vitest';

describe('runtimeEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.__APP_RUNTIME_CONFIG__;
    vi.resetModules();
  });

  it('prefers an explicit runtime-config value over bundled env values', async () => {
    vi.stubEnv('VITE_APP_API_BASE_URL', 'https://example.execute-api.us-east-1.amazonaws.com');
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: '/api',
    };

    const { checkOptionalEnv } = await import('@/config/runtimeEnv');

    expect(checkOptionalEnv('VITE_APP_API_BASE_URL')).toBe('/api');
  });

  it('treats an explicit empty runtime-config value as an override', async () => {
    vi.stubEnv('VITE_APP_API_BASE_URL', 'https://example.execute-api.us-east-1.amazonaws.com');
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: '',
    };

    const { checkOptionalEnv } = await import('@/config/runtimeEnv');

    expect(checkOptionalEnv('VITE_APP_API_BASE_URL')).toBe('');
  });

  it('falls back to bundled env when runtime config does not define the key', async () => {
    vi.stubEnv('VITE_APP_API_BASE_URL', 'https://example.execute-api.us-east-1.amazonaws.com');
    window.__APP_RUNTIME_CONFIG__ = {};

    const { checkOptionalEnv } = await import('@/config/runtimeEnv');

    expect(checkOptionalEnv('VITE_APP_API_BASE_URL')).toBe('https://example.execute-api.us-east-1.amazonaws.com');
  });
});