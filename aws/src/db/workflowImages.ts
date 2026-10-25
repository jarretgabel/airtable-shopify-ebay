/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Queryable } from './sellersSummary.js';

const STAGES = new Set(['intake', 'testing', 'photos']);
const KNOWN_KEYS = new Set([
  'url', 'attachmentId', 'filename', 'alt', 'imageRole', 'customImageRole', 'sortOrder',
  'sourceStage', 'includedInListing', 'ebayHostedImageCache', 'createdAt', 'updatedAt',
]);

export interface WorkflowImageRow {
  url: string;
  stage: string;
  s3Key: string | null;
  legacyUrl: string | null;
  attachmentId: string | null;
  filename: string;
  alt: string;
  role: string | null;
  customRole: string | null;
  sortOrder: number;
  included: boolean;
  ebayHostedCache: unknown;
  extra: Record<string, unknown>;
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function mediaKey(url: string): string | null {
  const match = /\/api\/media\/(used-gear-workflow\/[^?#]+)/.exec(url);
  return match ? match[1] : null;
}

/** Parses the metadata JSON text into rows; entries without a url are dropped, duplicates keep the first. */
export function parseWorkflowImageRows(metadataJson: unknown): WorkflowImageRow[] {
  let parsed: unknown = metadataJson;
  if (typeof metadataJson === 'string') {
    try { parsed = JSON.parse(metadataJson); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const rows: WorkflowImageRow[] = [];
  parsed.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const e = entry as Record<string, unknown>;
    const url = str(e.url);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(e)) if (!KNOWN_KEYS.has(key)) extra[key] = value;
    const stage = str(e.sourceStage);
    rows.push({
      url,
      stage: STAGES.has(stage) ? stage : 'photos',
      s3Key: mediaKey(url),
      legacyUrl: str(extra.legacyUrl) || null,
      attachmentId: str(e.attachmentId) || null,
      filename: str(e.filename),
      alt: str(e.alt),
      role: str(e.imageRole) || null,
      customRole: str(e.customImageRole) || null,
      sortOrder: typeof e.sortOrder === 'number' && Number.isFinite(e.sortOrder) ? Math.trunc(e.sortOrder) : index,
      included: e.includedInListing === true,
      ebayHostedCache: e.ebayHostedImageCache ?? null,
      extra,
    });
  });
  return rows;
}

/** Rebuilds the metadata JSON text from rows, ordered by sort order. */
export function assembleWorkflowImageMetadata(rows: WorkflowImageRow[]): string {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  return JSON.stringify(sorted.map((row) => ({
    ...row.extra,
    ...(row.attachmentId ? { attachmentId: row.attachmentId } : {}),
    url: row.url,
    filename: row.filename,
    alt: row.alt,
    ...(row.role ? { imageRole: row.role } : {}),
    ...(row.customRole ? { customImageRole: row.customRole } : {}),
    sortOrder: row.sortOrder,
    sourceStage: row.stage,
    includedInListing: row.included,
    ...(row.ebayHostedCache ? { ebayHostedImageCache: row.ebayHostedCache } : {}),
  })));
}

/** Replaces a record's rows with the entries of the given metadata JSON. */
export async function syncWorkflowImages(
  db: Queryable,
  baseId: string,
  recordId: string,
  metadataJson: unknown,
): Promise<number> {
  const rows = parseWorkflowImageRows(metadataJson);
  await db.query('DELETE FROM workflow_images WHERE base_id = $1 AND record_id = $2', [baseId, recordId]);
  if (rows.length === 0) return 0;
  const payload = rows.map((row) => ({
    url: row.url, stage: row.stage, s3_key: row.s3Key, legacy_url: row.legacyUrl, attachment_id: row.attachmentId,
    filename: row.filename, alt: row.alt, role: row.role, custom_role: row.customRole, sort_order: row.sortOrder,
    included: row.included, ebay_hosted_cache: row.ebayHostedCache, extra: row.extra,
  }));
  await db.query(
    `INSERT INTO workflow_images (base_id, record_id, url, stage, s3_key, legacy_url, attachment_id, filename, alt,
       role, custom_role, sort_order, included, ebay_hosted_cache, extra)
     SELECT $1, $2, x.url, x.stage, x.s3_key, x.legacy_url, x.attachment_id, x.filename, x.alt, x.role, x.custom_role,
       x.sort_order, x.included, x.ebay_hosted_cache, x.extra
     FROM jsonb_to_recordset($3::jsonb) AS x(url text, stage text, s3_key text, legacy_url text, attachment_id text,
       filename text, alt text, role text, custom_role text, sort_order int, included boolean,
       ebay_hosted_cache jsonb, extra jsonb)`,
    [baseId, recordId, JSON.stringify(payload)],
  );
  return rows.length;
}

export async function loadWorkflowImageMetadata(db: Queryable, baseId: string, recordId: string): Promise<string> {
  const result = await db.query(
    `SELECT url, stage, s3_key, legacy_url, attachment_id, filename, alt, role, custom_role, sort_order, included,
            ebay_hosted_cache, extra FROM workflow_images WHERE base_id = $1 AND record_id = $2 ORDER BY sort_order`,
    [baseId, recordId],
  );
  return assembleWorkflowImageMetadata((result.rows as Array<Record<string, any>>).map((r) => ({
    url: r.url, stage: r.stage, s3Key: r.s3_key, legacyUrl: r.legacy_url, attachmentId: r.attachment_id,
    filename: r.filename, alt: r.alt, role: r.role, customRole: r.custom_role, sortOrder: r.sort_order,
    included: r.included, ebayHostedCache: r.ebay_hosted_cache, extra: r.extra ?? {},
  })));
}

const METADATA_FIELD_NAMES = new Set(['workflowimagemetadatajson', 'workflowimagemetadata', 'imagemetadatajson']);

/** The patch entry that carries the workflow image metadata JSON, if any (null value means cleared). */
export function findWorkflowImageMetadataPatch(fields: Record<string, unknown>): { value: unknown } | null {
  const name = Object.keys(fields).find((key) => METADATA_FIELD_NAMES.has(key.trim().toLowerCase().replace(/[^a-z0-9]/g, '')));
  return name ? { value: fields[name] } : null;
}
