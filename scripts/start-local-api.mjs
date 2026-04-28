import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const cwd = process.cwd();
const awsDir = path.join(cwd, 'aws');
const defaultPort = Number(process.env.LOCAL_API_PORT || '3001');

const ROUTES = [
  ['POST', '/api/auth/login', 'handlers/auth/login.js', 'handler'],
  ['GET', '/api/auth/session', 'handlers/auth/resolveSession.js', 'handler'],
  ['POST', '/api/auth/password-reset/request', 'handlers/auth/requestPasswordReset.js', 'handler'],
  ['POST', '/api/auth/password-reset/confirm', 'handlers/auth/resetPassword.js', 'handler'],
  ['POST', '/api/auth/email-change/request', 'handlers/auth/requestEmailChange.js', 'handler'],
  ['POST', '/api/auth/email-change/confirm', 'handlers/auth/confirmEmailChange.js', 'handler'],
  ['POST', '/api/auth/password/change', 'handlers/auth/updatePassword.js', 'handler'],
  ['POST', '/api/auth/logout', 'handlers/auth/logout.js', 'handler'],
  ['GET', '/api/ebay/inventory-items', 'handlers/ebay/getInventoryItems.js', 'handler'],
  ['GET', '/api/ebay/offers', 'handlers/ebay/getOffers.js', 'handler'],
  ['GET', '/api/ebay/offers/{offerId}', 'handlers/ebay/getOffer.js', 'handler'],
  ['POST', '/api/ebay/offers/by-skus', 'handlers/ebay/getOffersForInventorySkus.js', 'handler'],
  ['GET', '/api/ebay/taxonomy/suggestions', 'handlers/ebay/searchCategorySuggestions.js', 'handler'],
  ['GET', '/api/ebay/taxonomy/root-categories', 'handlers/ebay/getRootCategories.js', 'handler'],
  ['GET', '/api/ebay/taxonomy/child-categories', 'handlers/ebay/getChildCategories.js', 'handler'],
  ['GET', '/api/ebay/package-types', 'handlers/ebay/getPackageTypes.js', 'handler'],
  ['GET', '/api/ebay/runtime-config', 'handlers/ebay/getRuntimeConfig.js', 'handler'],
  ['GET', '/api/ebay/dashboard-snapshot', 'handlers/ebay/getDashboardSnapshot.js', 'handler'],
  ['POST', '/api/ebay/sample-listings', 'handlers/ebay/createSampleListing.js', 'handler'],
  ['POST', '/api/ebay/sample-listings/publish', 'handlers/ebay/publishSampleDraftListing.js', 'handler'],
  ['POST', '/api/ebay/approval-listings/publish', 'handlers/ebay/pushApprovalBundle.js', 'handler'],
  ['POST', '/api/ebay/images', 'handlers/ebay/uploadImage.js', 'handler'],
  ['GET', '/api/shopify/products', 'handlers/shopify/getProducts.js', 'handler'],
  ['GET', '/api/shopify/products/{productId}', 'handlers/shopify/getProduct.js', 'handler'],
  ['GET', '/api/shopify/collections', 'handlers/shopify/getCollections.js', 'handler'],
  ['GET', '/api/shopify/collections/search', 'handlers/shopify/searchCollections.js', 'handler'],
  ['GET', '/api/shopify/taxonomy-categories/search', 'handlers/shopify/searchTaxonomyCategories.js', 'handler'],
  ['GET', '/api/shopify/taxonomy-categories/resolve', 'handlers/shopify/resolveTaxonomyCategory.js', 'handler'],
  ['POST', '/api/shopify/product-set', 'handlers/shopify/upsertProduct.js', 'handler'],
  ['POST', '/api/shopify/product-set-with-collections', 'handlers/shopify/upsertProductWithCollections.js', 'handler'],
  ['POST', '/api/shopify/products/{productId}/collections', 'handlers/shopify/addProductToCollections.js', 'handler'],
  ['POST', '/api/shopify/products/{productId}/category', 'handlers/shopify/updateProductCategory.js', 'handler'],
  ['POST', '/api/shopify/images', 'handlers/shopify/uploadImage.js', 'handler'],
  ['GET', '/api/jotform/forms', 'handlers/jotform/getForms.js', 'handler'],
  ['GET', '/api/jotform/forms/{formId}/submissions', 'handlers/jotform/getFormSubmissions.js', 'handler'],
  ['GET', '/api/airtable/listings', 'handlers/airtable/getListings.js', 'handler'],
  ['GET', '/api/airtable/configured-records', 'handlers/airtable/getConfiguredRecords.js', 'handler'],
  ['GET', '/api/airtable/configured-metadata', 'handlers/airtable/getConfiguredMetadata.js', 'handler'],
  ['POST', '/api/airtable/configured-records/{source}', 'handlers/airtable/upsertConfiguredRecord.js', 'createHandler'],
  ['PATCH', '/api/airtable/configured-records/{source}/{recordId}', 'handlers/airtable/upsertConfiguredRecord.js', 'updateHandler'],
  ['DELETE', '/api/airtable/configured-records/{source}/{recordId}', 'handlers/airtable/deleteConfiguredRecord.js', 'handler'],
  ['POST', '/api/airtable/configured-attachments/{source}/{recordId}/{fieldId}', 'handlers/airtable/uploadConfiguredAttachment.js', 'handler'],
  ['POST', '/api/ai/identify-equipment', 'handlers/ai/identifyEquipment.js', 'handler'],
  ['POST', '/api/gmail/send', 'handlers/gmail/send.js', 'handler'],
  ['POST', '/api/analytics/events', 'handlers/analytics/postEvent.js', 'handler'],
  ['GET', '/api/hifishark/model/{slug}', 'handlers/hifishark/getModel.js', 'handler'],
].map(([method, routePath, modulePath, exportName]) => ({
  method,
  routePath,
  modulePath,
  exportName,
  ...compileRoute(routePath),
}));

