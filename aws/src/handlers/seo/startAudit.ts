import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { hasActiveRun } from '../../db/seo.js';
import { runSeoAudit } from '../../seo/crawl.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';
import { SEO_ROLES } from './getSummary.js';

/** A full crawl outlives an API request, so the audit runs in its own function (or in-process on the local API). */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event, { roles: SEO_ROLES });
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'The SEO dashboard needs the Postgres database, which is not configured.', { service: 'seo', code: 'POSTGRES_NOT_CONFIGURED', retryable: false });
    }
    const pool = getPostgresPool();
    if (await hasActiveRun(pool)) return jsonOk({ started: false, reason: 'An audit is already running.' }, { origin });

    const functionName = process.env.SEO_AUDIT_FUNCTION_NAME?.trim();
    if (functionName) {
      await new LambdaClient({}).send(new InvokeCommand({ FunctionName: functionName, InvocationType: 'Event' }));
    } else {
      void runSeoAudit(pool).catch((error: unknown) => logError('Local SEO audit failed', error));
    }
    return jsonOk({ started: true }, { origin });
  } catch (error) {
    logError('Failed to start the SEO audit', error);
    return jsonError(getStatusCode(error), toApiErrorBody('seo', error, 'SEO_AUDIT_START_FAILED'), { origin });
  }
}
