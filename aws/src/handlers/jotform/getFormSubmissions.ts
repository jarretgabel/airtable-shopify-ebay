import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import {
  getOptionalQueryParam,
  getRequestOrigin,
  jsonError,
  jsonOk,
  readIntegerQueryParam,
  requirePathParam,
} from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getFormSubmissions } from '../../providers/jotform/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const formId = requirePathParam(event, 'formId', 'jotform', 'MISSING_FORM_ID');
    const limit = readIntegerQueryParam(event, 'limit', {
      defaultValue: 100,
      min: 1,
      max: 100,
      service: 'jotform',
      code: 'INVALID_LIMIT',
    });
    const offset = readIntegerQueryParam(event, 'offset', {
      defaultValue: 0,
      min: 0,
      max: 10000,
      service: 'jotform',
      code: 'INVALID_OFFSET',
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

    const submissions = await getFormSubmissions(formId, { limit, offset, orderby, direction });
    logInfo('Fetched JotForm submissions', { formId, count: submissions.length, offset, limit });
    return jsonOk(submissions, { origin });
  } catch (error) {
    logError('Failed to fetch JotForm submissions', error, { formId: event.pathParameters?.formId || '' });
    return jsonError(getStatusCode(error), toApiErrorBody('jotform', error, 'JOTFORM_GET_FORM_SUBMISSIONS_FAILED'), { origin });
  }
}