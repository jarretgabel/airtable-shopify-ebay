import { getAIProvider, identifyEquipment } from '@/services/app-api/ai';

describe('app-api ai', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    vi.stubEnv('VITE_AI_PROVIDER', 'none');
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls the Lambda AI endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ brand: 'Naim', model: 'NAP 250 DR' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await identifyEquipment('encoded', 'image/jpeg');

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/identify-equipment', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64: 'encoded', mimeType: 'image/jpeg' }),
    });
    expect(result).toEqual({ brand: 'Naim', model: 'NAP 250 DR' });
  });

  it('uses the public provider hint when configured', () => {
    vi.stubEnv('VITE_AI_PROVIDER', 'github');

    expect(getAIProvider()).toEqual({ provider: 'github', key: '' });
  });

  it('reports backend AI when no public provider hint is configured', () => {
    expect(getAIProvider()).toEqual({ provider: 'backend', key: '' });
  });

  it('rethrows Lambda AI failures as plain Errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        message: 'OpenAI API error 401: invalid_api_key',
        service: 'ai',
        code: 'AI_PROVIDER_ERROR',
        retryable: false,
      }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(identifyEquipment('encoded')).rejects.toMatchObject({
      message: 'OpenAI API error 401: invalid_api_key',
    });
  });
});