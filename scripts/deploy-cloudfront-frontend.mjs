import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_DEPLOY_CONFIG_PATH = path.resolve(process.cwd(), '.cloudfront-frontend.deploy.json');

function printUsage() {
  console.log(`Usage:
  node scripts/deploy-cloudfront-frontend.mjs --bucket <bucket-name> [options]

Options:
  --bucket <name>             Required. Target S3 bucket name.
  --distribution-id <id>      Optional. CloudFront distribution ID for invalidation.
  --profile <name>            Optional. AWS CLI profile.
  --region <name>             Optional. AWS region.
  --config <path>             Optional. JSON file with default deploy settings.
  --runtime-config <path>     Optional. Runtime config source file for this deploy.
  --skip-build                Optional. Skip npm run build:cloudfront.
  --no-invalidate             Optional. Skip CloudFront invalidation.
  --runtime-only              Optional. Upload only runtime-config.json.
`);
}

function readJsonFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Deploy config must be a JSON object: ${filePath}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    bucket: '',
    distributionId: '',
    profile: '',
    region: '',
    configPath: DEFAULT_DEPLOY_CONFIG_PATH,
    runtimeConfigPath: '',
    skipBuild: false,
    noInvalidate: false,
    runtimeOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--bucket') {
      options.bucket = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--distribution-id') {
      options.distributionId = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--profile') {
      options.profile = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--region') {
      options.region = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--config') {
      options.configPath = path.resolve(process.cwd(), argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (arg === '--runtime-config') {
      options.runtimeConfigPath = path.resolve(process.cwd(), argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (arg === '--skip-build') {
      options.skipBuild = true;
      continue;
    }
    if (arg === '--no-invalidate') {
      options.noInvalidate = true;
      continue;
    }
    if (arg === '--runtime-only') {
      options.runtimeOnly = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  try {
    const config = readJsonFile(options.configPath);
    options.bucket ||= typeof config.bucket === 'string' ? config.bucket : '';
    options.distributionId ||= typeof config.distributionId === 'string' ? config.distributionId : '';
    options.profile ||= typeof config.profile === 'string' ? config.profile : '';
    options.region ||= typeof config.region === 'string' ? config.region : '';
    options.runtimeConfigPath ||= typeof config.runtimeConfigPath === 'string'
      ? path.resolve(process.cwd(), config.runtimeConfigPath)
      : '';
  } catch (error) {
    if (options.configPath !== DEFAULT_DEPLOY_CONFIG_PATH) {
      throw error;
    }
  }

  if (!options.bucket) {
    throw new Error('Missing required --bucket argument.');
  }

  return options;
}

function run(command, args, envOverrides = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...envOverrides },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function buildEnv(options) {
  return options.runtimeConfigPath
    ? { RUNTIME_CONFIG_PATH: options.runtimeConfigPath }
    : {};
}

function validateRuntimeConfigSource(options) {
  const runtimeConfigPath = options.runtimeConfigPath || 'public/runtime-config.json';
  run('node', ['scripts/validate-runtime-config.mjs', runtimeConfigPath]);
}

function renderRuntimeConfig(options) {
  run('node', ['scripts/render-runtime-config.mjs'], buildEnv(options));
}

function awsArgs(baseArgs, options) {
  const args = [];
  if (options.profile) args.push('--profile', options.profile);
  if (options.region) args.push('--region', options.region);
  args.push(...baseArgs);
  return args;
}

function uploadRuntimeConfig(options) {
  run('aws', awsArgs([
    's3', 'cp', 'dist/runtime-config.json', `s3://${options.bucket}/runtime-config.json`,
    '--cache-control', 'no-cache, no-store, must-revalidate',
    '--content-type', 'application/json',
  ], options));
}

function uploadFullSite(options) {
  run('aws', awsArgs([
    's3', 'sync', 'dist/assets', `s3://${options.bucket}/assets`,
    '--delete',
    '--cache-control', 'public, max-age=31536000, immutable',
  ], options));

  run('aws', awsArgs([
    's3', 'sync', 'dist', `s3://${options.bucket}`,
    '--delete',
    '--exclude', 'assets/*',
    '--exclude', 'index.html',
    '--exclude', 'runtime-config.json',
  ], options));

  run('aws', awsArgs([
    's3', 'cp', 'dist/index.html', `s3://${options.bucket}/index.html`,
    '--cache-control', 'no-cache, no-store, must-revalidate',
    '--content-type', 'text/html',
  ], options));

  uploadRuntimeConfig(options);
}

function invalidate(options) {
  if (!options.distributionId || options.noInvalidate) return;

  const paths = options.runtimeOnly
    ? ['/runtime-config.json']
    : ['/', '/index.html', '/runtime-config.json'];

  run('aws', awsArgs([
    'cloudfront', 'create-invalidation',
    '--distribution-id', options.distributionId,
    '--paths', ...paths,
  ], options));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  run('node', ['scripts/validate-cloudfront-deploy-config.mjs', options.configPath]);
  validateRuntimeConfigSource(options);

  if (!options.skipBuild && !options.runtimeOnly) {
    run('npm', ['run', 'build:cloudfront'], buildEnv(options));
  } else if (options.runtimeOnly) {
    renderRuntimeConfig(options);
    run('node', ['scripts/validate-runtime-config.mjs', 'dist/runtime-config.json']);
  } else {
    run('node', ['scripts/validate-runtime-config.mjs', 'dist/runtime-config.json']);
  }

  if (options.runtimeOnly) {
    uploadRuntimeConfig(options);
  } else {
    uploadFullSite(options);
  }

  invalidate(options);
}

await main();