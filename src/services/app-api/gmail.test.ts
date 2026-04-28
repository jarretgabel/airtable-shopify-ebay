import { sendPlainTextEmail } from '@/services/app-api/gmail';
import * as gmailDirect from '@/services/gmailDirect';

vi.mock('@/services/gmailDirect', () => ({
  sendPlainTextEmailDirect: vi.fn(),
}));

describe('app-api gmail', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_USE_LAMBDA_GMAIL', 'false');
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    fetchMock.mockReset();
    vi.mocked(gmailDirect.sendPlainTextEmailDirect).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('delegates to the direct Gmail service when Lambda mode is off', async () => {
    vi.mocked(gmailDirect.sendPlainTextEmailDirect).mockResolvedValue(true);

    const result = await sendPlainTextEmail('user@example.com', 'Hello', 'Body');

    expect(gmailDirect.sendPlainTextEmailDirect).toHaveBeenCalledWith('user@example.com', 'Hello', 'Body');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('calls the Lambda Gmail endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_GMAIL', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ delivered: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await sendPlainTextEmail('user@example.com', 'Hello', 'Body');

    expect(fetchMock).toHaveBeenCalledWith('/api/gmail/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'user@example.com', subject: 'Hello', body: 'Body' }),
    });
    expect(result).toBe(true);
  });

  it('rethrows Lambda Gmail failures as plain Errors', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_GMAIL', 'true');
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