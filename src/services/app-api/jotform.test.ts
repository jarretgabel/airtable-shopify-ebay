import { getForms, getFormSubmissions } from '@/services/app-api/jotform';
import * as jotformService from '@/services/jotform';

vi.mock('@/services/jotform', () => ({
  getForms: vi.fn(),
  getFormSubmissions: vi.fn(),
}));

describe('app-api jotform', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_USE_LAMBDA_JOTFORM', 'false');
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    fetchMock.mockReset();
    vi.mocked(jotformService.getForms).mockReset();
    vi.mocked(jotformService.getFormSubmissions).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('delegates to the direct JotForm service when Lambda mode is off', async () => {
    vi.mocked(jotformService.getForms).mockResolvedValue([{ id: '1', title: 'Form', created_at: 'now' } as never]);

    const result = await getForms();

    expect(jotformService.getForms).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: '1', title: 'Form', created_at: 'now' }]);
  });

  it('calls the Lambda JotForm submissions endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_JOTFORM', 'true');
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
    vi.stubEnv('VITE_USE_LAMBDA_JOTFORM', 'true');
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