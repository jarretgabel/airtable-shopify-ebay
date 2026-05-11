import { parseImageEditorRows, toCommaSeparatedImageValues, type ImageEditorRow } from '@/components/approval/approvalFormFieldsImageHelpers';
import {
  getIncludedWorkflowImageMetadata,
  parseWorkflowImageMetadata,
  type WorkflowImageMetadataRecord,
} from '@/services/workflowImageMetadata';

export interface WorkflowListingImageAttachment {
  id?: string;
  url: string;
  filename: string;
  type?: string;
  size?: number;
  width?: number;
  height?: number;
  thumbnails?: Record<string, unknown>;
}

export interface WorkflowListingImageRow {
  src: string;
  alt: string;
  position: number;
}

function normalizeWorkflowImageFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isWorkflowImageAttachmentFieldName(fieldName: string): boolean {
  const normalized = normalizeWorkflowImageFieldName(fieldName);
  return normalized === 'images'
    || normalized === 'workflowimages'
    || normalized === 'workflowphotos'
    || normalized === 'photographyimages'
    || normalized === 'testingimages';
}

export function isWorkflowImageMetadataFieldName(fieldName: string): boolean {
  const normalized = normalizeWorkflowImageFieldName(fieldName);
  return normalized === 'workflowimagemetadatajson'
    || normalized === 'workflowimagemetadata'
    || normalized === 'imagemetadatajson';
}

export function findWorkflowImageAttachmentFieldName(fieldNames: string[]): string | undefined {
  const preferredFieldNames = ['Images', 'Workflow Images', 'Workflow Photos'];

  for (const preferredFieldName of preferredFieldNames) {
    const match = fieldNames.find((fieldName) => normalizeWorkflowImageFieldName(fieldName) === normalizeWorkflowImageFieldName(preferredFieldName));
    if (match) return match;
  }

  return fieldNames.find((fieldName) => isWorkflowImageAttachmentFieldName(fieldName));
}

export function findWorkflowImageMetadataFieldName(fieldNames: string[]): string | undefined {
  const preferredFieldNames = ['Workflow Image Metadata JSON', 'Workflow Image Metadata'];

  for (const preferredFieldName of preferredFieldNames) {
    const match = fieldNames.find((fieldName) => normalizeWorkflowImageFieldName(fieldName) === normalizeWorkflowImageFieldName(preferredFieldName));
    if (match) return match;
  }

  return fieldNames.find((fieldName) => isWorkflowImageMetadataFieldName(fieldName));
}

function parseAttachmentThumbnailUrl(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const thumbnailRecord = raw as Record<string, unknown>;
  const large = thumbnailRecord.large;
  if (large && typeof large === 'object' && typeof (large as Record<string, unknown>).url === 'string') {
    return ((large as Record<string, unknown>).url as string).trim() || undefined;
  }

  const full = thumbnailRecord.full;
  if (full && typeof full === 'object' && typeof (full as Record<string, unknown>).url === 'string') {
    return ((full as Record<string, unknown>).url as string).trim() || undefined;
  }

  return undefined;
}

function coerceWorkflowAttachment(entry: unknown): WorkflowListingImageAttachment | null {
  if (!entry || typeof entry !== 'object') return null;

  const record = entry as Record<string, unknown>;
  const directUrl = typeof record.url === 'string' ? record.url.trim() : '';
  const srcUrl = typeof record.src === 'string' ? record.src.trim() : '';
  const thumbnailUrl = parseAttachmentThumbnailUrl(record.thumbnails);
  const url = directUrl || srcUrl || thumbnailUrl || '';
  if (!url) return null;

  const filename = typeof record.filename === 'string'
    ? record.filename.trim()
    : typeof record.name === 'string'
      ? record.name.trim()
      : url.split('/').pop()?.trim() ?? '';

  return {
    id: typeof record.id === 'string' ? record.id : undefined,
    url,
    filename: filename || 'Image',
    type: typeof record.type === 'string' ? record.type : undefined,
    size: typeof record.size === 'number' ? record.size : undefined,
    width: typeof record.width === 'number' ? record.width : undefined,
    height: typeof record.height === 'number' ? record.height : undefined,
    thumbnails: record.thumbnails && typeof record.thumbnails === 'object' ? record.thumbnails as Record<string, unknown> : undefined,
  };
}

