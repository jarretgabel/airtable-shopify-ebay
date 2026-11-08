import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { hasActiveRun } from '../../db/seo.js';
import { hasActiveCitationRun, runCitationCheck, startCitationRun } from '../../seo/citations.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { runAuditWithPageSpeed } from './runAudit.js';
import { logError } from '../../shared/logging.js';

function parseTask(event: APIGatewayProxyEventV2): 'audit' | 'citations' {
  try {
    const body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) as { task?: unknown } : {};
    return body.task === 'citations' ? 'citations' : 'audit';
  } catch {
    return 'audit';
  }
}

/** A full crawl outlives an API request, so the audit runs in its own function (or in-process on the local API). */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event, { anyPage: ['seo'] });
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'The SEO dashboard needs the Postgres database, which is not configured.', { service: 'seo', code: 'POSTGRES_NOT_CONFIGURED', retryable: false });
    }
    const pool = getPostgresPool();
    const task = parseTask(event);
    const functionName = process.env.SEO_AUDIT_FUNCTION_NAME?.trim();
    const dispatch = async (payload: Record<string, unknown>, local: () => Promise<unknown>) => {
      if (functionName) {
        await new LambdaClient({}).send(new InvokeCommand({ FunctionName: functionName, InvocationType: 'Event', Payload: JSON.stringify(payload) }));
      } else {
        void local().catch((error: unknown) => logError('Local SEO task failed', error));
      }
    };

    if (task === 'citations') {
      if (await hasActiveCitationRun(pool)) return jsonOk({ started: false, reason: 'A citation check is already running.' }, { origin });
      const runId = await startCitationRun(pool);
      await dispatch({ task: 'citations', runId }, () => runCitationCheck(pool, runId));
    } else {
      if (await hasActiveRun(pool)) return jsonOk({ started: false, reason: 'An audit is already running.' }, { origin });
      await dispatch({ task: 'audit' }, () => runAuditWithPageSpeed(pool));
    }
    return jsonOk({ started: true }, { origin });
  } catch (error) {
    logError('Failed to start the SEO audit', error);
    return jsonError(getStatusCode(error), toApiErrorBody('seo', error, 'SEO_AUDIT_START_FAILED'), { origin });
  }
}
