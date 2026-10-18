import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { generateDescription, generateKeyFeatures, generateTitle } from '../../providers/ai/client.js';

interface GenerateDescriptionBody {
  fields?: Record<string, unknown>;
  existingDescription?: string;
  kind?: 'description' | 'title' | 'features';
  existingFeatureNames?: unknown;
  excludedFeatureNames?: unknown;
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 60)
    : [];
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

    const existing = typeof body.existingDescription === 'string' ? body.existingDescription : '';

    if (body.kind === 'features') {
      const features = await generateKeyFeatures(
        fields,
        toStringList(body.existingFeatureNames),
        toStringList(body.excludedFeatureNames),
      );
      logInfo('Generated listing key features via AI', { count: features.length });
      return jsonOk({ features }, { origin });
    }

    if (body.kind === 'title') {
      const title = await generateTitle(fields, existing);
      logInfo('Generated listing title via AI', { fieldCount: Object.keys(fields).length });
      return jsonOk({ title }, { origin });
    }

    const description = await generateDescription(fields, existing);
    logInfo('Generated listing description via AI', { fieldCount: Object.keys(fields).length });
    return jsonOk({ description }, { origin });
  } catch (error) {
    logError('Failed to generate listing description via AI', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ai', error, 'AI_DESCRIPTION_FAILED'), { origin });
  }
}
