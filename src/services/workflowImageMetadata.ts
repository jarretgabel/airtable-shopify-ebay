export type WorkflowImageSourceStage = 'testing' | 'photos';

export interface WorkflowImageMetadataRecord {
  attachmentId?: string;
  url: string;
  filename: string;
  alt: string;
  sortOrder: number;
  sourceStage: WorkflowImageSourceStage;
  includedInListing: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowImageAttachmentLike {
  id?: string;
  url?: string;
  filename: string;
}

interface WorkflowImageAttachmentRecord {
  attachmentId?: string;
  url: string;
  filename: string;
}

function normalizeStage(value: unknown): WorkflowImageSourceStage {
  return value === 'testing' ? 'testing' : 'photos';
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeSortOrder(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

function buildFilename(url: string, fallback: string): string {
  const trimmedFallback = fallback.trim();
  if (trimmedFallback) return trimmedFallback;

  const urlPart = url.split('/').pop()?.trim() ?? '';
  return urlPart || 'Image';
}

function normalizeMetadataRecord(value: unknown, fallbackOrder: number): WorkflowImageMetadataRecord | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const url = normalizeString(record.url)
    || normalizeString(record.src)
    || normalizeString(record.originalSource)
    || normalizeString(record.original_source);
  if (!url) return null;

  return {
    attachmentId: normalizeString(record.attachmentId) || normalizeString(record.attachment_id) || normalizeString(record.id) || undefined,
    url,
    filename: buildFilename(url, normalizeString(record.filename) || normalizeString(record.name)),
    alt: normalizeString(record.alt) || normalizeString(record.altText) || normalizeString(record.alt_text),
    sortOrder: normalizeSortOrder(record.sortOrder ?? record.sort_order ?? record.position, fallbackOrder),
    sourceStage: normalizeStage(record.sourceStage ?? record.source_stage),
    includedInListing: normalizeBoolean(record.includedInListing ?? record.included_in_listing, true),
    createdAt: normalizeString(record.createdAt) || normalizeString(record.created_at) || undefined,
    updatedAt: normalizeString(record.updatedAt) || normalizeString(record.updated_at) || undefined,
  };
}

function parseRawMetadataInput(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        const parsedRecord = parsed as Record<string, unknown>;
        const nested = parsedRecord.records ?? parsedRecord.images ?? parsedRecord.items ?? parsedRecord.data;
        if (Array.isArray(nested)) return nested;
        return [parsed];
      }
    } catch {
      return [];
    }

    return [];
  }

  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const nested = record.records ?? record.images ?? record.items ?? record.data;
    if (Array.isArray(nested)) return nested;
    return [raw];
  }

  return [];
}

function compactAndSortRecords(records: WorkflowImageMetadataRecord[]): WorkflowImageMetadataRecord[] {
  return [...records]
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      return left.url.localeCompare(right.url);
    })
    .map((record, index) => ({
      ...record,
      sortOrder: index + 1,
    }));
}

function compactRecordsInCurrentOrder(records: WorkflowImageMetadataRecord[]): WorkflowImageMetadataRecord[] {
  return records.map((record, index) => ({
    ...record,
    sortOrder: index + 1,
  }));
}

function parseAttachmentThumbnailUrl(value: unknown): string {
  if (!value || typeof value !== 'object') return '';

  const thumbnails = value as Record<string, unknown>;
  const large = thumbnails.large;
  if (large && typeof large === 'object' && typeof (large as Record<string, unknown>).url === 'string') {
    return ((large as Record<string, unknown>).url as string).trim();
  }

  const full = thumbnails.full;
  if (full && typeof full === 'object' && typeof (full as Record<string, unknown>).url === 'string') {
    return ((full as Record<string, unknown>).url as string).trim();
  }

  return '';
}

function normalizeAttachmentRecord(value: unknown): WorkflowImageAttachmentRecord | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const url = normalizeString(record.url)
    || normalizeString(record.src)
    || normalizeString(record.originalSource)
    || normalizeString(record.original_source)
    || parseAttachmentThumbnailUrl(record.thumbnails);
  if (!url) return null;

  return {
    attachmentId: normalizeString(record.id) || normalizeString(record.attachmentId) || normalizeString(record.attachment_id) || undefined,
    url,
    filename: buildFilename(url, normalizeString(record.filename) || normalizeString(record.name)),
  };
}

