import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ingestJotFormSubmissionWorkflow } from '../../providers/jotform/workflowIngest.js';
import { requireWebhookSecret as requireSharedWebhookSecret } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
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

// JotForm embeds the submission ID in file upload URLs when it isn't sent as an explicit field.
// Pattern: https://www.jotform.com/uploads/{user}/{formId}/{submissionId}/{filename}
function extractSubmissionIdFromUrls(obj: unknown): string | undefined {
  const json = JSON.stringify(obj);
  const match = json.match(/jotform\.com\/uploads\/[^/]+\/\d+\/(\d+)\//);
  return match?.[1];
}

// Parse named text fields out of a multipart/form-data body.
// Handles the common JotForm case where submissionID and formID are plain text parts.
function parseMultipartField(body: string, boundary: string, fieldName: string): string | undefined {
  // Normalise CRLF/LF differences that can appear in decoded bodies.
  const norm = body.replace(/\r\n/g, '\n');
  const boundaryLine = '--' + boundary;
  const parts = norm.split(boundaryLine);
  for (const part of parts) {
    const headerBodySplit = part.indexOf('\n\n');
    if (headerBodySplit === -1) continue;
    const headers = part.slice(0, headerBodySplit);
    // Match Content-Disposition name="fieldName" (case-insensitive field name)
    const nameMatch = headers.match(/content-disposition[^\n]*name="([^"]+)"/i);
    if (!nameMatch) continue;
    if (nameMatch[1].toLowerCase() !== fieldName.toLowerCase()) continue;
    // Value is everything after the blank line, trim boundary/trailing dashes.
    const value = part.slice(headerBodySplit + 2).replace(/\n--$/, '').trim();
    return value || undefined;
  }
  return undefined;
}

function parseWebhookBody(event: APIGatewayProxyEventV2): ParsedWebhookBody {
  const rawBody = decodeBody(event).trim();
  if (!rawBody) {
    return {};
  }

  const rawContentType = readHeader(event, 'content-type');
  const contentType = rawContentType.toLowerCase();

  // multipart/form-data — JotForm sends submissionID and formID as named text parts.
  // Use the raw (non-lowercased) header so the boundary value preserves its original case —
  // the delimiter in the body is case-sensitive and must match exactly.
  const boundaryMatch = rawContentType.match(/boundary=([^\s;]+)/i);
  if (boundaryMatch) {
    // Strip surrounding quotes — some HTTP clients send boundary="value" instead of boundary=value.
    const boundary = boundaryMatch[1].replace(/^"|"$/g, '');
    const submissionId = parseMultipartField(rawBody, boundary, 'submissionID')
      || parseMultipartField(rawBody, boundary, 'submissionId')
      || parseMultipartField(rawBody, boundary, 'submission_id')
      || extractSubmissionIdFromUrls(rawBody);
    const formId = parseMultipartField(rawBody, boundary, 'formID')
      || parseMultipartField(rawBody, boundary, 'formId')
      || parseMultipartField(rawBody, boundary, 'form_id');
    const token = parseMultipartField(rawBody, boundary, 'token');
    return { submissionId, formId, token };
  }

  const looksLikeJson = rawBody.startsWith('{') || rawBody.startsWith('[');
  if (contentType.includes('application/json') || looksLikeJson) {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const submissionId = (typeof parsed.submission_id === 'string' ? parsed.submission_id
      : typeof parsed.submissionId === 'string' ? parsed.submissionId
      : typeof parsed.submissionID === 'string' ? parsed.submissionID
      : undefined) || extractSubmissionIdFromUrls(parsed);
    return {
      submissionId,
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
  // JotForm URL-encoded webhooks embed file URLs inside the rawRequest JSON field —
  // use those as a fallback to extract the submission ID if the top-level field is missing.
  const submissionId = params.get('submission_id') || params.get('submissionId') || params.get('submissionID')
    || extractSubmissionIdFromUrls(rawBody) || undefined;
  return {
    submissionId,
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
      const body = parseWebhookBody(event);
      if (!body.submissionId) {
        logInfo('JotForm webhook body parse — submissionId not found', {
          contentType: event.headers?.['content-type'] ?? event.headers?.['Content-Type'] ?? '(none)',
          bodyPreview: (event.body ?? '').slice(0, 400),
        });
      }
      requireSecret(event, body);
      const formId = event.pathParameters?.formId?.trim()
        || body.formId
        || event.queryStringParameters?.formId?.trim()
        || event.queryStringParameters?.formID?.trim()
        || event.queryStringParameters?.form_id?.trim()
        || '';
      if (!formId) {
        throw new HttpError(400, 'formId is required', { service: 'jotform', code: 'MISSING_FORM_ID', retryable: false });
      }
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