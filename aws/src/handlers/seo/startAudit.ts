import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import type { Queryable } from '../../db/sellersSummary.js';
import { finishRun, hasActiveRun, startRun } from '../../db/seo.js';
import { hasActiveCitationRun, runCitationCheck, startCitationRun } from '../../seo/citations.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { runAuditWithPageSpeed } from './runAudit.js';
import { DEFAULT_SEO_SITE, parseSeoSite, SEO_SITES, type SeoSiteId } from '../../seo/sites.js';
import { logError } from '../../shared/logging.js';

type Dispatch = (payload: Record<string, unknown>, local: () => Promise<unknown>) => Promise<void>;

/** Creates the run row before dispatching so the dashboard sees a running audit on its first poll. Returns false when one is already running. */
export async function startAuditRun(pool: Queryable, dispatch: Dispatch, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<boolean> {
  if (await hasActiveRun(pool, site)) return false;
  const runId = await startRun(pool, site);
  try {
    await dispatch({ task: 'audit', runId, site }, () => runAuditWithPageSpeed(pool, runId, site));
  } catch (error) {
    await finishRun(pool, runId, { status: 'failed', siteChecks: [], error: 'Audit could not be dispatched' }).catch(() => undefined);
    throw error;
  }
  return true;
}

function parseBody(event: APIGatewayProxyEventV2): { task: 'audit' | 'citations'; site: SeoSiteId } {
  try {
    const body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) as { task?: unknown; site?: unknown } : {};
    return { task: body.task === 'citations' ? 'citations' : 'audit', site: parseSeoSite(body.site) };
  } catch {
    return { task: 'audit', site: DEFAULT_SEO_SITE };
  }
}

/** A full crawl outlives an API request, so the audit runs in its own function (or in-process on the local API). */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    const { task, site } = parseBody(event);
    await requireRouteAccess(event, { anyPage: [SEO_SITES[site].page] });
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'The SEO dashboard needs the Postgres database, which is not configured.', { service: 'seo', code: 'POSTGRES_NOT_CONFIGURED', retryable: false });
    }
    const pool = getPostgresPool();
    const functionName = process.env.SEO_AUDIT_FUNCTION_NAME?.trim();
    const dispatch: Dispatch = async (payload, local) => {
      if (functionName) {
        await new LambdaClient({}).send(new InvokeCommand({ FunctionName: functionName, InvocationType: 'Event', Payload: JSON.stringify(payload) }));
      } else {
        void local().catch((error: unknown) => logError('Local SEO task failed', error));
      }
    };

    if (task === 'citations') {
      if (await hasActiveCitationRun(pool, site)) return jsonOk({ started: false, reason: 'A citation check is already running.' }, { origin });
      const runId = await startCitationRun(pool, site);
      await dispatch({ task: 'citations', runId, site }, () => runCitationCheck(pool, runId, { site }));
    } else {
      if (!await startAuditRun(pool, dispatch, site)) return jsonOk({ started: false, reason: 'An audit is already running.' }, { origin });
    }
    return jsonOk({ started: true }, { origin });
  } catch (error) {
    logError('Failed to start the SEO audit', error);
    return jsonError(getStatusCode(error), toApiErrorBody('seo', error, 'SEO_AUDIT_START_FAILED'), { origin });
  }
}
