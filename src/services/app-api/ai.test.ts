import { getAIProvider, identifyEquipment } from '@/services/app-api/ai';
import * as aiDirect from '@/services/aiDirect';

vi.mock('@/services/aiDirect', () => ({
  getDirectAIProvider: vi.fn(),
  identifyEquipmentDirect: vi.fn(),
}));

describe('app-api ai', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_USE_LAMBDA_AI', 'false');
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    vi.stubEnv('VITE_AI_PROVIDER', 'none');
    fetchMock.mockReset();
    vi.mocked(aiDirect.identifyEquipmentDirect).mockReset();
    vi.mocked(aiDirect.getDirectAIProvider).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('delegates to the direct AI service when Lambda mode is off', async () => {
    vi.mocked(aiDirect.identifyEquipmentDirect).mockResolvedValue({ brand: 'McIntosh', model: 'MA8900' } as never);

    const result = await identifyEquipment('base64-image', 'image/png');

    expect(aiDirect.identifyEquipmentDirect).toHaveBeenCalledWith('base64-image', 'image/png');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ brand: 'McIntosh', model: 'MA8900' });
  });

  it('calls the Lambda AI endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AI', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ brand: 'Naim', model: 'NAP 250 DR' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await identifyEquipment('encoded', 'image/jpeg');

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/identify-equipment', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64: 'encoded', mimeType: 'image/jpeg' }),
    });
    expect(result).toEqual({ brand: 'Naim', model: 'NAP 250 DR' });
  });

  it('uses the public provider hint in Lambda mode', () => {
    vi.stubEnv('VITE_USE_LAMBDA_AI', 'true');
    vi.stubEnv('VITE_AI_PROVIDER', 'github');

    expect(getAIProvider()).toEqual({ provider: 'github', key: '' });
  });

  it('rethrows Lambda AI failures as plain Errors', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AI', 'true');
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