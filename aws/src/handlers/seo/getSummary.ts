import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { getSeoSummary } from '../../db/seo.js';
import { parseSeoSite, SEO_SITES } from '../../seo/sites.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';


export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    const site = parseSeoSite(getOptionalQueryParam(event, 'site'));
    await requireRouteAccess(event, { anyPage: [SEO_SITES[site].page] });
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'The SEO dashboard needs the Postgres database, which is not configured.', { service: 'seo', code: 'POSTGRES_NOT_CONFIGURED', retryable: false });
    }
    return jsonOk(await getSeoSummary(getPostgresPool(), { pageType: getOptionalQueryParam(event, 'type'), site }), { origin });
  } catch (error) {
    logError('Failed to load the SEO summary', error);
    return jsonError(getStatusCode(error), toApiErrorBody('seo', error, 'SEO_SUMMARY_FAILED'), { origin });
  }
}
