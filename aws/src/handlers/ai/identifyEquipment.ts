import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { identifyEquipment } from '../../providers/ai/client.js';

interface IdentifyEquipmentBody {
  base64?: string;
  mimeType?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const body = requireJsonBody<IdentifyEquipmentBody>(event, 'ai', 'INVALID_AI_REQUEST_BODY');
    const base64 = body.base64?.trim();
    const mimeType = body.mimeType?.trim() || 'image/jpeg';

    if (!base64) {
      return jsonError(400, {
        message: 'base64 is required',
        service: 'ai',
        code: 'MISSING_AI_IMAGE',
        retryable: false,
      }, { origin });
    }

    const result = await identifyEquipment(base64, mimeType);
    logInfo('Identified equipment via AI', {
      brand: result.brand,
      model: result.model,
      mimeType,
    });
    return jsonOk(result, { origin });
  } catch (error) {
    logError('Failed to identify equipment via AI', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ai', error, 'AI_IDENTIFY_FAILED'), { origin });
  }
}