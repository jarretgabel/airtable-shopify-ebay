import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { forwardWorkflowEvent, normalizeWorkflowEvent } from '../../providers/analytics/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<unknown>(event, 'analytics', 'INVALID_ANALYTICS_EVENT');
    const workflowEvent = normalizeWorkflowEvent(body);
    await forwardWorkflowEvent(workflowEvent);
    logInfo('Workflow analytics event accepted', {
      eventName: workflowEvent.name,
      payloadKeys: Object.keys(workflowEvent.payload).length,
    });
    return jsonOk({ accepted: true });
  } catch (error) {
    logError('Failed to handle workflow analytics event', error);
    return jsonError(getStatusCode(error), toApiErrorBody('analytics', error, 'ANALYTICS_EVENT_FAILED'));
  }
}