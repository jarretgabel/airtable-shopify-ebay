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

async function main() {
  const origin = await requireReadyLocalApiOrigin(getOptionalEnv, { purpose: 'local:api:check' });
  const response = await fetch(`${origin}/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Local API health check failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  console.log(`OK  local API ready at ${origin}`);
  console.log(JSON.stringify(body, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});