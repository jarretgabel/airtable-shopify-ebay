import { HttpError } from '../../shared/errors.js';
import { getOptionalSecret } from '../../shared/secrets.js';

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function sendPlainTextEmail(to: string, subject: string, body: string): Promise<boolean> {
  const token = getOptionalSecret('GOOGLE_GMAIL_ACCESS_TOKEN');
  if (!token) {
    throw new HttpError(500, 'Missing Gmail access token', {
      service: 'gmail',
      code: 'GMAIL_NOT_CONFIGURED',
      retryable: false,
    });
  }

  const fromEmail = getOptionalSecret('GOOGLE_GMAIL_FROM_EMAIL');
  const mime = [
    ...(fromEmail ? [`From: ${fromEmail}`] : []),
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(response.status, `Failed to send Gmail message (${response.status}): ${detail}`, {
      service: 'gmail',
      code: 'GMAIL_SEND_FAILED',
      retryable: response.status >= 500,
    });
  }

  return true;
}