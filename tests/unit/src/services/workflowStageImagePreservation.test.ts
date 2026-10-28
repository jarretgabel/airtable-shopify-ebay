import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestingFormDefaults } from '@/components/tabs/testing/testingFormSchema';
import { createPhotosFormDefaults } from '@/components/tabs/photos/photosFormSchema';
import { parseWorkflowImageMetadata } from '@/services/workflowImageMetadata';

vi.mock('@/services/app-api/airtable', () => ({
  getConfiguredRecord: vi.fn(),
  getConfiguredFieldMetadata: vi.fn(),
  updateConfiguredRecord: vi.fn(),
  uploadConfiguredAttachment: vi.fn(),
}));
vi.mock('@/services/currentUserAudit', () => ({ resolveCurrentActorName: () => 'Reviewer' }));

import { getConfiguredRecord, updateConfiguredRecord, uploadConfiguredAttachment } from '@/services/app-api/airtable';
import { submitTestingForm } from '@/services/testingForm';
import { submitPhotosForm } from '@/services/photosForm';

const metadata = [
  { url: '/api/media/used-gear-workflow/uc?id=intake', filename: 'intake.jpg', alt: 'Intake', sourceStage: 'intake', sortOrder: 1, includedInListing: false },
  { url: '/api/media/used-gear-workflow/uc?id=testing', filename: 'testing.jpg', alt: 'Bench', sourceStage: 'testing', sortOrder: 2, includedInListing: false },
  { url: '/api/media/used-gear-workflow/uc?id=photos', filename: 'brand-model-amplifier.jpg', alt: 'Hero', sourceStage: 'photos', sortOrder: 3, includedInListing: true, annotation: 'preserve', ebayHostedImageCache: { url: 'https://i.ebayimg.com/images/g/test/s-l1600.jpg', sha256: 'a'.repeat(64) } },
];

