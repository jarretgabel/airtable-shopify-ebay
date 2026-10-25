import type { Pool, PoolClient } from 'pg';
import type { MediaStore } from '../providers/media/mediaStore.js';

export interface AirtableAttachmentLike {
  id: string;
  url: string;
  filename?: string;
  type?: string;
  size?: number;
  s3Key?: string;
}

export interface CopyAttachmentsReport {
  records: number;
  files: number;
  bytes: number;
  copied: number;
  skipped: number;
}

export interface CopyAttachmentsOptions {
  client: Pick<PoolClient, 'query'> | Pick<Pool, 'query'>;
  baseId: string;
  tableId: string;
  fieldName: string;
  /** Records read from Airtable just now, so their attachment URLs have not expired. */
  records: Array<{ id: string; fields: Record<string, unknown> }>;
  media: MediaStore;
  download: (url: string) => Promise<Buffer>;
  apply: boolean;
}

function safeName(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').slice(0, 120) || 'file';
}

/** Copies one attachment field of a table into S3 and repoints the Postgres copy. Airtable is only read. */
export async function copyAttachmentsForField(options: CopyAttachmentsOptions): Promise<CopyAttachmentsReport> {
  const { client, baseId, tableId, fieldName, records, media, download, apply } = options;
  const report: CopyAttachmentsReport = { records: 0, files: 0, bytes: 0, copied: 0, skipped: 0 };

  for (const record of records) {
    const items = record.fields[fieldName];
    if (!Array.isArray(items) || items.length === 0) continue;
    report.records += 1;

    const stored = await client.query<{ fields: Record<string, unknown> }>(
      'SELECT fields FROM records WHERE base_id = $1 AND table_id = $2 AND record_id = $3 AND deleted_at IS NULL',
      [baseId, tableId, record.id],
    );
    const current = stored.rows[0]?.fields[fieldName];
    const done = new Set(
      (Array.isArray(current) ? current as AirtableAttachmentLike[] : []).filter((item) => item.s3Key).map((item) => item.id),
    );

    const replacements = new Map<string, Record<string, unknown>>();
    for (const item of items as AirtableAttachmentLike[]) {
      report.files += 1;
      report.bytes += item.size ?? 0;
      if (done.has(item.id) || !stored.rows[0]) {
        report.skipped += 1;
        continue;
      }
      if (!apply) continue;
      const body = await download(item.url);
      const key = `${tableId}/${record.id}/${item.id}/${safeName(item.filename ?? item.id)}`;
      await media.put(key, body, item.type ?? 'application/octet-stream');
      replacements.set(item.id, {
        id: item.id,
        url: media.publicUrl(key),
        filename: item.filename,
        type: item.type,
        size: body.length,
        s3Key: key,
        airtableUrl: item.url,
      });
      report.copied += 1;
    }

    if (apply && replacements.size > 0) {
      // Re-read under the row lock so a concurrent edit is not overwritten.
      await client.query('BEGIN');
      try {
        const locked = await client.query<{ fields: Record<string, unknown> }>(
          'SELECT fields FROM records WHERE base_id = $1 AND table_id = $2 AND record_id = $3 FOR UPDATE',
          [baseId, tableId, record.id],
        );
        const fields = locked.rows[0].fields;
        const existing = Array.isArray(fields[fieldName]) ? fields[fieldName] as AirtableAttachmentLike[] : [];
        const next = existing.map((item) => replacements.get(item.id) ?? item);
        await client.query(
          'UPDATE records SET fields = $4::jsonb WHERE base_id = $1 AND table_id = $2 AND record_id = $3',
          [baseId, tableId, record.id, JSON.stringify({ ...fields, [fieldName]: next })],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  }
  return report;
}
