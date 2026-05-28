import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ingestJotFormSubmissionWorkflow } from '../../providers/jotform/workflowIngest.js';
import { requireWebhookSecret as requireSharedWebhookSecret } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';

interface ParsedWebhookBody {
  submissionId?: string;
  formId?: string;
  token?: string;
}

function readHeader(event: APIGatewayProxyEventV2, name: string): string {
  const entries = Object.entries(event.headers || {});
  const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1]?.trim() || '';
}

function decodeBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) {
    return '';
  }

  return event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
}

function parseWebhookBody(event: APIGatewayProxyEventV2): ParsedWebhookBody {
  const rawBody = decodeBody(event).trim();
  if (!rawBody) {
    return {};
  }

  const contentType = readHeader(event, 'content-type').toLowerCase();
  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      submissionId: typeof parsed.submission_id === 'string'
        ? parsed.submission_id
        : typeof parsed.submissionId === 'string'
          ? parsed.submissionId
          : typeof parsed.submissionID === 'string'
            ? parsed.submissionID
            : undefined,
      formId: typeof parsed.form_id === 'string'
        ? parsed.form_id
        : typeof parsed.formId === 'string'
          ? parsed.formId
          : typeof parsed.formID === 'string'
            ? parsed.formID
            : undefined,
      token: typeof parsed.token === 'string' ? parsed.token : undefined,
    };
  }

  const params = new URLSearchParams(rawBody);
  return {
    submissionId: params.get('submission_id') || params.get('submissionId') || params.get('submissionID') || undefined,
    formId: params.get('form_id') || params.get('formId') || params.get('formID') || undefined,
    token: params.get('token') || undefined,
  };
}

function requireWebhookSecret(event: APIGatewayProxyEventV2, body: ParsedWebhookBody): void {
  const provided = readHeader(event, 'x-jotform-webhook-secret')
    || readHeader(event, 'x-webhook-secret')
    || event.queryStringParameters?.token?.trim()
    || body.token
    || '';

  requireSharedWebhookSecret(provided, 'JOTFORM_WEBHOOK_SECRET', 'jotform', 'JOTFORM_WEBHOOK_FORBIDDEN');
}

function requireSubmissionId(body: ParsedWebhookBody): string {
  const submissionId = body.submissionId?.trim();
  if (!submissionId) {
    throw new HttpError(400, 'submissionId is required', {
      service: 'jotform',
      code: 'MISSING_SUBMISSION_ID',
      retryable: false,
    });
  }

  return submissionId;
}

interface IngestSubmissionWebhookDependencies {
  ingestJotFormSubmissionWorkflow?: typeof ingestJotFormSubmissionWorkflow;
  requireWebhookSecret?: typeof requireWebhookSecret;
}

export function createHandler(dependencies: IngestSubmissionWebhookDependencies = {}) {
  const ingestWorkflow = dependencies.ingestJotFormSubmissionWorkflow ?? ingestJotFormSubmissionWorkflow;
  const requireSecret = dependencies.requireWebhookSecret ?? requireWebhookSecret;

  return async function ingestSubmissionWebhookHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      const formId = requirePathParam(event, 'formId', 'jotform', 'MISSING_FORM_ID');
      const body = parseWebhookBody(event);
      requireSecret(event, body);
      const submissionId = requireSubmissionId(body);
      const result = await ingestWorkflow(formId, submissionId);
      logInfo('Ingested JotForm submission into workflow', {
        formId,
        submissionId,
        itemCount: result.items.length,
      });
      return jsonOk(result, { origin });
    } catch (error) {
      logError('Failed to ingest JotForm submission webhook', error, {
        formId: event.pathParameters?.formId || '',
      });
      return jsonError(getStatusCode(error), toApiErrorBody('jotform', error, 'JOTFORM_INGEST_SUBMISSION_FAILED'), { origin });
    }
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  return createHandler()(event);
}