function compileRoute(routePath) {
  const pathParamNames = [];
  const pattern = routePath.replace(/\{([^}]+)\}/g, (_, name) => {
    pathParamNames.push(name);
    return '([^/]+)';
  });

  return {
    pathParamNames,
    routeRegex: new RegExp(`^${pattern}$`),
  };
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function getMergedEnv() {
  return {
    ...readEnvFile(path.join(cwd, '.env')),
    ...readEnvFile(path.join(cwd, '.env.local')),
    ...process.env,
  };
}

function requireEnv(mergedEnv, name) {
  const value = mergedEnv[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(mergedEnv, name) {
  const value = mergedEnv[name]?.trim();
  return value || '';
}

function setAwsEnv() {
  const mergedEnv = getMergedEnv();

  process.env.JOTFORM_API_KEY = requireEnv(mergedEnv, 'VITE_JOTFORM_API_KEY');
  process.env.AIRTABLE_API_KEY = requireEnv(mergedEnv, 'VITE_AIRTABLE_API_KEY');
  process.env.AIRTABLE_BASE_ID = requireEnv(mergedEnv, 'VITE_AIRTABLE_BASE_ID');
  process.env.ALLOWED_AIRTABLE_TABLE_NAME = requireEnv(mergedEnv, 'VITE_AIRTABLE_TABLE_NAME');
  process.env.AIRTABLE_USERS_TABLE_REF = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_USERS_TABLE_REF');
  process.env.AIRTABLE_USERS_TABLE_NAME = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_USERS_TABLE_NAME');
  process.env.AIRTABLE_APPROVAL_TABLE_REF = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_APPROVAL_TABLE_REF');
  process.env.AIRTABLE_APPROVAL_TABLE_NAME = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_APPROVAL_TABLE_NAME');
  process.env.AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF');
  process.env.AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME');
  process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF');
  process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME');

  process.env.SHOPIFY_STORE_DOMAIN = requireEnv(mergedEnv, 'VITE_SHOPIFY_STORE_DOMAIN');
  process.env.SHOPIFY_OAUTH_ACCESS_TOKEN = getOptionalEnv(mergedEnv, 'VITE_SHOPIFY_OAUTH_ACCESS_TOKEN');
  process.env.SHOPIFY_ADMIN_API_TOKEN = getOptionalEnv(mergedEnv, 'VITE_SHOPIFY_ADMIN_API_TOKEN');
  process.env.SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_OAUTH_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
  process.env.SHOPIFY_LOCATION_ID = getOptionalEnv(mergedEnv, 'VITE_SHOPIFY_LOCATION_ID');

  process.env.EBAY_ENV = getOptionalEnv(mergedEnv, 'VITE_EBAY_ENV');
  process.env.EBAY_CLIENT_ID = getOptionalEnv(mergedEnv, 'VITE_EBAY_CLIENT_ID');
  process.env.EBAY_CLIENT_SECRET = getOptionalEnv(mergedEnv, 'VITE_EBAY_CLIENT_SECRET');
  process.env.EBAY_REFRESH_TOKEN = getOptionalEnv(mergedEnv, 'VITE_EBAY_REFRESH_TOKEN');
  process.env.EBAY_AUTH_HOST = getOptionalEnv(mergedEnv, 'VITE_EBAY_AUTH_HOST');
  process.env.EBAY_APP_SCOPE = getOptionalEnv(mergedEnv, 'VITE_EBAY_APP_SCOPE');
  process.env.EBAY_LOCATION_KEY = getOptionalEnv(mergedEnv, 'VITE_EBAY_LOCATION_KEY');
  process.env.EBAY_LOCATION_NAME = getOptionalEnv(mergedEnv, 'VITE_EBAY_LOCATION_NAME');
  process.env.EBAY_LOCATION_COUNTRY = getOptionalEnv(mergedEnv, 'VITE_EBAY_LOCATION_COUNTRY');
  process.env.EBAY_LOCATION_POSTAL_CODE = getOptionalEnv(mergedEnv, 'VITE_EBAY_LOCATION_POSTAL_CODE');
  process.env.EBAY_LOCATION_CITY = getOptionalEnv(mergedEnv, 'VITE_EBAY_LOCATION_CITY');
  process.env.EBAY_LOCATION_STATE = getOptionalEnv(mergedEnv, 'VITE_EBAY_LOCATION_STATE');
  process.env.EBAY_FULFILLMENT_POLICY_ID = getOptionalEnv(mergedEnv, 'VITE_EBAY_FULFILLMENT_POLICY_ID');
  process.env.EBAY_PAYMENT_POLICY_ID = getOptionalEnv(mergedEnv, 'VITE_EBAY_PAYMENT_POLICY_ID');
  process.env.EBAY_RETURN_POLICY_ID = getOptionalEnv(mergedEnv, 'VITE_EBAY_RETURN_POLICY_ID');
  process.env.EBAY_LISTING_API = getOptionalEnv(mergedEnv, 'VITE_EBAY_LISTING_API');

  process.env.GOOGLE_GMAIL_ACCESS_TOKEN = getOptionalEnv(mergedEnv, 'VITE_GOOGLE_GMAIL_ACCESS_TOKEN');
  process.env.GOOGLE_GMAIL_FROM_EMAIL = getOptionalEnv(mergedEnv, 'VITE_GOOGLE_GMAIL_FROM_EMAIL');
  process.env.APP_AUTH_TOKEN_SECRET =
    getOptionalEnv(mergedEnv, 'APP_AUTH_TOKEN_SECRET')
    || getOptionalEnv(mergedEnv, 'VITE_APP_AUTH_TOKEN_SECRET')
    || 'local-dev-auth-secret';

  process.env.OPENAI_API_KEY = getOptionalEnv(mergedEnv, 'VITE_OPENAI_API_KEY');
  process.env.OPENAI_MODEL = getOptionalEnv(mergedEnv, 'VITE_OPENAI_MODEL');
  process.env.GITHUB_TOKEN = getOptionalEnv(mergedEnv, 'VITE_GITHUB_TOKEN');
  process.env.AI_PROVIDER = getOptionalEnv(mergedEnv, 'VITE_AI_PROVIDER');
  process.env.ANALYTICS_FORWARD_ENDPOINT = getOptionalEnv(mergedEnv, 'ANALYTICS_FORWARD_ENDPOINT') || getOptionalEnv(mergedEnv, 'VITE_ANALYTICS_ENDPOINT');
  process.env.APP_AUTH_COOKIE_SECURE_MODE = getOptionalEnv(mergedEnv, 'APP_AUTH_COOKIE_SECURE_MODE') || 'never';
  process.env.APP_AUTH_COOKIE_SAME_SITE = getOptionalEnv(mergedEnv, 'APP_AUTH_COOKIE_SAME_SITE') || 'Lax';
  process.env.APP_AUTH_COOKIE_DOMAIN = getOptionalEnv(mergedEnv, 'APP_AUTH_COOKIE_DOMAIN');

  const viewId = getOptionalEnv(mergedEnv, 'VITE_AIRTABLE_VIEW_ID');
  if (viewId) {
    process.env.ALLOWED_AIRTABLE_VIEW_ID = viewId;
  } else {
    delete process.env.ALLOWED_AIRTABLE_VIEW_ID;
  }
}

function buildAwsDist() {
  execFileSync('npm', ['run', 'typecheck'], { cwd: awsDir, stdio: 'inherit' });
  execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd: awsDir, stdio: 'inherit' });
}

