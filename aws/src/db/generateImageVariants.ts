import type { Pool, PoolClient } from 'pg';
import { IMAGE_VARIANT_WIDTHS, variantKey, type ImageVariantWidth } from '../providers/media/imageVariants.js';
import type { MediaStore } from '../providers/media/mediaStore.js';

export interface GenerateVariantsReport {
  images: number;
  created: number;
  skipped: number;
  failed: number;
  failures: Array<{ key: string; reason: string }>;
}

export interface GenerateVariantsOptions {
  client: Pick<PoolClient, 'query'> | Pick<Pool, 'query'>;
  baseId: string;
  media: MediaStore;
  /** JPEG resized to at most `width` px on the long side; never enlarged. */
  resize: (bytes: Buffer, width: ImageVariantWidth) => Promise<Buffer>;
  apply: boolean;
  limit?: number;
  onProgress?: (report: GenerateVariantsReport, done: number, total: number) => void;
}

/** Creates the missing smaller sizes for every image already in S3. Existing variants are left alone, so it is safe to re-run. */
export async function generateImageVariants(options: GenerateVariantsOptions): Promise<GenerateVariantsReport> {
  const report: GenerateVariantsReport = { images: 0, created: 0, skipped: 0, failed: 0, failures: [] };
  const rows = await options.client.query(
    `SELECT DISTINCT s3_key FROM workflow_images WHERE base_id = $1 AND s3_key IS NOT NULL AND s3_key <> '' ORDER BY s3_key`,
    [options.baseId],
  );
  const keys = (rows.rows as Array<{ s3_key: string }>).map((row) => row.s3_key).slice(0, options.limit ?? undefined);

  for (const [index, key] of keys.entries()) {
    report.images += 1;
    try {
      const missing: ImageVariantWidth[] = [];
      for (const width of IMAGE_VARIANT_WIDTHS) {
        if (await options.media.header(variantKey(key, width), 1)) report.skipped += 1;
        else missing.push(width);
      }
      if (missing.length > 0 && options.apply) {
        const source = await options.media.get(key);
        if (!source) throw new Error('source object not found');
        for (const width of missing) {
          await options.media.put(variantKey(key, width), await options.resize(source, width), 'image/jpeg');
          report.created += 1;
        }
      } else {
        report.created += missing.length;
      }
    } catch (error) {
      report.failed += 1;
      report.failures.push({ key, reason: error instanceof Error ? error.message : String(error) });
    }
    options.onProgress?.(report, index + 1, keys.length);
  }
  return report;
}