export function parseWorkflowImageAttachments(raw: unknown): WorkflowListingImageAttachment[] {
  const values = (() => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string') return [] as unknown[];

    const trimmed = raw.trim();
    if (!trimmed) return [] as unknown[];

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [] as unknown[];
    }
  })();
  const seen = new Set<string>();

  return values
    .map(coerceWorkflowAttachment)
    .filter((attachment): attachment is WorkflowListingImageAttachment => attachment !== null)
    .filter((attachment) => {
      const key = attachment.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildWorkflowListingImageRowsFromMetadata(metadata: WorkflowImageMetadataRecord[]): WorkflowListingImageRow[] {
  return getIncludedWorkflowImageMetadata(metadata).map((record, index) => ({
    src: record.url,
    alt: record.alt,
    position: index + 1,
  }));
}

export function buildWorkflowListingSelectionFromMetadata(metadata: WorkflowImageMetadataRecord[]): string[] {
  return buildWorkflowListingImageRowsFromMetadata(metadata).map((row) => row.src);
}

export function parseWorkflowListingImageRowsFromMetadata(raw: unknown): WorkflowListingImageRow[] {
  return buildWorkflowListingImageRowsFromMetadata(parseWorkflowImageMetadata(raw));
}

export function parseWorkflowSelectedImageRows(
  imageValue: string,
  imageAltTextValue: string,
  shopifyImagePayloadValue?: string,
): WorkflowListingImageRow[] {
  const payloadRows = shopifyImagePayloadValue ? parseImageEditorRows(shopifyImagePayloadValue) : [];
  const imageRows = parseImageEditorRows(imageValue);
  const altParts = imageAltTextValue
    .split(/\r?\n|,/)
    .map((part) => part.trim());
  const rowCount = Math.max(payloadRows.length, imageRows.length, altParts.filter(Boolean).length);

  if (rowCount === 0) return [];

  return Array.from({ length: rowCount }, (_unused, index) => {
    const payloadRow = payloadRows[index];
    const imageRow = imageRows[index];
    const src = payloadRow?.src?.trim() || imageRow?.src?.trim() || '';
    const alt = payloadRow?.alt?.trim() || altParts[index] || imageRow?.alt?.trim() || '';
    return {
      src,
      alt,
      position: index + 1,
    };
  }).filter((row) => row.src.length > 0);
}

export function buildWorkflowListingImageSelectionValues({
  selectedUrls,
  attachments,
  currentRows,
}: {
  selectedUrls: string[];
  attachments: WorkflowListingImageAttachment[];
  currentRows: WorkflowListingImageRow[];
}): {
  imageValue: string;
  imageAltTextValue: string;
  shopifyImagePayloadValue: string;
} {
  const altByUrl = new Map<string, string>();
  currentRows.forEach((row) => {
    const key = row.src.trim().toLowerCase();
    if (!key || altByUrl.has(key)) return;
    altByUrl.set(key, row.alt.trim());
  });

  const attachmentLookup = new Map(
    attachments
      .map((attachment) => [attachment.url.trim().toLowerCase(), attachment.url.trim()] as const)
      .filter((entry) => entry[1].length > 0),
  );
  const orderedUrls: string[] = [];
  const seen = new Set<string>();

  selectedUrls.forEach((url) => {
    const trimmed = url.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    orderedUrls.push(attachmentLookup.get(key) ?? trimmed);
  });

  const rows: WorkflowListingImageRow[] = orderedUrls.map((url, index) => ({
    src: url,
    alt: altByUrl.get(url.toLowerCase()) ?? '',
    position: index + 1,
  }));
  const altValues = rows.map((row) => row.alt);

  return {
    imageValue: toCommaSeparatedImageValues(rows.map((row) => row.src)),
    imageAltTextValue: altValues.some((altValue) => altValue.trim().length > 0) ? toCommaSeparatedImageValues(altValues) : '',
    shopifyImagePayloadValue: rows.length > 0 ? JSON.stringify(rows) : '',
  };
}

export function toWorkflowListingImageEditorRows(rows: WorkflowListingImageRow[]): ImageEditorRow[] {
  return rows.map((row) => ({ src: row.src, alt: row.alt }));
}