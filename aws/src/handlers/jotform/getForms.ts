import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk, readIntegerQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getForms } from '../../providers/jotform/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const limit = readIntegerQueryParam(event, 'limit', {
      defaultValue: 100,
      min: 1,
      max: 100,
      service: 'jotform',
      code: 'INVALID_LIMIT',
    });
    const orderby = getOptionalQueryParam(event, 'orderby') || 'created_at';
    const direction = (getOptionalQueryParam(event, 'direction') || 'DESC').toUpperCase();

    if (direction !== 'ASC' && direction !== 'DESC') {
      return jsonError(400, {
        message: 'direction must be ASC or DESC',
        service: 'jotform',
        code: 'INVALID_DIRECTION',
        retryable: false,
      }, { origin });
    }

    const forms = await getForms({ limit, orderby, direction });
    logInfo('Fetched JotForm forms', { count: forms.length });
    return jsonOk(forms, { origin });
  } catch (error) {
    logError('Failed to fetch JotForm forms', error);
    return jsonError(getStatusCode(error), toApiErrorBody('jotform', error, 'JOTFORM_GET_FORMS_FAILED'), { origin });
  }
}