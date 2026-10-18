import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { getLambdaAiProviderHintMock } = vi.hoisted(() => ({
  getLambdaAiProviderHintMock: vi.fn<() => 'github' | 'openai' | 'none'>(() => 'none'),
}));

vi.mock('@/services/app-api/flags', async () => ({
  ...(await vi.importActual<typeof import('@/services/app-api/flags')>('@/services/app-api/flags')),
  getLambdaAiProviderHint: getLambdaAiProviderHintMock,
}));

import { generateListingDescription, generateListingKeyFeatures, generateListingTitle, getAIProvider, identifyEquipment } from '@/services/app-api/ai';

describe('app-api ai', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    vi.stubEnv('VITE_AI_PROVIDER', 'none');
    vi.stubEnv('VITE_AIRTABLE_API_KEY', '');
    getLambdaAiProviderHintMock.mockReset();
    getLambdaAiProviderHintMock.mockReturnValue('none');
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

  it('posts listing fields to the description endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ description: 'Warm and musical.' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await generateListingDescription({ Brand: 'McIntosh' }, 'old');

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/generate-description', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ fields: { Brand: 'McIntosh' }, existingDescription: 'old' }),
    }));
    expect(result).toBe('Warm and musical.');
  });

  it('requests a title from the generation endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ title: 'McIntosh MC275' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await generateListingTitle({ Brand: 'McIntosh' }, 'old');

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/generate-description', expect.objectContaining({
      body: JSON.stringify({ kind: 'title', fields: { Brand: 'McIntosh' }, existingDescription: 'old' }),
    }));
    expect(result).toBe('McIntosh MC275');
  });

  it('rejects a title response without a title instead of returning undefined', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ description: 'old api shape' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(generateListingTitle({ Brand: 'McIntosh' })).rejects.toThrow(/no title/);
  });

  it('requests key features from the generation endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ features: [{ feature: 'Tubes', value: '4 x EL84' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await generateListingKeyFeatures({ Notes: 'x' }, ['Inputs'], ['Make']);

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/generate-description', expect.objectContaining({
      body: JSON.stringify({ kind: 'features', fields: { Notes: 'x' }, existingFeatureNames: ['Inputs'], excludedFeatureNames: ['Make'] }),
    }));
    expect(result).toEqual([{ feature: 'Tubes', value: '4 x EL84' }]);
  });

  it('uses the public provider hint when configured', () => {
    getLambdaAiProviderHintMock.mockReturnValue('github');

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