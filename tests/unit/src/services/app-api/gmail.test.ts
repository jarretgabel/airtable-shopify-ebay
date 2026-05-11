import { sendPlainTextEmail } from '@/services/app-api/gmail';

describe('app-api gmail', () => {
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

  it('calls the Lambda Gmail endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ delivered: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await sendPlainTextEmail('user@example.com', 'Hello', 'Body');

    expect(fetchMock).toHaveBeenCalledWith('/api/gmail/send', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'user@example.com', subject: 'Hello', body: 'Body' }),
    });
    expect(result).toBe(true);
  });

  it('rethrows Lambda Gmail failures as plain Errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        message: 'Failed to send Gmail message (401): invalid credentials',
        service: 'gmail',
        code: 'GMAIL_SEND_FAILED',
        retryable: false,
      }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(sendPlainTextEmail('user@example.com', 'Hello', 'Body')).rejects.toMatchObject({
      message: 'Failed to send Gmail message (401): invalid credentials',
    });
  });
});