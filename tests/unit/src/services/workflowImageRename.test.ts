import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renameImagesForChangedRoles } from '@/services/workflowImageRename';
import { renameWorkflowImage, updateConfiguredRecord } from '@/services/app-api/airtable';
import type { WorkflowImageMetadataRecord } from '@/services/workflowImageMetadata';

vi.mock('@/services/app-api/airtable', () => ({ renameWorkflowImage: vi.fn(), updateConfiguredRecord: vi.fn() }));

const ctx = { brand: 'EMT', model: 'JSD', productType: 'MC Cartridge', companyName: 'Resolution AV' };
const original: WorkflowImageMetadataRecord = {
  attachmentId: 'used-gear-workflow/rec1/testing/testing--old.jpg',
  url: '/api/media/used-gear-workflow/rec1/testing/testing--old.jpg',
  filename: 'testing--old.jpg', alt: 'x', imageRole: 'front', sortOrder: 1, sourceStage: 'testing', includedInListing: true,
};
const params = (next: WorkflowImageMetadataRecord) => ({
  source: 'used-gear-workflow' as const, recordId: 'rec1', stage: 'testing' as const,
  rawMetadata: JSON.stringify([original]), imageMetadata: [next], originalImageMetadata: [original], namingContext: ctx,
});

describe('renameImagesForChangedRoles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renames a hosted image when its role changed and saves the new identity', async () => {
    vi.mocked(renameWorkflowImage).mockResolvedValue({ id: 'k/new.jpg', filename: 'testing--new.jpg', url: '/api/media/used-gear-workflow/rec1/testing/testing--new.jpg' });
    const result = await renameImagesForChangedRoles(params({ ...original, imageRole: 'bottom' }));
    expect(vi.mocked(renameWorkflowImage).mock.calls[0][3]).toBe('emt-jsd-mc-cartridge-bottom-view.jpg');
    expect(result.imageMetadata[0]).toMatchObject({ filename: 'testing--new.jpg', imageRole: 'bottom' });
    expect(result.originalImageMetadata?.[0]).toMatchObject({ filename: 'testing--new.jpg', imageRole: 'front' });
    expect(JSON.parse(vi.mocked(updateConfiguredRecord).mock.calls[0][2]['Workflow Image Metadata JSON'] as string)[0].filename).toBe('testing--new.jpg');
  });

  it('does nothing when the role is unchanged or the rename fails', async () => {
    await renameImagesForChangedRoles(params({ ...original }));
    expect(renameWorkflowImage).not.toHaveBeenCalled();
    vi.mocked(renameWorkflowImage).mockRejectedValue(new Error('boom'));
    const result = await renameImagesForChangedRoles(params({ ...original, imageRole: 'bottom' }));
    expect(result.imageMetadata[0].filename).toBe('testing--old.jpg');
    expect(updateConfiguredRecord).not.toHaveBeenCalled();
  });
});
