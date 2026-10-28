import { describe, expect, it } from 'vitest';
import { mergeWorkflowImageStageEdits } from '@/services/workflowImageStageEdits';
import { parseWorkflowImageMetadata } from '@/services/workflowImageMetadata';

const rows = [
  { attachmentId: 'testing', url: '/api/media/used-gear-workflow/uc?id=testing', filename: 'testing.jpg', alt: 'Bench', sourceStage: 'testing', sortOrder: 1, includedInListing: true, annotation: 'keep testing' },
  { attachmentId: 'photos', url: '/api/media/used-gear-workflow/uc?id=photos', filename: 'brand-model-amplifier.jpg', alt: 'Hero', sourceStage: 'photos', sortOrder: 2, includedInListing: true, annotation: 'keep photos' },
];

describe('mergeWorkflowImageStageEdits', () => {
  it('leaves unchanged metadata and an empty stale draft unwritten', () => {
    expect(mergeWorkflowImageStageEdits(rows, parseWorkflowImageMetadata(rows), 'testing')).toBeUndefined();
    expect(mergeWorkflowImageStageEdits(rows, [], 'testing')).toBeUndefined();
  });

  it('preserves raw annotations, other stages and newer caches when applying a stage edit', () => {
    const original = parseWorkflowImageMetadata(rows);
    const draft = original.map((row) => ({ ...row, includedInListing: false }));
    const saved = rows.map((row) => ({ ...row, ebayHostedImageCache: { url: 'newer-cache', sha256: 'newer-fingerprint' } }));
    const result = JSON.parse(mergeWorkflowImageStageEdits(saved, draft, 'testing', original)!);
    expect(result[0]).toEqual(expect.objectContaining({ ...saved[0], includedInListing: false }));
    expect(result[1]).toEqual(saved[1]);
  });

  it('keeps concurrent additions and unrelated edits on the same photo', () => {
    const original = parseWorkflowImageMetadata(rows);
    const draft = original.map((row) => ({ ...row, includedInListing: false }));
    const added = { ...rows[1], attachmentId: 'new-photo', url: '/api/media/used-gear-workflow/uc?id=new', sortOrder: 3 };
    const saved = [{ ...rows[0], alt: 'Newer bench caption' }, rows[1], added];
    const result = JSON.parse(mergeWorkflowImageStageEdits(saved, draft, 'testing', original)!);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ alt: 'Newer bench caption', includedInListing: false });
    expect(result[2]).toEqual(added);
  });

  it('rejects conflicting edits and does not resurrect a concurrently removed photo', () => {
    const original = parseWorkflowImageMetadata(rows);
    const draft = original.map((row) => ({ ...row, alt: 'My new caption' }));
    expect(() => mergeWorkflowImageStageEdits([{ ...rows[0], alt: 'Another caption' }, rows[1]], draft, 'testing', original)).toThrow('Photos changed');
    expect(() => mergeWorkflowImageStageEdits([rows[1]], draft, 'testing', original)).toThrow('Photos changed');
  });

  it('does not reapply a stale unchanged draft or remove omitted records', () => {
    const original = parseWorkflowImageMetadata(rows);
    expect(mergeWorkflowImageStageEdits([{ ...rows[0], includedInListing: false }, rows[1]], original, 'testing', original)).toBeUndefined();
    expect(mergeWorkflowImageStageEdits(rows, [original[1]], 'testing', original)).toBeUndefined();
  });

  it('removes only the dropped stage image when removals are allowed', () => {
    const original = parseWorkflowImageMetadata(rows);
    const result = JSON.parse(mergeWorkflowImageStageEdits(rows, [], 'testing', original, { allowRemovals: true })!);
    expect(result).toEqual([rows[1]]);
  });

  it('never removes images from other stages', () => {
    const original = parseWorkflowImageMetadata(rows);
    expect(mergeWorkflowImageStageEdits(rows, [original[0]], 'testing', original, { allowRemovals: true })).toBeUndefined();
  });

  it('appends new stage images without discarding unrelated raw rows', () => {
    const added = { ...parseWorkflowImageMetadata(rows)[0], attachmentId: 'new', url: '/api/media/used-gear-workflow/uc?id=new' };
    const result = JSON.parse(mergeWorkflowImageStageEdits(rows, [added], 'testing')!);
    expect(result.slice(0, 2)).toEqual(rows);
    expect(result[2]).toMatchObject({ attachmentId: 'new', sourceStage: 'testing', sortOrder: 3 });
  });

  it('rejects malformed metadata rather than replacing it with an empty library', () => {
    expect(() => mergeWorkflowImageStageEdits('{broken', [], 'testing')).toThrow('Saved photo metadata is invalid');
  });

  it('clears legacy role aliases without losing unrelated annotations', () => {
    const legacy = [{ ...rows[0], image_role: 'front', custom_role: 'Old role' }];
    const original = parseWorkflowImageMetadata(legacy);
    const draft = original.map((row) => ({ ...row, imageRole: undefined, customImageRole: undefined }));
    const result = mergeWorkflowImageStageEdits(legacy, draft, 'testing', original)!;
    expect(parseWorkflowImageMetadata(result)[0]).toMatchObject({ imageRole: undefined, customImageRole: undefined });
    expect(JSON.parse(result)[0]).toMatchObject({ annotation: 'keep testing' });
  });

  it('rejects duplicate additions instead of creating duplicate source identities', () => {
    const [addition] = parseWorkflowImageMetadata(rows);
    expect(() => mergeWorkflowImageStageEdits([], [addition, addition], 'testing')).toThrow('duplicate identities');
  });

  it('appends after non-contiguous saved sort orders without changing existing order', () => {
    const saved = rows.map((row, index) => ({ ...row, sortOrder: (index + 1) * 10 }));
    const added = { ...parseWorkflowImageMetadata(rows)[0], attachmentId: 'new', url: '/api/media/used-gear-workflow/uc?id=new' };
    const result = JSON.parse(mergeWorkflowImageStageEdits(saved, [added], 'testing')!);
    expect(result.slice(0, 2)).toEqual(saved);
    expect(result[2].sortOrder).toBe(21);
  });
});
