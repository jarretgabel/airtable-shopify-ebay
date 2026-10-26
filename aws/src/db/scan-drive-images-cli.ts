import { writeFileSync } from 'node:fs';
import pg from 'pg';

// Usage: scan-drive-images-cli [--out report.json] [--concurrency 4]
// Read-only: lists distinct Drive file ids from workflow_images (SELECT) and asks Drive for their metadata (files.get).
// Needs DATABASE_URL and GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN.
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const connectionString = process.env.DATABASE_URL;
const { GOOGLE_DRIVE_CLIENT_ID: clientId, GOOGLE_DRIVE_CLIENT_SECRET: clientSecret, GOOGLE_DRIVE_REFRESH_TOKEN: refreshToken } = process.env;
if (!connectionString || !clientId || !clientSecret || !refreshToken) {
  console.error('DATABASE_URL and the GOOGLE_DRIVE_* credentials are required.');
  process.exit(1);
}

let accessToken = '';
let tokenExpires = 0;
async function token(): Promise<string> {
  if (accessToken && Date.now() < tokenExpires) return accessToken;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, refresh_token: refreshToken!, grant_type: 'refresh_token' }),
  });
  if (!response.ok) throw new Error(`Drive token request failed: HTTP ${response.status}`);
  const body = await response.json() as { access_token: string; expires_in: number };
  accessToken = body.access_token;
  tokenExpires = Date.now() + (body.expires_in - 60) * 1000;
  return accessToken;
}

interface FileResult {
  fileId: string;
  status: 'ok' | 'trashed' | 'missing' | 'forbidden' | 'error';
  size?: number;
  mimeType?: string;
  name?: string;
  detail?: string;
}

async function inspect(fileId: string): Promise<FileResult> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,trashed&supportsAllDrives=true`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      continue;
    }
    if (response.status === 404) return { fileId, status: 'missing' };
    if (response.status === 403) return { fileId, status: 'forbidden' };
    if (!response.ok) return { fileId, status: 'error', detail: `HTTP ${response.status}` };
    const file = await response.json() as { name: string; mimeType: string; size?: string; trashed?: boolean };
    return { fileId, status: file.trashed ? 'trashed' : 'ok', size: Number(file.size ?? 0), mimeType: file.mimeType, name: file.name };
  }
  return { fileId, status: 'error', detail: 'retries exhausted' };
}

const useTls = !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false });
await client.connect();
const rows = await client.query<{ file_id: string; uses: string; kinds: string[] }>(
  `SELECT substring(url from 'id=([A-Za-z0-9_-]+)') AS file_id, count(*) AS uses, array_agg(DISTINCT kind) AS kinds
   FROM workflow_images WHERE url LIKE 'https://drive.google.com/%' GROUP BY 1`,
);
await client.end();

const ids = rows.rows.filter((row) => row.file_id);
const concurrency = Number(arg('concurrency') ?? 4);
const results: FileResult[] = [];
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < ids.length) {
    const row = ids[next];
    next += 1;
    results.push(await inspect(row.file_id));
    if (results.length % 500 === 0) console.log(`checked ${results.length}/${ids.length}`);
  }
}));

const byStatus: Record<string, number> = {};
const byMime: Record<string, number> = {};
let bytes = 0;
for (const result of results) {
  byStatus[result.status] = (byStatus[result.status] ?? 0) + 1;
  if (result.status === 'ok') {
    bytes += result.size ?? 0;
    byMime[result.mimeType ?? 'unknown'] = (byMime[result.mimeType ?? 'unknown'] ?? 0) + 1;
  }
}
console.log(JSON.stringify({ distinctFiles: ids.length, rowsWithoutId: rows.rows.length - ids.length, byStatus, byMime, totalMB: Math.round(bytes / 1048576) }, null, 2));
const out = arg('out');
if (out) writeFileSync(out, JSON.stringify(results, null, 1));