async function loadHandlers() {
  const loadedHandlers = [];

  for (const route of ROUTES) {
    const moduleUrl = pathToFileURL(path.join(awsDir, 'dist', route.modulePath)).href;
    const loadedModule = await import(moduleUrl);
    const handler = loadedModule[route.exportName];

    if (typeof handler !== 'function') {
      throw new Error(`Missing export ${route.exportName} in ${route.modulePath}`);
    }

    loadedHandlers.push({
      ...route,
      handler,
    });
  }

  return loadedHandlers;
}

function findRoute(routes, method, pathname) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.routeRegex);
    if (!match) continue;

    const pathParameters = {};
    route.pathParamNames.forEach((name, index) => {
      pathParameters[name] = decodeURIComponent(match[index + 1]);
    });

    return {
      route,
      pathParameters,
    };
  }

  return null;
}

function toSingleValueQueryParams(searchParams) {
  const queryStringParameters = {};
  for (const [key, value] of searchParams.entries()) {
    queryStringParameters[key] = value;
  }

  return Object.keys(queryStringParameters).length > 0 ? queryStringParameters : undefined;
}

function getResponseOrigin(request) {
  return request.headers.origin || '*';
}

function parseRequestCookies(request) {
  const rawCookieHeader = request.headers.cookie;
  if (!rawCookieHeader) {
    return undefined;
  }

  const joined = Array.isArray(rawCookieHeader) ? rawCookieHeader.join('; ') : rawCookieHeader;
  const cookies = joined
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return cookies.length > 0 ? cookies : undefined;
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks).toString('utf8');
}

