import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { saveAssistantFeedback } from '../../db/assistantInsights.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Thumbs up/down on an assistant answer, with the question and answer so wrong answers can be reviewed. */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    const user = await requireRouteAccess(event);
    const body = requireJsonBody<{ rating?: unknown; question?: unknown; answer?: unknown; comment?: unknown; tools?: unknown }>(event, 'ai', 'INVALID_AI_REQUEST_BODY');
    if (body.rating !== 'up' && body.rating !== 'down') {
      return jsonError(400, { message: 'rating must be "up" or "down"', service: 'ai', code: 'INVALID_FEEDBACK_RATING', retryable: false }, { origin });
    }
    if (!process.env.DATABASE_URL?.trim()) return jsonOk({ saved: false }, { origin });
    const tools = Array.isArray(body.tools) ? body.tools.filter((tool): tool is string => typeof tool === 'string').slice(0, 20).map((tool) => tool.slice(0, 60)) : [];
    await saveAssistantFeedback(getPostgresPool(), {
      userId: user.userId,
      role: user.role,
      rating: body.rating,
      question: text(body.question, 1000),
      answer: text(body.answer, 2000),
      comment: text(body.comment, 500),
      tools,
    });
    return jsonOk({ saved: true }, { origin });
  } catch (error) {
    logError('Assistant feedback failed', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ai', error, 'AI_ASSISTANT_FEEDBACK_FAILED'), { origin });
  }
}
