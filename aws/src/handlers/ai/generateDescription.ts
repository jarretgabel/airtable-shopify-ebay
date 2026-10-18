import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { generateDescription } from '../../providers/ai/client.js';

interface GenerateDescriptionBody {
  fields?: Record<string, unknown>;
  existingDescription?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const body = requireJsonBody<GenerateDescriptionBody>(event, 'ai', 'INVALID_AI_REQUEST_BODY');

    const fields: Record<string, string> = {};
    for (const [name, value] of Object.entries(body.fields ?? {})) {
      if (typeof value === 'string' && value.trim()) {
        fields[name] = value;
      }
    }

    if (Object.keys(fields).length === 0) {
      return jsonError(400, {
        message: 'At least one listing field is required',
        service: 'ai',
        code: 'MISSING_AI_LISTING_FIELDS',
        retryable: false,
      }, { origin });
    }

    const description = await generateDescription(
      fields,
      typeof body.existingDescription === 'string' ? body.existingDescription : '',
    );
    logInfo('Generated listing description via AI', { fieldCount: Object.keys(fields).length });
    return jsonOk({ description }, { origin });
  } catch (error) {
    logError('Failed to generate listing description via AI', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ai', error, 'AI_DESCRIPTION_FAILED'), { origin });
  }
}
