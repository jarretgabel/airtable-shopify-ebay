import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken, getJson, postJson } from '@/services/app-api/http';

describe('app-api http csrf handling', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    fetchMock.mockReset();
    clearCsrfToken();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it('stores csrf tokens from successful responses and attaches them to later write requests', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'u-1', mustChangePassword: false, csrfToken: 'csrf-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

    await getJson('/api/auth/session');
    await postJson('/api/airtable/configured-records/users', { fields: { Name: 'User' } });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/session', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/airtable/configured-records/users', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-csrf-token': 'csrf-123',
      },
      body: JSON.stringify({ fields: { Name: 'User' } }),
    });
  });

  it('clears the cached csrf token when requested', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'u-1', mustChangePassword: false, csrfToken: 'csrf-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

    await getJson('/api/auth/session');
    clearCsrfToken();
    await postJson('/api/auth/logout', {});

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
  });
});