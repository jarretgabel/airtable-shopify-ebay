import pg from 'pg';
import { createS3MediaStore } from '../providers/media/mediaStore.js';
import { generateImageVariants } from './generateImageVariants.js';

// Usage: generate-image-variants-cli --base appXXXX [--limit 20] [--apply]
// Default is a dry run that counts the variants it would create. With --apply it needs MEDIA_BUCKET.
// Only writes new objects under variants/; originals are never changed. Safe to re-run.
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseId = arg('base');
const connectionString = process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
const bucket = process.env.MEDIA_BUCKET?.trim();
if (!baseId || !connectionString || !bucket) {
  console.error('--base, DATABASE_URL and MEDIA_BUCKET are required.');
  process.exit(1);
}

const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });
await client.connect();
try {
  const { default: sharp } = await import('sharp');
  const report = await generateImageVariants({
    client, baseId, apply,
    media: createS3MediaStore({ bucket, publicBaseUrl: '' }),
    limit: arg('limit') ? Number(arg('limit')) : undefined,
    resize: (bytes, width) => sharp(bytes).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer(),
    onProgress: (r, done, total) => {
      if (done % 100 === 0 || done === total) console.log(`[${new Date().toISOString().slice(11, 19)}] ${done}/${total} images, created ${r.created}, skipped ${r.skipped}, failed ${r.failed}`);
    },
  });
  console.log(apply ? 'APPLY' : 'DRY RUN', JSON.stringify({ ...report, failures: report.failures.slice(0, 20) }));
} finally {
  await client.end();
}
