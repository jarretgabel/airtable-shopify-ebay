import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { requireReadyLocalApiOrigin } from './local-api-origin.mjs';

const cwd = process.cwd();

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
  ...process.env,
};

function getOptionalEnv(name) {
  const value = mergedEnv[name]?.trim();
  return value || '';
}

function getLoginCredentials() {
  const email = getOptionalEnv('LOCAL_API_AUTH_EMAIL') || getOptionalEnv('APPROVAL_LOCAL_API_EMAIL');
  const password = getOptionalEnv('LOCAL_API_AUTH_PASSWORD') || getOptionalEnv('APPROVAL_LOCAL_API_PASSWORD');

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

async function readJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function login(origin, credentials) {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(body?.message || `Login failed with ${response.status}`);
  }

  const setCookieHeader = response.headers.get('set-cookie') || '';
  const sessionCookie = setCookieHeader.split(';')[0]?.trim();
  if (!sessionCookie) {
    throw new Error('Login response did not include a session cookie.');
  }

  if (!body?.csrfToken) {
    throw new Error('Login response did not include a csrfToken.');
  }

  return {
    cookie: sessionCookie,
    csrfToken: String(body.csrfToken),
    userId: String(body.userId || ''),
  };
}

async function postProtectedJson(origin, routePath, auth, body) {
  const response = await fetch(`${origin}${routePath}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: auth.cookie,
      'x-csrf-token': auth.csrfToken,
    },
    body: JSON.stringify(body),
  });

  return {
    statusCode: response.status,
    body: await readJsonResponse(response),
  };
}

async function main() {
  const origin = await requireReadyLocalApiOrigin(getOptionalEnv, { purpose: 'local:api:approval-check' });
  const credentials = getLoginCredentials();

  if (!credentials) {
    console.log('Skipping approval local API smoke. Set LOCAL_API_AUTH_EMAIL and LOCAL_API_AUTH_PASSWORD to run it.');
    return;
  }

  const auth = await login(origin, credentials);
  console.log(`OK  auth login -> ${auth.userId || 'authenticated session'}`);

  const normalizeResult = await postProtectedJson(origin, '/api/approval/normalize', auth, {
    target: 'ebay',
    fields: {
      Title: 'Lambda Approval Smoke',
      Description: 'Smoke test description',
      SKU: 'APPROVAL-SMOKE-SKU',
      Brand: 'Resolution AV',
      Categories: '3276',
      Price: '19.99',
      Condition: 'USED_EXCELLENT',
    },
    bodyPreview: {
      templateHtml: '<html><body><h1>{{title}}</h1><p>{{description}}</p></body></html>',
      title: 'Lambda Approval Smoke',
      description: 'Smoke test description',
      keyFeatures: 'Power:100W',
    },
    categoryPreview: {
      labelsById: {
        '3276': 'Amplifiers & Preamps',
      },
    },
  });

  if (normalizeResult.statusCode !== 200 || !normalizeResult.body?.ebay?.generatedBodyHtml) {
    throw new Error(normalizeResult.body?.message || 'Approval normalize smoke failed.');
  }

  console.log('OK  approval normalize -> generatedBodyHtml');

  const publishResult = await postProtectedJson(origin, '/api/approval/publish', auth, {
    target: 'ebay',
    source: 'approval-ebay',
    recordId: 'rec-smoke-test',
    publishSetup: {
      locationConfig: {
        key: 'resolution-av-warehouse',
        name: 'Resolution AV Warehouse',
        country: 'US',
        postalCode: '10001',
        city: 'New York',
      },
      policyConfig: {
        fulfillmentPolicyId: '123',
        paymentPolicyId: '456',
      },
    },
  });

  if (publishResult.statusCode !== 400) {
    throw new Error(`Expected approval publish validation failure, received ${publishResult.statusCode}.`);
  }

  if (!String(publishResult.body?.message || '').includes('publishSetup is invalid')) {
    throw new Error('Approval publish validation response did not report the publishSetup contract error.');
  }

  console.log('OK  approval publish validation -> publishSetup is invalid');

  await postProtectedJson(origin, '/api/auth/logout', auth, {});
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});