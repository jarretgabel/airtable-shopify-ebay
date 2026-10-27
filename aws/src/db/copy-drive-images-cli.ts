import pg from 'pg';
import { downloadGoogleDriveFile } from '../providers/googleDrive/client.js';
import { createS3MediaStore } from '../providers/media/mediaStore.js';
import { copyDriveImages } from './copyDriveImages.js';

// Usage: copy-drive-images-cli --base appXXXX [--record recA,recB] [--limit 5] [--apply]
// Default is a dry run: counts the Drive images that would be copied, writes nothing.
// With --apply: needs MEDIA_BUCKET, MEDIA_PUBLIC_BASE_URL and GOOGLE_DRIVE_CLIENT_ID/_SECRET/_REFRESH_TOKEN.
// Drive is only read. Safe to re-run; already copied images are skipped.
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseId = arg('base');
const connectionString = process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
const bucket = process.env.MEDIA_BUCKET?.trim();
if (!baseId || !connectionString || (apply && !bucket)) {
  console.error('--base and DATABASE_URL are required (and MEDIA_BUCKET with --apply).');
  process.exit(1);
}

const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });
await client.connect();
try {
  const media = createS3MediaStore({ bucket: bucket ?? 'dry-run', publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL?.trim() ?? '' });
  const report = await copyDriveImages({
    client, baseId, media, apply,
    recordIds: arg('record')?.split(',').map((id) => id.trim()).filter(Boolean),
    onProgress: (r, done, total) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${done}/${total} records, ${r.images} images, copied ${r.copied}, converted ${r.converted}, skipped ${r.skipped}, failed ${r.failed}, ${Math.round(r.bytes / 1048576)} MB`),
    limit: arg('limit') ? Number(arg('limit')) : undefined,
    download: downloadGoogleDriveFile,
    convertHeic: async (bytes) => {
      const { default: convert } = await import('heic-convert');
      return Buffer.from(await convert({ buffer: bytes, format: 'JPEG', quality: 0.9 }));
    },
  });
  console.log(apply ? 'APPLY' : 'DRY RUN', JSON.stringify({ ...report, megabytes: Math.round(report.bytes / 1048576) }));
} finally {
  await client.end();
}
