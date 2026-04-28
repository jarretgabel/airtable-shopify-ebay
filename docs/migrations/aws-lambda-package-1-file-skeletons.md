# AWS Lambda Package 1 File Skeletons

## Purpose

This document defines the exact initial file set for Package 1. The goal is not to finalize all implementation details, but to remove uncertainty about what each first-pass file should contain.

## Default Packaging Choice

Use a separate `aws/` package for Lambda code.

Reasons:

- the root project currently only contains frontend dependencies and scripts
- the current TypeScript config scopes do not cover Lambda source files
- isolating Lambda build dependencies avoids polluting the frontend package during the first package

## Target Directory Layout

```text
docs/migrations/
  aws-lambda-migration-plan.md
  aws-lambda-package-1-workbook.md
  aws-lambda-package-1-file-skeletons.md
  aws-lambda-local-workflow.md

src/services/app-api/
  index.ts
  flags.ts
  http.ts
  jotform.ts
  airtable.ts

aws/
  README.md
  package.json
  tsconfig.json
  template.yaml
  env.local.json.example
  src/shared/
    errors.ts
    http.ts
    logging.ts
    secrets.ts
    types.ts
  src/handlers/jotform/
    getForms.ts
    getFormSubmissions.ts
  src/handlers/airtable/
    getListings.ts
  src/providers/jotform/
    client.ts
  src/providers/airtable/
    client.ts
    validation.ts
```

## Frontend Seam Skeletons

### `src/services/app-api/flags.ts`

Responsibilities:

- centralize migration flag parsing
- avoid duplicating `import.meta.env` reads across wrappers
- expose a stable app-facing config surface

Recommended first shape:

```ts
function isEnabled(value: string | undefined): boolean {
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function useLambdaJotform(): boolean {
  return isEnabled(import.meta.env.VITE_USE_LAMBDA_JOTFORM);
}

export function useLambdaAirtable(): boolean {
  return isEnabled(import.meta.env.VITE_USE_LAMBDA_AIRTABLE);
}

export function getAppApiBaseUrl(): string {
  return (import.meta.env.VITE_APP_API_BASE_URL || '').trim();
}
```

### `src/services/app-api/http.ts`

Responsibilities:

- build internal API URLs
- encode query params safely
- parse standard Lambda error payloads
- avoid leaking AWS-specific behavior into hooks

Recommended first shape:

```ts
import { getAppApiBaseUrl } from './flags';

interface ApiErrorBody {
  message?: string;
  service?: string;
  code?: string;
  retryable?: boolean;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = getAppApiBaseUrl();
  const url = new URL(path, base || window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return base ? url.toString() : `${url.pathname}${url.search}`;
}

export async function getJson<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const response = await fetch(buildUrl(path, params));
  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    throw new Error(body?.message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

### `src/services/app-api/jotform.ts`

Responsibilities:

- preserve the current `useJotForm` contract
- own all direct-versus-Lambda branching
- keep wrapper logic orchestration-only

Recommended first shape:

```ts
import type { JotFormForm, JotFormSubmission } from '@/types/jotform';
import { getForms as getDirectForms, getFormSubmissions as getDirectFormSubmissions } from '@/services/jotform';
import { useLambdaJotform } from './flags';
import { getJson } from './http';

export async function getForms(): Promise<JotFormForm[]> {
  if (!useLambdaJotform()) {
    return getDirectForms();
  }

  return getJson<JotFormForm[]>('/api/jotform/forms');
}

export async function getFormSubmissions(formId: string, limit = 100, offset = 0): Promise<JotFormSubmission[]> {
  if (!useLambdaJotform()) {
    return getDirectFormSubmissions(formId, limit, offset);
  }

  return getJson<JotFormSubmission[]>(`/api/jotform/forms/${encodeURIComponent(formId)}/submissions`, {
    limit,
    offset,
    orderby: 'created_at',
    direction: 'DESC',
  });
}
```

### `src/services/app-api/airtable.ts`

Responsibilities:

- preserve the current `useListings` contract
- keep the first Lambda path narrow to listing reads
- use the existing Airtable barrel as the direct fallback

Recommended first shape:

```ts
import airtableService from '@/services/airtable';
import type { AirtableRecord } from '@/types/airtable';
import { useLambdaAirtable } from './flags';
import { getJson } from './http';