describe.each(['testing', 'photos'] as const)('%s image preservation', (stage) => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getConfiguredRecord).mockResolvedValue({
      id: 'recPreserve', createdTime: '', fields: {
        'Workflow Status': 'Photography In Progress',
        Images: [],
        'Workflow Image Metadata JSON': JSON.stringify(metadata),
      },
    });
    vi.mocked(updateConfiguredRecord).mockResolvedValue({ id: 'recPreserve', createdTime: '', fields: {} });
  });

  function submit(completeWorkflowStage: boolean) {
    const options = { recordSource: 'used-gear-workflow' as const, imageMetadata: parseWorkflowImageMetadata(metadata), completeWorkflowStage };
    return stage === 'testing'
      ? submitTestingForm({ ...createTestingFormDefaults(), sku: '11750', testingNotes: 'Updated notes' }, 'recPreserve', options)
      : submitPhotosForm({ ...createPhotosFormDefaults(), sku: '11750', cosmeticConditionNotes: 'Updated notes' }, 'recPreserve', options);
  }

  it.each([false, true])('does not rewrite image metadata for a non-image save (complete=%s)', async (complete) => {
    await submit(complete);
    expect(updateConfiguredRecord).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateConfiguredRecord).mock.calls[0][2]).not.toHaveProperty('Workflow Image Metadata JSON');
  });

  it('does not clear the library when an empty stale image array is supplied', async () => {
    const options = { recordSource: 'used-gear-workflow' as const, imageMetadata: [] };
    if (stage === 'testing') await submitTestingForm(createTestingFormDefaults(), 'recPreserve', options);
    else await submitPhotosForm(createPhotosFormDefaults(), 'recPreserve', options);
    for (const call of vi.mocked(updateConfiguredRecord).mock.calls) {
      expect(call[2]).not.toHaveProperty('Workflow Image Metadata JSON');
    }
  });

  it('merges only edited stage fields and preserves a newer saved image cache', async () => {
    const original = parseWorkflowImageMetadata(metadata);
    const draft = original.map((row) => row.sourceStage === stage ? { ...row, alt: 'Edited caption' } : row);
    const saved = metadata.map((row) => ({
      ...row, auditNote: 'keep newest annotation',
      ...(row.sourceStage === stage ? {
        ebayHostedImageCache: { url: 'https://i.ebayimg.com/images/g/new/s-l1600.jpg', sha256: 'b'.repeat(64) },
      } : {}),
    }));
    vi.mocked(getConfiguredRecord).mockResolvedValue({
      id: 'recPreserve', createdTime: '', fields: {
        'Workflow Status': 'Photography In Progress', Images: [],
        'Workflow Image Metadata JSON': JSON.stringify(saved),
      },
    });
    const options = { recordSource: 'used-gear-workflow' as const, imageMetadata: draft, originalImageMetadata: original };
    if (stage === 'testing') await submitTestingForm(createTestingFormDefaults(), 'recPreserve', options);
    else await submitPhotosForm(createPhotosFormDefaults(), 'recPreserve', options);
    expect(updateConfiguredRecord).toHaveBeenCalledTimes(1);
    const result = JSON.parse(String(vi.mocked(updateConfiguredRecord).mock.calls[0][2]['Workflow Image Metadata JSON']));
    expect(result).toHaveLength(saved.length);
    for (const [index, row] of saved.entries()) {
      expect(result[index]).toEqual(row.sourceStage === stage
        ? expect.objectContaining({ ...row, alt: 'Edited caption' })
        : row);
    }
  });

  it('rejects a conflicting image edit before writing fields or workflow completion', async () => {
    const original = parseWorkflowImageMetadata(metadata);
    const saved = metadata.map((row) => row.sourceStage === stage ? { ...row, alt: 'Another user caption' } : row);
    vi.mocked(getConfiguredRecord).mockResolvedValue({
      id: 'recPreserve', createdTime: '', fields: {
        'Workflow Status': 'Photography In Progress',
        'Workflow Image Metadata JSON': JSON.stringify(saved),
      },
    });
    const options = {
      recordSource: 'used-gear-workflow' as const, completeWorkflowStage: true,
      imageMetadata: original.map((row) => ({ ...row, alt: 'My caption' })),
      originalImageMetadata: original,
    };
    const result = stage === 'testing'
      ? submitTestingForm(createTestingFormDefaults(), 'recPreserve', options)
      : submitPhotosForm(createPhotosFormDefaults(), 'recPreserve', options);
    await expect(result).rejects.toThrow('Photos changed since this form was loaded');
    expect(updateConfiguredRecord).not.toHaveBeenCalled();
  });

  it('appends an archived upload to fresh metadata without losing concurrent additions', async () => {
    const file = new File(['processed'], 'brand-model-front.jpg', { type: 'image/jpeg' });
    const concurrent = { ...metadata[2], url: '/api/media/used-gear-workflow/uc?id=concurrent', sortOrder: 4, annotation: 'added during upload' };
    vi.mocked(uploadConfiguredAttachment).mockImplementation(async () => {
      vi.mocked(getConfiguredRecord).mockResolvedValue({
        id: 'recPreserve', createdTime: '', fields: {
          'Workflow Status': 'Photography In Progress',
          'Workflow Image Metadata JSON': JSON.stringify([...metadata, concurrent]),
        },
      });
      return { uploaded: true, archive: {
        folderId: 'folder',
        original: { id: 'original-upload', url: '/api/media/used-gear-workflow/uc?id=original-upload', filename: file.name },
        processed: { id: 'new-upload', url: '/api/media/used-gear-workflow/uc?id=new-upload', filename: file.name },
      } };
    });
    const original = parseWorkflowImageMetadata(metadata);
    const options = {
      recordSource: 'used-gear-workflow' as const, imageMetadata: original, originalImageMetadata: original,
      imageUploadAssets: [{ originalFile: file, uploadFile: file, imageRole: 'front' as const, altText: 'Brand Model front' }],
    };
    if (stage === 'testing') await submitTestingForm({ ...createTestingFormDefaults(), imageFiles: [file] }, 'recPreserve', options);
    else await submitPhotosForm({ ...createPhotosFormDefaults(), imageFiles: [file] }, 'recPreserve', options);
    expect(updateConfiguredRecord).toHaveBeenCalledTimes(2);
    const result = JSON.parse(String(vi.mocked(updateConfiguredRecord).mock.calls[1][2]['Workflow Image Metadata JSON']));
    expect(result).toHaveLength(5);
    expect(result.slice(0, 4)).toEqual([...metadata, concurrent]);
    expect(result[4]).toMatchObject({ attachmentId: 'new-upload', sourceStage: stage, imageRole: 'front', sortOrder: 5 });
  });
});
