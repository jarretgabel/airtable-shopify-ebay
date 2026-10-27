import { parseWorkflowImageMetadata, type WorkflowImageMetadataRecord, type WorkflowImageSourceStage } from './workflowImageMetadata';

const EDITABLE_FIELDS = ['alt', 'imageRole', 'customImageRole', 'includedInListing', 'sortOrder'] as const;
const FIELD_ALIASES = {
  alt: ['altText', 'alt_text'],
  imageRole: ['image_role', 'role', 'imageCategory', 'image_category'],
  customImageRole: ['custom_image_role', 'customRole', 'custom_role'],
  includedInListing: ['included_in_listing', 'includeInListing', 'include_in_listing', 'included', 'isIncluded'],
  sortOrder: ['sort_order', 'position'],
} satisfies Record<(typeof EDITABLE_FIELDS)[number], string[]>;

export class WorkflowImageEditError extends Error {}

export function imageKey(record: WorkflowImageMetadataRecord): string {
  return record.attachmentId ? `id:${record.attachmentId}` : `url:${record.url.trim()}`;
}

function readEntries(raw: unknown): Record<string, unknown>[] {
  if (raw === undefined || raw === null || raw === '') return [];
  let entries: unknown = raw;
  if (typeof raw === 'string') {
    try {
      entries = JSON.parse(raw);
    } catch {
      throw new WorkflowImageEditError('Saved photo metadata is invalid. Reload and resolve it before editing photos.');
    }
  }
  if (!Array.isArray(entries) || !entries.every((entry): entry is Record<string, unknown> => (
    Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
  ))) {
    throw new WorkflowImageEditError('Saved photo metadata is not an image array. Reload before editing photos.');
  }
  return entries;
}

export function mergeWorkflowImageStageEdits(
  raw: unknown,
  nextMetadata: WorkflowImageMetadataRecord[],
  stage: WorkflowImageSourceStage,
  originalMetadata?: WorkflowImageMetadataRecord[],
): string | undefined {
  const entries = readEntries(raw);
  const saved = parseWorkflowImageMetadata(entries);
  const savedByKey = new Map(saved.map((record) => [imageKey(record), record]));
  const originals = originalMetadata ?? saved;
  const originalByKey = new Map(originals.map((record) => [imageKey(record), record]));
  const patches = new Map<string, Record<string, unknown>>();
  const additions: WorkflowImageMetadataRecord[] = [];
  const nextKeys = new Set<string>();
  let nextOrder = entries.reduce((maximum, entry) => {
    const rawOrder = entry.sortOrder ?? entry.sort_order ?? entry.position;
    const order = typeof rawOrder === 'number' ? rawOrder : Number.parseInt(String(rawOrder), 10);
    return Number.isFinite(order) ? Math.max(maximum, Math.floor(order)) : maximum;
  }, saved.length);

  for (const next of nextMetadata.filter((record) => record.sourceStage === stage)) {
    const key = imageKey(next);
    if (nextKeys.has(key)) {
      throw new WorkflowImageEditError('Photo edits contain duplicate identities. Reload before saving photos.');
    }
    nextKeys.add(key);
    const original = originalByKey.get(key);
    const current = savedByKey.get(key);
    const changedFields = EDITABLE_FIELDS.filter((field) => !original || next[field] !== original[field]);
    if (changedFields.length === 0) continue;

    if (!current) {
      if (original) {
        throw new WorkflowImageEditError('Photos changed since this form was loaded. Reload before saving photo edits.');
      }
      additions.push({ ...next, sortOrder: ++nextOrder });
      continue;
    }
    if (current.sourceStage !== stage || (original && original.sourceStage !== stage)) {
      throw new WorkflowImageEditError('A photo moved to another workflow stage. Reload before saving photo edits.');
    }
    const patch: Record<string, unknown> = {};
    for (const field of changedFields) {
      if (original && current[field] !== original[field] && current[field] !== next[field]) {
        throw new WorkflowImageEditError('Photos changed since this form was loaded. Reload before saving photo edits.');
      }
      if (current[field] !== next[field]) patch[field] = next[field];
    }
    if (Object.keys(patch).length > 0) patches.set(key, patch);
  }
  if (patches.size === 0 && additions.length === 0) return undefined;

  const seen = new Set<string>();
  const nextEntries = entries.map((entry) => {
    const record = parseWorkflowImageMetadata([entry])[0];
    if (!record) return entry;
    const key = imageKey(record);
    if (seen.has(key)) {
      throw new WorkflowImageEditError('Saved photos contain duplicate identities. Reload and resolve them before editing photos.');
    }
    seen.add(key);
    const patch = patches.get(key);
    if (!patch) return entry;
    const nextEntry: Record<string, unknown> = { ...entry, ...patch, updatedAt: new Date().toISOString() };
    for (const field of EDITABLE_FIELDS) {
      if (field in patch) {
        for (const alias of FIELD_ALIASES[field]) delete nextEntry[alias];
      }
    }
    return nextEntry;
  });
  return JSON.stringify([...nextEntries, ...additions]);
}