export async function getListings(tableName: string, options?: { view?: string }): Promise<AirtableRecord[]> {
  if (!useLambdaAirtable()) {
    return airtableService.getRecords(tableName, { view: options?.view });
  }

  return getJson<AirtableRecord[]>('/api/airtable/listings', {
    tableName,
    view: options?.view,
  });
}
```

### `src/services/app-api/index.ts`

Recommended first shape:

```ts
export * as jotformAppApi from './jotform';
export * as airtableAppApi from './airtable';
export * from './flags';
```

### Hook reroutes

`src/hooks/useJotForm.ts`

- replace imports from `@/services/jotform` with imports from `@/services/app-api/jotform`
- do not change hook behavior

`src/hooks/useListings.ts`

- keep the current hook signature unchanged
- replace the direct Airtable service import with `getListings` from `@/services/app-api/airtable`

## AWS Package Skeletons

### `aws/package.json`

Recommended first shape:

```json
{
  "name": "airtable-shopify-ebay-aws",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "sam build",
    "local:start-api": "sam local start-api --template-file template.yaml --env-vars env.local.json --port 3001",
    "local:invoke:jotform-forms": "sam local invoke JotformGetFormsFunction --template-file template.yaml --env-vars env.local.json",
    "local:invoke:airtable-listings": "sam local invoke AirtableGetListingsFunction --template-file template.yaml --env-vars env.local.json"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.147",
    "typescript": "^5.3.0"
  }
}
```

Note:

- keep the first package light; only add runtime libraries when implementation requires them
- if provider clients use native `fetch`, Package 1 may not need Axios inside `aws/`

### `aws/tsconfig.json`

Recommended first shape:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "aws-lambda"],
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

### `aws/template.yaml`

Recommended first shape:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 15
    MemorySize: 256
    Architectures:
      - arm64

Resources:
  AppHttpApi:
    Type: AWS::Serverless::HttpApi

  JotformGetFormsFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: .
      Handler: src/handlers/jotform/getForms.handler
      Events:
        ApiEvent:
          Type: HttpApi
          Properties:
            ApiId: !Ref AppHttpApi
            Method: GET
            Path: /api/jotform/forms

  JotformGetFormSubmissionsFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: .
      Handler: src/handlers/jotform/getFormSubmissions.handler
      Events:
        ApiEvent:
          Type: HttpApi
          Properties:
            ApiId: !Ref AppHttpApi
            Method: GET
            Path: /api/jotform/forms/{formId}/submissions

  AirtableGetListingsFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: .
      Handler: src/handlers/airtable/getListings.handler
      Events:
        ApiEvent:
          Type: HttpApi
          Properties:
            ApiId: !Ref AppHttpApi
            Method: GET
            Path: /api/airtable/listings

Outputs:
  AppApiUrl:
    Value: !Sub https://${AppHttpApi}.execute-api.${AWS::Region}.amazonaws.com
```

## Shared AWS Helpers

### `aws/src/shared/types.ts`

Recommended first contents:

- `ApiErrorBody`
- `JsonRecord`
- optional query param helper types

### `aws/src/shared/errors.ts`

Recommended first shape:

```ts
export interface ApiErrorBody {
  message: string;
  service: string;
  code: string;
  retryable: boolean;
}

export function toApiErrorBody(service: string, error: unknown, fallbackCode: string): ApiErrorBody {
  return {
    message: error instanceof Error ? error.message : 'Unexpected error',
    service,
    code: fallbackCode,
    retryable: true,
  };
}
```

### `aws/src/shared/http.ts`

Recommended first shape:

```ts
import type { APIGatewayProxyResultV2 } from 'aws-lambda';

export function jsonOk(body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function jsonError(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
```

### `aws/src/shared/logging.ts`

Recommended first contents:

- `getCorrelationId(event)` helper
- `logInfo(message, details)` helper
- `logError(message, details)` helper

Keep the first version simple and structured.

### `aws/src/shared/secrets.ts`

Recommended first contents:

- one helper that reads from process env names already injected into the Lambda runtime
- defer AWS SDK-based secret fetch logic if deployment injects resolved values directly

Pragmatic first step:

- Package 1 can start with env-injected secret values or secret names resolved by SAM parameters
- do not block the seam pattern on a heavyweight secret abstraction if deployment wiring is still evolving

## Provider And Handler Skeletons

### `aws/src/providers/jotform/client.ts`

Responsibilities:

- call JotForm server-side
- preserve array shapes
- own provider-specific URL construction

Recommended first exports:

- `getForms()`
- `getFormSubmissions(formId, options)`

### `aws/src/providers/airtable/validation.ts`

Recommended first shape:

```ts
const allowedTableName = process.env.ALLOWED_AIRTABLE_TABLE_NAME?.trim();
const allowedViewId = process.env.ALLOWED_AIRTABLE_VIEW_ID?.trim();

export function validateListingsQuery(tableName: string, view?: string): void {
  if (!allowedTableName || tableName !== allowedTableName) {
    throw new Error('Unsupported Airtable table');
  }

  if (allowedViewId && view && view !== allowedViewId) {
    throw new Error('Unsupported Airtable view');
  }
}
```

### `aws/src/providers/airtable/client.ts`

Recommended first exports:

- `getListings(tableName, view?)`

Behavior:

- preserve `AirtableRecord[]`
- keep pagination internal
- use the current frontend Airtable service logic as the reference model

### `aws/src/handlers/jotform/getForms.ts`

Recommended first shape:

```ts
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { jsonError, jsonOk } from '../../shared/http';
import { toApiErrorBody } from '../../shared/errors';
import { getForms } from '../../providers/jotform/client';

export const handler: APIGatewayProxyHandlerV2 = async () => {
  try {
    const forms = await getForms();
    return jsonOk(forms);
  } catch (error) {
    return jsonError(500, toApiErrorBody('jotform', error, 'JOTFORM_GET_FORMS_FAILED'));
  }
};
```

### `aws/src/handlers/jotform/getFormSubmissions.ts`

Recommended first responsibilities:

- read `formId` from path params
- validate `limit` and `offset`
- return `JotFormSubmission[]`

### `aws/src/handlers/airtable/getListings.ts`

Recommended first responsibilities:

- read `tableName` and `view` from query params
- call `validateListingsQuery`
- return `AirtableRecord[]`

## Notes On Deliberate Omissions

Package 1 should not include:

- a shared monorepo TypeScript configuration
- generalized AWS middleware layers
- a generic Airtable proxy route
- Shopify or eBay scaffolding
- auth or cookie abstractions

Those belong later, after the seam and first two Lambda-backed integrations are proven.