function dedupeMetadataRecords(records: WorkflowImageMetadataRecord[]): WorkflowImageMetadataRecord[] {
  const seen = new Set<string>();

  return records.filter((record) => {
    const key = record.attachmentId ? `id:${record.attachmentId.toLowerCase()}` : `url:${record.url.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeAttachments(records: WorkflowImageAttachmentRecord[]): WorkflowImageAttachmentRecord[] {
  const seen = new Set<string>();

  return records.filter((record) => {
    const key = record.attachmentId ? `id:${record.attachmentId.toLowerCase()}` : `url:${record.url.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findMetadataRecord(
  attachment: WorkflowImageAttachmentRecord,
  byAttachmentId: Map<string, WorkflowImageMetadataRecord>,
  byUrl: Map<string, WorkflowImageMetadataRecord>,
): WorkflowImageMetadataRecord | undefined {
  const attachmentId = attachment.attachmentId?.toLowerCase();
  if (attachmentId && byAttachmentId.has(attachmentId)) {
    return byAttachmentId.get(attachmentId);
  }

  return byUrl.get(attachment.url.toLowerCase());
}

export function parseWorkflowImageMetadata(raw: unknown): WorkflowImageMetadataRecord[] {
  const values = parseRawMetadataInput(raw);

  return compactAndSortRecords(
    dedupeMetadataRecords(
      values
        .map((value, index) => normalizeMetadataRecord(value, index + 1))
        .filter((record): record is WorkflowImageMetadataRecord => record !== null),
    ),
  );
}

export function serializeWorkflowImageMetadata(records: WorkflowImageMetadataRecord[]): string {
  if (records.length === 0) return '';
  return JSON.stringify(compactAndSortRecords(records));
}

export function getSortedWorkflowImageMetadata(records: WorkflowImageMetadataRecord[]): WorkflowImageMetadataRecord[] {
  return compactAndSortRecords(records);
}

export function getIncludedWorkflowImageMetadata(records: WorkflowImageMetadataRecord[]): WorkflowImageMetadataRecord[] {
  return compactAndSortRecords(records).filter((record) => record.includedInListing);
}

export function filterWorkflowImageMetadataByStage(
  records: WorkflowImageMetadataRecord[],
  stage: WorkflowImageSourceStage,
): WorkflowImageMetadataRecord[] {
  return compactAndSortRecords(records).filter((record) => record.sourceStage === stage);
}

export function replaceWorkflowImageMetadataStage(
  records: WorkflowImageMetadataRecord[],
  stage: WorkflowImageSourceStage,
  nextStageRecords: WorkflowImageMetadataRecord[],
): WorkflowImageMetadataRecord[] {
  const sortedRecords = compactAndSortRecords(records);
  const normalizedStageRecords = compactAndSortRecords(nextStageRecords).map((record) => ({
    ...record,
    sourceStage: stage,
  }));
  const nextRecords: WorkflowImageMetadataRecord[] = [];
  let stageIndex = 0;

  sortedRecords.forEach((record) => {
    if (record.sourceStage !== stage) {
      nextRecords.push(record);
      return;
    }

    const replacement = normalizedStageRecords[stageIndex];
    stageIndex += 1;
    if (replacement) {
      nextRecords.push(replacement);
    }
  });

  while (stageIndex < normalizedStageRecords.length) {
    nextRecords.push(normalizedStageRecords[stageIndex]!);
    stageIndex += 1;
  }

  return compactAndSortRecords(nextRecords);
}

export function filterWorkflowAttachmentsByStage<T extends WorkflowImageAttachmentLike>(
  attachments: T[],
  records: WorkflowImageMetadataRecord[],
  stage: WorkflowImageSourceStage,
): T[] {
  const stageRecords = filterWorkflowImageMetadataByStage(records, stage);
  if (stageRecords.length === 0) {
    return [];
  }

  const stageAttachmentIds = new Set(
    stageRecords
      .map((record) => record.attachmentId?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
  const stageUrls = new Set(stageRecords.map((record) => record.url.trim().toLowerCase()));

  return attachments.filter((attachment) => {
    const attachmentId = attachment.id?.trim().toLowerCase();
    if (attachmentId && stageAttachmentIds.has(attachmentId)) {
      return true;
    }

    const url = attachment.url?.trim().toLowerCase();
    return Boolean(url && stageUrls.has(url));
  });
}

export function mergeWorkflowImageMetadata(params: {
  attachments: Array<Record<string, unknown>>;
  existingMetadata: WorkflowImageMetadataRecord[];
  sourceStage: WorkflowImageSourceStage;
  nowIso: string;
}): WorkflowImageMetadataRecord[] {
  const attachments = dedupeAttachments(
    params.attachments
      .map((attachment) => normalizeAttachmentRecord(attachment))
      .filter((record): record is WorkflowImageAttachmentRecord => record !== null),
  );
  if (attachments.length === 0) return [];

  const existing = compactAndSortRecords(params.existingMetadata);
  const byAttachmentId = new Map(
    existing
      .filter((record) => record.attachmentId)
      .map((record) => [record.attachmentId!.toLowerCase(), record] as const),
  );
  const byUrl = new Map(existing.map((record) => [record.url.toLowerCase(), record] as const));
  const matchedKeys = new Set<string>();
  const matchedExisting: WorkflowImageMetadataRecord[] = [];
  const appendedNew: WorkflowImageMetadataRecord[] = [];

  attachments.forEach((attachment) => {
    const match = findMetadataRecord(attachment, byAttachmentId, byUrl);

    if (match) {
      matchedKeys.add(match.attachmentId ? `id:${match.attachmentId.toLowerCase()}` : `url:${match.url.toLowerCase()}`);
      matchedExisting.push({
        ...match,
        attachmentId: attachment.attachmentId ?? match.attachmentId,
        url: attachment.url,
        filename: attachment.filename,
      });
      return;
    }

    appendedNew.push({
      attachmentId: attachment.attachmentId,
      url: attachment.url,
      filename: attachment.filename,
      alt: '',
      sortOrder: existing.length + appendedNew.length + 1,
      sourceStage: params.sourceStage,
      includedInListing: true,
      createdAt: params.nowIso,
      updatedAt: params.nowIso,
    });
  });

  const retainedExisting = compactAndSortRecords(matchedExisting).filter((record) => {
    const key = record.attachmentId ? `id:${record.attachmentId.toLowerCase()}` : `url:${record.url.toLowerCase()}`;
    return matchedKeys.has(key);
  });

  return compactAndSortRecords([...retainedExisting, ...appendedNew]);
}

export function reorderWorkflowImageMetadata(
  records: WorkflowImageMetadataRecord[],
  orderedUrls: string[],
): WorkflowImageMetadataRecord[] {
  const sortedRecords = compactAndSortRecords(records);
  const byUrl = new Map(sortedRecords.map((record) => [record.url.toLowerCase(), record] as const));
  const seen = new Set<string>();
  const reordered: WorkflowImageMetadataRecord[] = [];

  orderedUrls.forEach((url) => {
    const key = url.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    const record = byUrl.get(key);
    if (!record) return;
    seen.add(key);
    reordered.push(record);
  });

  sortedRecords.forEach((record) => {
    const key = record.url.toLowerCase();
    if (seen.has(key)) return;
    reordered.push(record);
  });

  return compactRecordsInCurrentOrder(reordered);
}

export function updateWorkflowImageAltText(
  records: WorkflowImageMetadataRecord[],
  url: string,
  alt: string,
  nowIso: string,
): WorkflowImageMetadataRecord[] {
  const key = url.trim().toLowerCase();
  return compactAndSortRecords(records).map((record) => (
    record.url.toLowerCase() === key
      ? {
          ...record,
          alt,
          updatedAt: nowIso,
        }
      : record
  ));
}

export function updateWorkflowImageInclusion(
  records: WorkflowImageMetadataRecord[],
  url: string,
  includedInListing: boolean,
  nowIso: string,
): WorkflowImageMetadataRecord[] {
  const key = url.trim().toLowerCase();
  return compactAndSortRecords(records).map((record) => (
    record.url.toLowerCase() === key
      ? {
          ...record,
          includedInListing,
          updatedAt: nowIso,
        }
      : record
  ));
}