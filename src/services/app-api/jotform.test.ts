import { getForms, getFormSubmissions } from '@/services/app-api/jotform';

describe('app-api jotform', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls the Lambda JotForm forms endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: '1', title: 'Form', created_at: 'now' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getForms();

    expect(fetchMock).toHaveBeenCalledWith('/api/jotform/forms', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: '1', title: 'Form', created_at: 'now' }]);
  });

  it('calls the Lambda JotForm submissions endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'sub1', form_id: 'abc', created_at: 'now', answers: {} }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getFormSubmissions('abc', 100, 0);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/jotform/forms/abc/submissions?limit=100&offset=0&orderby=created_at&direction=DESC',
      { headers: { Accept: 'application/json' } },
    );
    expect(result).toEqual([{ id: 'sub1', form_id: 'abc', created_at: 'now', answers: {} }]);
  });

  it('rethrows Lambda JotForm failures as plain Errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        message: 'JotForm API error: HTTP 401 on /user/forms',
        service: 'jotform',
        code: 'JOTFORM_HTTP_ERROR',
        retryable: false,
      }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(getForms()).rejects.toMatchObject({
      message: 'JotForm API error: HTTP 401 on /user/forms',
    });
  });
});