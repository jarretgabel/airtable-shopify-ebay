import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const PLACEHOLDER_BUCKETS = new Set([
  'my-frontend-bucket',
  'my-staging-frontend-bucket',
  'my-prod-frontend-bucket',
]);

const PLACEHOLDER_DISTRIBUTIONS = new Set([
  'E123456789ABC',
  'ESTAGING123456',
  'EPROD123456',
]);

function readJson(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${filePath}: deploy config must be a JSON object.`);
  }
  return parsed;
}

function requireString(config, key, filePath) {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${filePath}: ${key} must be a non-empty string.`);
  }
  return value.trim();
}

function validateFile(inputPath) {
  const filePath = path.resolve(process.cwd(), inputPath);
  if (!existsSync(filePath)) {
    throw new Error(`${inputPath}: file does not exist.`);
  }

  const config = readJson(filePath);
  const bucket = requireString(config, 'bucket', inputPath);
  const distributionId = requireString(config, 'distributionId', inputPath);
  const profile = requireString(config, 'profile', inputPath);
  const region = requireString(config, 'region', inputPath);
  const runtimeConfigPath = typeof config.runtimeConfigPath === 'string'
    ? config.runtimeConfigPath.trim()
    : '';

  if (PLACEHOLDER_BUCKETS.has(bucket)) {
    throw new Error(`${inputPath}: bucket still contains placeholder value ${bucket}. Replace it before deploy.`);
  }

  if (PLACEHOLDER_DISTRIBUTIONS.has(distributionId)) {
    throw new Error(`${inputPath}: distributionId still contains placeholder value ${distributionId}. Replace it before deploy.`);
  }

  if (!/^E[A-Z0-9]+$/i.test(distributionId)) {
    throw new Error(`${inputPath}: distributionId must look like a CloudFront distribution id.`);
  }

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/i.test(bucket)) {
    throw new Error(`${inputPath}: bucket must look like a valid S3 bucket name.`);
  }

  if (!/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
    throw new Error(`${inputPath}: region must look like an AWS region, for example us-east-1.`);
  }

  if (!/^[A-Za-z0-9._-]+$/.test(profile)) {
    throw new Error(`${inputPath}: profile contains unsupported characters.`);
  }

  if (runtimeConfigPath) {
    const resolvedRuntimeConfigPath = path.resolve(process.cwd(), runtimeConfigPath);
    if (!existsSync(resolvedRuntimeConfigPath)) {
      throw new Error(`${inputPath}: runtimeConfigPath does not exist: ${runtimeConfigPath}.`);
    }
  }
}

function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    throw new Error('Provide at least one deploy config file path.');
  }

  for (const target of targets) {
    validateFile(target);
  }

  console.log(`Validated CloudFront deploy config: ${targets.join(', ')}`);
}

main();