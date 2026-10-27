import type { Pool, PoolClient } from 'pg';
import { extractGoogleDriveFileId } from '../providers/googleDrive/client.js';
import { safeSegment } from '../providers/media/workflowImageArchive.js';
import type { MediaStore } from '../providers/media/mediaStore.js';
import { syncWorkflowImages } from './workflowImages.js';

export interface CopyDriveImagesReport {
  records: number;
  images: number;
  copied: number;
  converted: number;
  skipped: number;
  failed: number;
  bytes: number;
  failures: Array<{ recordId: string; url: string; reason: string }>;
}

export interface DriveFile {
  bytes: Buffer;
  contentType: string | null;
}

export interface CopyDriveImagesOptions {
  client: Pick<PoolClient, 'query'> | Pick<Pool, 'query'>;
  baseId: string;
  media: MediaStore;
  download: (fileId: string) => Promise<DriveFile>;
  /** HEIC/HEIF to JPEG; browsers, eBay and Shopify cannot use HEIC. */
  convertHeic: (bytes: Buffer) => Promise<Buffer>;
  apply: boolean;
  /** Only these records (for trying one record first). */
  recordIds?: string[];
  limit?: number;
  onProgress?: (report: CopyDriveImagesReport, done: number, total: number) => void;
}

type Entry = Record<string, unknown>;

const METADATA_FIELD = 'Workflow Image Metadata JSON';

export function isHeic(bytes: Buffer, contentType: string | null, filename: string): boolean {
  if (/image\/hei[cf]/i.test(contentType ?? '') || /\.hei[cf]$/i.test(filename)) return true;
  return bytes.length >= 12 && bytes.toString('latin1', 4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1)/.test(bytes.toString('latin1', 8, 12));
}

function guessType(bytes: Buffer, fallback: string | null): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  return fallback && fallback !== 'application/octet-stream' ? fallback : 'application/octet-stream';
}

/** HTML placeholders (the `--original` stand-ins) are not images; they keep their Drive URL. */
function looksLikeHtml(bytes: Buffer): boolean {
  return /^\s*<(!doctype|html)/i.test(bytes.toString('utf8', 0, 64));
}

/**
 * Copies Drive-hosted workflow images to S3 and repoints the Postgres copy of `Workflow Image Metadata JSON`
 * (the Drive URL is kept as `legacyUrl`). Drive is only read. Idempotent: entries already on /api/media are skipped.
 */
export async function copyDriveImages(options: CopyDriveImagesOptions): Promise<CopyDriveImagesReport> {
  const { client, baseId, media, download, convertHeic, apply } = options;
  const report: CopyDriveImagesReport = { records: 0, images: 0, copied: 0, converted: 0, skipped: 0, failed: 0, bytes: 0, failures: [] };

  const candidates = await client.query<{ record_id: string }>(
    `SELECT DISTINCT record_id FROM workflow_images
     WHERE base_id = $1 AND url LIKE 'https://drive.google.com/%' AND ($2::text[] IS NULL OR record_id = ANY($2))
     ORDER BY record_id`,
    [baseId, options.recordIds ?? null],
  );
  const recordIds = candidates.rows.map((row) => row.record_id).slice(0, options.limit ?? Infinity);

  for (const [index, recordId] of recordIds.entries()) {
    if (index % 10 === 0) options.onProgress?.(report, index, recordIds.length);
    const stored = await client.query<{ table_id: string; fields: Record<string, unknown> }>(
      'SELECT table_id, fields FROM records WHERE base_id = $1 AND record_id = $2 AND deleted_at IS NULL',
      [baseId, recordId],
    );
    const row = stored.rows[0];
    const raw = row?.fields[METADATA_FIELD];
    if (!row || typeof raw !== 'string') continue;
    let entries: Entry[];
    try { entries = JSON.parse(raw) as Entry[]; } catch { continue; }
    if (!Array.isArray(entries)) continue;
    report.records += 1;

    const replacements = new Map<string, { url: string; filename: string }>();
    for (const entry of entries) {
      const url = typeof entry.url === 'string' ? entry.url : '';
      const fileId = extractGoogleDriveFileId(url);
      if (!fileId) continue;
      report.images += 1;
      if (!apply) continue;
      try {
        const file = await download(fileId);
        report.bytes += file.bytes.length;
        if (looksLikeHtml(file.bytes)) { report.skipped += 1; continue; }
        const stage = safeSegment(String(entry.sourceStage ?? 'photos'), 'photos');
        const filename = typeof entry.filename === 'string' ? entry.filename : '';
        const base = `used-gear-workflow/${safeSegment(recordId, 'record')}/${stage}/${fileId}-${safeSegment(filename, 'image')}`;
        let key = base;
        let storedName = filename;
        if (isHeic(file.bytes, file.contentType, filename)) {
          await media.put(base, file.bytes, 'image/heic');
          const jpeg = await convertHeic(file.bytes);
          key = `${base.replace(/\.[^./]+$/, '')}.jpg`;
          storedName = filename.replace(/\.[^.]+$/, '') + '.jpg';
          await media.put(key, jpeg, 'image/jpeg');
          report.converted += 1;
        } else {
          await media.put(base, file.bytes, guessType(file.bytes, file.contentType));
        }
        replacements.set(url, { url: media.publicUrl(key), filename: storedName });
        report.copied += 1;
      } catch (error) {
        report.failed += 1;
        report.failures.push({ recordId, url, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    if (!apply || replacements.size === 0) continue;
    // Re-read under the row lock so a concurrent edit is not overwritten.
    await client.query('BEGIN');
    try {
      const locked = await client.query<{ fields: Record<string, unknown> }>(
        'SELECT fields FROM records WHERE base_id = $1 AND table_id = $2 AND record_id = $3 FOR UPDATE',
        [baseId, row.table_id, recordId],
      );
      const fields = locked.rows[0].fields;
      const current = JSON.parse(String(fields[METADATA_FIELD] ?? '[]')) as Entry[];
      const next = current.map((entry) => {
        const swap = replacements.get(String(entry.url ?? ''));
        return swap ? { ...entry, url: swap.url, filename: swap.filename, legacyUrl: entry.url } : entry;
      });
      const metadata = JSON.stringify(next);
      await client.query(
        'UPDATE records SET fields = $4::jsonb WHERE base_id = $1 AND table_id = $2 AND record_id = $3',
        [baseId, row.table_id, recordId, JSON.stringify({ ...fields, [METADATA_FIELD]: metadata })],
      );
      await syncWorkflowImages(client, baseId, recordId, metadata);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  return report;
}
