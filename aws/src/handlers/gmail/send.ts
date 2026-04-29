import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { sendPlainTextEmail } from '../../providers/gmail/client.js';

interface GmailSendBody {
  to?: string;
  subject?: string;
  body?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const request = requireJsonBody<GmailSendBody>(event, 'gmail', 'INVALID_GMAIL_REQUEST_BODY');
    const to = request.to?.trim();
    const subject = request.subject?.trim();
    const body = request.body ?? '';

    if (!to) {
      return jsonError(400, {
        message: 'to is required',
        service: 'gmail',
        code: 'MISSING_GMAIL_TO',
        retryable: false,
      }, { origin });
    }

    if (!subject) {
      return jsonError(400, {
        message: 'subject is required',
        service: 'gmail',
        code: 'MISSING_GMAIL_SUBJECT',
        retryable: false,
      }, { origin });
    }

    await sendPlainTextEmail(to, subject, body);
    logInfo('Sent Gmail message', { to, subjectLength: subject.length, bodyLength: body.length });
    return jsonOk({ delivered: true }, { origin });
  } catch (error) {
    logError('Failed to send Gmail message', error);
    return jsonError(getStatusCode(error), toApiErrorBody('gmail', error, 'GMAIL_SEND_FAILED'), { origin });
  }
}