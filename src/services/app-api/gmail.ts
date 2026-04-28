import { isAppApiHttpError } from './errors';
import { postJson } from './http';

interface GmailSendResponse {
  delivered: boolean;
}

function toGmailError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function sendPlainTextEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    const response = await postJson<GmailSendResponse>('/api/gmail/send', {
      to,
      subject,
      body,
    });
    return response.delivered;
  } catch (error) {
    throw toGmailError(error);
  }
}