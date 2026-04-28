import { sendPlainTextEmailDirect } from '@/services/gmailDirect';
import { isAppApiHttpError } from './errors';
import { isLambdaGmailEnabled } from './flags';
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
  if (!isLambdaGmailEnabled()) {
    return sendPlainTextEmailDirect(to, subject, body);
  }

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