function writeCorsResponse(request, response) {
  response.writeHead(204, {
    'access-control-allow-origin': getResponseOrigin(request),
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-credentials': 'true',
    vary: 'origin',
  });
  response.end();
}

async function main() {
  setAwsEnv();
  buildAwsDist();
  const routes = await loadHandlers();

  const server = createServer(async (request, response) => {
    try {
      if (!request.url || !request.method) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'Invalid request URL' }));
        return;
      }

      if (request.method === 'OPTIONS') {
        writeCorsResponse(request, response);
        return;
      }

      const requestUrl = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);

      if (request.method.toUpperCase() === 'GET' && requestUrl.pathname === '/health') {
        response.writeHead(200, {
          'content-type': 'application/json',
          'access-control-allow-origin': getResponseOrigin(request),
          'access-control-allow-credentials': 'true',
          vary: 'origin',
        });
        response.end(JSON.stringify({
          ok: true,
          service: 'local-api',
          port: defaultPort,
        }));
        return;
      }

      const matched = findRoute(routes, request.method.toUpperCase(), requestUrl.pathname);

      if (!matched) {
        response.writeHead(404, {
          'content-type': 'application/json',
          'access-control-allow-origin': getResponseOrigin(request),
          'access-control-allow-credentials': 'true',
          vary: 'origin',
        });
        response.end(JSON.stringify({
          message: `No local handler registered for ${request.method} ${requestUrl.pathname}`,
          service: 'local-api',
          code: 'LOCAL_ROUTE_NOT_FOUND',
          retryable: false,
        }));
        return;
      }

      const rawBody = await readRequestBody(request);
      const event = {
        version: '2.0',
        routeKey: `${request.method.toUpperCase()} ${matched.route.routePath}`,
        rawPath: requestUrl.pathname,
        rawQueryString: requestUrl.searchParams.toString(),
        headers: Object.fromEntries(Object.entries(request.headers).flatMap(([key, value]) => {
          if (Array.isArray(value)) {
            return [[key.toLowerCase(), value.join(',')]];
          }
          return value === undefined ? [] : [[key.toLowerCase(), value]];
        })),
        cookies: parseRequestCookies(request),
        queryStringParameters: toSingleValueQueryParams(requestUrl.searchParams),
        pathParameters: Object.keys(matched.pathParameters).length > 0 ? matched.pathParameters : undefined,
        requestContext: {
          http: {
            method: request.method.toUpperCase(),
            path: requestUrl.pathname,
            protocol: 'HTTP/1.1',
            sourceIp: request.socket.remoteAddress || '127.0.0.1',
            userAgent: request.headers['user-agent'] || '',
          },
          routeKey: `${request.method.toUpperCase()} ${matched.route.routePath}`,
          stage: '$default',
          timeEpoch: Date.now(),
          requestId: `${Date.now()}`,
          apiId: 'local-api',
        },
        body: rawBody,
        isBase64Encoded: false,
      };

      const lambdaResponse = await matched.route.handler(event);
      const statusCode = lambdaResponse.statusCode || 200;
      const headers = {
        'access-control-allow-origin': getResponseOrigin(request),
        'access-control-allow-credentials': 'true',
        vary: 'origin',
        ...(lambdaResponse.headers || {}),
        ...(lambdaResponse.cookies ? { 'set-cookie': lambdaResponse.cookies } : {}),
      };

      response.writeHead(statusCode, headers);
      response.end(lambdaResponse.body || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected local API server error';
      response.writeHead(500, {
        'content-type': 'application/json',
        'access-control-allow-origin': getResponseOrigin(request),
        'access-control-allow-credentials': 'true',
        vary: 'origin',
      });
      response.end(JSON.stringify({
        message,
        service: 'local-api',
        code: 'LOCAL_API_SERVER_ERROR',
        retryable: false,
      }));
    }
  });

  server.listen(defaultPort, '127.0.0.1', () => {
    console.log(`Local API server listening on http://127.0.0.1:${defaultPort}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});