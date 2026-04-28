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

  process.env.GOOGLE_GMAIL_ACCESS_TOKEN = getOptionalEnv(mergedEnv, 'VITE_GOOGLE_GMAIL_ACCESS_TOKEN');
  process.env.GOOGLE_GMAIL_FROM_EMAIL = getOptionalEnv(mergedEnv, 'VITE_GOOGLE_GMAIL_FROM_EMAIL');

  process.env.OPENAI_API_KEY = getOptionalEnv(mergedEnv, 'VITE_OPENAI_API_KEY');
  process.env.OPENAI_MODEL = getOptionalEnv(mergedEnv, 'VITE_OPENAI_MODEL');
  process.env.GITHUB_TOKEN = getOptionalEnv(mergedEnv, 'VITE_GITHUB_TOKEN');
  process.env.AI_PROVIDER = getOptionalEnv(mergedEnv, 'VITE_AI_PROVIDER');

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

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks).toString('utf8');
}

function writeCorsResponse(response) {
  response.writeHead(204, {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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
        writeCorsResponse(response);
        return;
      }

      const requestUrl = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
      const matched = findRoute(routes, request.method.toUpperCase(), requestUrl.pathname);

      if (!matched) {
        response.writeHead(404, {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
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
        'access-control-allow-origin': '*',
        ...(lambdaResponse.headers || {}),
      };

      response.writeHead(statusCode, headers);
      response.end(lambdaResponse.body || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected local API server error';
      response.writeHead(500, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
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