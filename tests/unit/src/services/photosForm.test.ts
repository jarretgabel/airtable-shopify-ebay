import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AirtableRecord } from '@/types/airtable';

vi.mock('@/services/app-api/airtable', () => ({
  createConfiguredRecord: vi.fn(),
  getConfiguredRecord: vi.fn(),
  getConfiguredFieldMetadata: vi.fn(),
  updateConfiguredRecord: vi.fn(),
  uploadConfiguredAttachment: vi.fn(),
}));

vi.mock('@/services/currentUserAudit', () => ({
  resolveCurrentActorName: vi.fn(() => 'Phoebe Photographer'),
}));

vi.mock('@/services/inventoryDirectory', () => ({
  extractInventoryScalarValue: (value: unknown): string => {
    if (value == null) return '';
    if (Array.isArray(value)) {
      const firstValue = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
      return firstValue ?? '';
    }
    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') return value.text.trim();
      if ('name' in value && typeof value.name === 'string') return value.name.trim();
    }
    return String(value);
  },
}));

import { createConfiguredRecord, getConfiguredRecord, updateConfiguredRecord, uploadConfiguredAttachment } from '@/services/app-api/airtable';
import { loadPhotosFormValues, submitPhotosForm } from '@/services/photosForm';
import { createPhotosFormDefaults, type PhotosFormValues } from '@/components/tabs/photos/photosFormSchema';

function buildRecord(fields: Record<string, unknown>): AirtableRecord {
  return {
    id: 'recPhotos123',
    createdTime: '2026-05-05T12:00:00.000Z',
    fields,
  };
}

describe('photosForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadConfiguredAttachment).mockResolvedValue({ uploaded: true });
  });

  it('loads Photos values from the authoritative operational row and separates customer reference notes', async () => {
    vi.mocked(getConfiguredRecord).mockImplementation(async (source) => {
      if (source === 'used-gear-workflow') {
        return buildRecord({
          'Workflow Status': 'Testing In Progress',
          SKU: 'SKU-300',
          Make: 'Marantz',
          Model: '2270',
          'Component Type': ['Receiver'],
          'Original Box': ['No'],
          Manual: ['Included'],
          Remote: ['No'],
          'Power Cable': ['Included'],
          'Additional Items': 'Replacement feet',
          'Audiogon Rating': ['7/10'],
          Cost: 1250,
          'Testing Cosmetic Notes': 'Moderate test-stage wear.',
          'Photography Cosmetic Notes': 'Moderate photo-stage wear.',
          "Photo'd": '2026-05-04T00:00:00.000Z',
          Status: "Photo'd",
          'Customer Cosmetic Notes': 'Seller flagged scratches on the top cover.',
          'Customer Functional Notes': 'Tuner lamp flickers intermittently.',
          'Customer Inclusion Notes': 'Manual and power cord included.',
          'Inventory Notes': 'Keep reflection under control on the top cover.',
          'Testing Notes': 'Receiver passed tuner and phono checks.',
          Images: [
            { id: 'att-1', url: 'https://example.com/hero.jpg', filename: 'hero.jpg' },
          ],
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-1',
              url: 'https://example.com/hero.jpg',
              filename: 'hero.jpg',
              alt: 'Hero angle',
              sortOrder: 1,
              sourceStage: 'photos',
              includedInListing: true,
            },
          ]),
        });
      }

      throw new Error('inventory fallback should not be used in this test');
    });

    const result = await loadPhotosFormValues('recPhotos123');

    expect(result).toEqual({
      source: 'used-gear-workflow',
      itemTitle: 'Marantz 2270 - Photos123',
      customerReference: {
        cosmeticNotes: 'Seller flagged scratches on the top cover.',
        functionalNotes: 'Tuner lamp flickers intermittently.',
        inclusionNotes: 'Manual and power cord included.',
      },
      stageContext: {
        inventoryNotes: 'Keep reflection under control on the top cover.',
        testingNotes: 'Receiver passed tuner and phono checks.',
        testingCosmeticNotes: 'Moderate test-stage wear.',
        existingAttachments: [
          { id: 'att-1', url: 'https://example.com/hero.jpg', filename: 'hero.jpg' },
        ],
        intakeReferenceAttachments: [],
        testingReferenceAttachments: [],
        imageMetadata: [
          {
            attachmentId: 'att-1',
            url: 'https://example.com/hero.jpg',
            filename: 'hero.jpg',
            alt: 'Hero angle',
            sortOrder: 1,
            sourceStage: 'photos',
            includedInListing: true,
            createdAt: undefined,
            updatedAt: undefined,
          },
        ],
      },
      values: {
        cost: '1250',
        sku: 'SKU-300',
        make: 'Marantz',
        model: '2270',
        componentType: 'Receiver',
        originalBox: 'No',
        manual: 'Included',
        remote: 'No',
        powerCable: 'Included',
        additionalItems: 'Replacement feet',
        audiogonRating: '7/10',
        cosmeticConditionNotes: 'Moderate photo-stage wear.',
        imageFiles: [],
        photoDate: '2026-05-04',
        status: "Photo'd",
      },
    });
  });

  it('uses only metadata-backed prior-step attachments on the photography snapshot', async () => {
    vi.mocked(getConfiguredRecord).mockImplementation(async (source) => {
      if (source === 'used-gear-workflow') {
        return buildRecord({
          'Workflow Status': 'Photography In Progress',
          Price: '1499.99',
          SKU: 'SKU-301',
          Make: 'Audio Research',
          Model: 'SP-9',
          'Component Type': ['Preamp'],
          Status: "Photo'd",
          Images: [
            { id: 'att-intake', url: 'https://example.com/intake.jpg', filename: 'intake.jpg' },
            { id: 'att-testing', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
            { id: 'att-photo', url: 'https://example.com/photo.jpg', filename: 'photo.jpg' },
          ],
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-testing',
              url: 'https://example.com/testing.jpg',
              filename: 'testing.jpg',
              alt: 'Bench view',
              sortOrder: 1,
              sourceStage: 'testing',
              includedInListing: false,
            },
            {
              attachmentId: 'att-photo',
              url: 'https://example.com/photo.jpg',
              filename: 'photo.jpg',
              alt: 'Final hero',
              sortOrder: 2,
              sourceStage: 'photos',
              includedInListing: true,
            },
          ]),
        });
      }

      throw new Error('inventory fallback should not be used in this test');
    });

    const result = await loadPhotosFormValues('recPhotosSample');

    expect(result.values.cost).toBe('1499.99');

    expect(result.stageContext.existingAttachments).toEqual([
      { id: 'att-testing', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
      { id: 'att-photo', url: 'https://example.com/photo.jpg', filename: 'photo.jpg' },
    ]);
    expect(result.stageContext.intakeReferenceAttachments).toEqual([]);
    expect(result.stageContext.testingReferenceAttachments).toEqual([
      { id: 'att-testing', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
    ]);
  });

  it('submits photo changes back to the workflow source when photography is completed', async () => {
    const values: PhotosFormValues = {
      sku: 'SKU-300',
      make: 'Marantz',
      model: '2270',
      componentType: 'Receiver',
      originalBox: 'No',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: 'Replacement feet',
      audiogonRating: '7/10',
      cosmeticConditionNotes: 'Fresh photography notes.',
      imageFiles: [new File(['image'], 'hero.jpg', { type: 'image/jpeg' })],
      photoDate: '2026-05-04',
      status: "Photo'd",
    };

    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      'Workflow Status': 'Photography In Progress',
      'Testing Signed At': '2026-05-04T11:00:00.000Z',
      'Testing Signed By': 'Taylor Reviewer',
    }));
    vi.mocked(updateConfiguredRecord).mockResolvedValue(buildRecord({}));

    const result = await submitPhotosForm(values, 'recPhotos123', { recordSource: 'used-gear-workflow', completeWorkflowStage: true });

    expect(result).toEqual({
      recordId: 'recPhotos123',
      sku: 'SKU-300',
      action: 'updated',
    });
    expect(createConfiguredRecord).not.toHaveBeenCalled();
    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPhotos123',
      expect.objectContaining({
        'Workflow Status': 'Awaiting Pre-Listing Review',
        'Awaiting Pre-Listing Review At': expect.any(String),
        'Photography Signed At': expect.any(String),
        'Photography Signed By': 'Phoebe Photographer',
      }),
      { typecast: true },
    );
    expect(uploadConfiguredAttachment).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPhotos123',
      'fld1zIzmZEciQECah',
      values.imageFiles[0],
      undefined,
    );
  });

  it('passes google drive archive details when original photo uploads are available', async () => {
    const originalFile = new File(['original-image'], 'hero-original.jpg', { type: 'image/jpeg' });
    const processedFile = new File(['processed-image'], 'hero-processed.jpg', { type: 'image/jpeg' });
    const values: PhotosFormValues = {
      ...createPhotosFormDefaults(),
      sku: 'SKU-301',
      make: 'Marantz',
      model: '2325',
      componentType: 'Receiver',
      audiogonRating: '7/10',
      photoDate: '2026-05-04',
      imageFiles: [processedFile],
      originalBox: 'No',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      status: "Photo'd",
    };

    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      'Workflow Status': 'Photography In Progress',
      'Testing Signed At': '2026-05-04T11:00:00.000Z',
    }));
    vi.mocked(updateConfiguredRecord).mockResolvedValue(buildRecord({}));
    vi.mocked(uploadConfiguredAttachment).mockResolvedValue({
      uploaded: false,
      archived: true,
      archive: {
        folderId: 'folder-1',
        original: {
          id: 'file-original',
          filename: 'photos-original.jpg',
          url: 'https://drive.google.com/uc?export=view&id=file-original',
        },
        processed: {
          id: 'file-processed',
          filename: 'photos-processed.jpg',
          url: 'https://drive.google.com/uc?export=view&id=file-processed',
        },
      },
    });

    await submitPhotosForm(values, 'recPhotos123', {
      recordSource: 'used-gear-workflow',
      imageUploadAssets: [{ originalFile, uploadFile: processedFile }],
    });

    expect(uploadConfiguredAttachment).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPhotos123',
      'fld1zIzmZEciQECah',
      processedFile,
      {
        archiveOnly: true,
        driveArchive: {
          stage: 'photos',
          originalFile,
        },
      },
    );
  });

  it('stores processed Drive URLs in workflow image metadata for archive-only photo uploads', async () => {
    const originalFile = new File(['original-image'], 'photos-original.jpg', { type: 'image/jpeg' });
    const processedFile = new File(['processed-image'], 'photos-processed.jpg', { type: 'image/jpeg' });
    const values: PhotosFormValues = {
      ...createPhotosFormDefaults(),
      sku: 'SKU-303',
      make: 'Marantz',
      model: '2325',
      componentType: 'Receiver',
      audiogonRating: '7/10',
      photoDate: '2026-05-04',
      imageFiles: [processedFile],
      originalBox: 'No',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      status: "Photo'd",
    };

    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      'Workflow Status': 'Photography In Progress',
      'Testing Signed At': '2026-05-04T11:00:00.000Z',
    }));
    vi.mocked(updateConfiguredRecord)
      .mockResolvedValueOnce(buildRecord({}))
      .mockResolvedValueOnce(buildRecord({}));
    vi.mocked(uploadConfiguredAttachment).mockResolvedValue({
      uploaded: false,
      archived: true,
      archive: {
        folderId: 'folder-1',
        original: {
          id: 'file-original',
          filename: 'photos-original.jpg',
          url: 'https://drive.google.com/uc?export=view&id=file-original',
        },
        processed: {
          id: 'file-processed',
          filename: 'photos-processed.jpg',
          url: 'https://drive.google.com/uc?export=view&id=file-processed',
        },
      },
    });

    await submitPhotosForm(values, 'recPhotos123', {
      recordSource: 'used-gear-workflow',
      imageUploadAssets: [{ originalFile, uploadFile: processedFile }],
    });

    const metadataPayload = vi.mocked(updateConfiguredRecord).mock.calls[1]?.[2] as Record<string, unknown>;
    expect(vi.mocked(updateConfiguredRecord).mock.calls[1]?.[0]).toBe('used-gear-workflow');
    expect(vi.mocked(updateConfiguredRecord).mock.calls[1]?.[1]).toBe('recPhotos123');
    expect(vi.mocked(updateConfiguredRecord).mock.calls[1]?.[3]).toEqual({ typecast: true });
    expect(JSON.parse(String(metadataPayload['Workflow Image Metadata JSON']))).toEqual([
      {
        attachmentId: 'file-processed',
        url: 'https://drive.google.com/uc?export=view&id=file-processed',
        filename: 'photos-processed.jpg',
        alt: '',
        sortOrder: 1,
        sourceStage: 'photos',
        includedInListing: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    ]);
  });

  it('blocks photography completion until testing is signed', async () => {
    const values: PhotosFormValues = {
      sku: 'SKU-302',
      make: 'Marantz',
      model: '2238B',
      componentType: 'Receiver',
      originalBox: 'No',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: '',
      audiogonRating: '7/10',
      cosmeticConditionNotes: 'Fresh photography notes.',
      imageFiles: [],
      photoDate: '2026-05-04',
      status: "Photo'd",
    };

    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      'Workflow Status': 'Testing In Progress',
    }));
    vi.mocked(updateConfiguredRecord).mockResolvedValue(buildRecord({}));

    await expect(submitPhotosForm(values, 'recPhotos302', { recordSource: 'used-gear-workflow', completeWorkflowStage: true }))
      .rejects.toThrow('Unable to update the Photos fields for this workflow item.');

    expect(updateConfiguredRecord).not.toHaveBeenCalled();
  });

  it('persists workflow image metadata when it is provided by the Photos form', async () => {
    const values: PhotosFormValues = {
      sku: 'SKU-301',
      make: 'Marantz',
      model: '2325',
      componentType: 'Receiver',
      originalBox: 'No',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: '',
      audiogonRating: '7/10',
      cosmeticConditionNotes: 'Fresh photography notes.',
      imageFiles: [],
      photoDate: '2026-05-04',
      status: "Photo'd",
    };

    vi.mocked(updateConfiguredRecord)
      .mockResolvedValueOnce(buildRecord({}))
      .mockResolvedValueOnce(buildRecord({}));
    vi.mocked(getConfiguredRecord)
      .mockResolvedValueOnce(buildRecord({
        'Workflow Status': 'Photography In Progress',
      }))
      .mockResolvedValueOnce(buildRecord({
        Images: [
          { id: 'att-9', url: 'https://example.com/detail.jpg', filename: 'detail.jpg' },
        ],
      }));

    await submitPhotosForm(values, 'recPhotos123', {
      recordSource: 'used-gear-workflow',
      completeWorkflowStage: true,
      imageMetadata: [
        {
          attachmentId: 'att-9',
          url: 'https://example.com/detail.jpg',
          filename: 'detail.jpg',
          alt: 'Top cover detail',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
      ],
    });

    expect(updateConfiguredRecord).toHaveBeenNthCalledWith(
      2,
      'used-gear-workflow',
      'recPhotos123',
      {
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            attachmentId: 'att-9',
            url: 'https://example.com/detail.jpg',
            filename: 'detail.jpg',
            alt: 'Top cover detail',
            sortOrder: 1,
            sourceStage: 'photos',
            includedInListing: true,
          },
        ]),
      },
      { typecast: true },
    );
  });

  it('retries without workflow image metadata when the Airtable base does not expose that field', async () => {
    const values: PhotosFormValues = {
      sku: 'SKU-311',
      make: 'Marantz',
      model: '2238B',
      componentType: 'Receiver',
      originalBox: 'No',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: '',
      audiogonRating: '7/10',
      cosmeticConditionNotes: 'Fresh photography notes.',
      imageFiles: [],
      photoDate: '2026-05-04',
      status: "Photo'd",
    };

    vi.mocked(updateConfiguredRecord)
      .mockRejectedValueOnce(new Error('Unknown field name: "Workflow Image Metadata JSON"'))
      .mockResolvedValueOnce(buildRecord({}))
      .mockRejectedValueOnce(new Error('Unknown field name: "Workflow Image Metadata JSON"'));
    vi.mocked(getConfiguredRecord)
      .mockResolvedValueOnce(buildRecord({
        'Workflow Status': 'Photography In Progress',
      }))
      .mockResolvedValueOnce(buildRecord({ Images: [] }));

    const result = await submitPhotosForm(values, 'recPhotos123', {
      recordSource: 'used-gear-workflow',
      completeWorkflowStage: true,
      imageMetadata: [
        {
          attachmentId: 'att-10',
          url: 'https://example.com/detail.jpg',
          filename: 'detail.jpg',
          alt: 'Top cover detail',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
      ],
    });

    expect(result).toEqual({
      recordId: 'recPhotos123',
      sku: 'SKU-311',
      action: 'updated',
    });
    const updateConfiguredRecordMock = vi.mocked(updateConfiguredRecord);

    expect(updateConfiguredRecordMock).toHaveBeenCalledTimes(3);
    expect(updateConfiguredRecordMock.mock.calls[1]?.[0]).toBe('used-gear-workflow');
    expect(updateConfiguredRecordMock.mock.calls[1]?.[1]).toBe('recPhotos123');
    expect(updateConfiguredRecordMock.mock.calls[1]?.[2]).not.toHaveProperty('Workflow Image Metadata JSON');
    expect(updateConfiguredRecordMock.mock.calls[1]?.[3]).toEqual({ typecast: true });
    expect(updateConfiguredRecordMock.mock.calls[2]?.[2]).toEqual({
      'Workflow Image Metadata JSON': '',
    });
  });

  it('falls back to metadata-backed photo attachments when workflow records have no Airtable image attachments', async () => {
    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      'Workflow Status': 'Photography In Progress',
      'Testing Signed At': '2026-05-04T11:00:00.000Z',
      SKU: 'SKU-304',
      Make: 'Marantz',
      Model: '2325',
      'Component Type': ['Receiver'],
      Status: "Photo'd",
      Images: [],
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'file-processed',
          url: 'https://drive.google.com/uc?export=view&id=file-processed',
          filename: 'photos-processed.jpg',
          alt: 'Hero angle',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
      ]),
    }));

    const result = await loadPhotosFormValues('recPhotosMetadataOnly');

    expect(result.stageContext.existingAttachments).toEqual([
      {
        id: 'file-processed',
        url: 'https://drive.google.com/uc?export=view&id=file-processed',
        filename: 'photos-processed.jpg',
      },
    ]);
    expect(result.stageContext.imageMetadata).toEqual([
      expect.objectContaining({
        attachmentId: 'file-processed',
        url: 'https://drive.google.com/uc?export=view&id=file-processed',
        filename: 'photos-processed.jpg',
        sourceStage: 'photos',
      }),
    ]);
  });

  it('does not stamp workflow photography signoff fields when updating the inventory source directly', async () => {
    const values: PhotosFormValues = {
      sku: 'SKU-310',
      make: 'Marantz',
      model: '1060',
      componentType: 'Amplifier',
      originalBox: 'No',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: '',
      audiogonRating: '7/10',
      cosmeticConditionNotes: 'Minor edge wear.',
      imageFiles: [],
      photoDate: '2026-05-04',
      status: "Photo'd",
    };

    await expect(submitPhotosForm(values, 'recPhotos123')).rejects.toThrow('Unable to update the Photos fields for this workflow item.');
    expect(updateConfiguredRecord).not.toHaveBeenCalled();
  });

  it('saves photo changes without workflow photography signoff when completion is not requested', async () => {
    const values: PhotosFormValues = {
      sku: 'SKU-305',
      make: 'Marantz',
      model: '2245',
      componentType: 'Receiver',
      originalBox: 'No',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: '',
      audiogonRating: '7/10',
      cosmeticConditionNotes: 'Saved mid-session.',
      imageFiles: [],
      photoDate: '2026-05-04',
      status: "Photo'd",
    };

    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      'Workflow Status': 'Testing In Progress',
    }));
    vi.mocked(updateConfiguredRecord).mockResolvedValue(buildRecord({}));

    await submitPhotosForm(values, 'recPhotos305', { recordSource: 'used-gear-workflow', completeWorkflowStage: false });

    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPhotos305',
      expect.not.objectContaining({
        'Photography Signed At': expect.any(String),
      }),
      { typecast: true },
    );
  });

  it('rejects records that are not approved workflow intake items', async () => {
    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      SKU: 'SKU-300',
      Make: 'Marantz',
      Model: '2270',
      'Component Type': ['Receiver'],
      'Workflow Status': 'Pending Review',
    }));

    await expect(loadPhotosFormValues('recPhotos123')).rejects.toThrow('Unable to load the selected inventory record into Photos.');
  });

  it('loads only photo-stage saved attachments into the photos context while preserving combined metadata', async () => {
    vi.mocked(getConfiguredRecord).mockImplementation(async (source) => {
      if (source === 'used-gear-workflow') {
        return buildRecord({
          'Workflow Status': 'Photography In Progress',
          SKU: 'SKU-302',
          Make: 'Marantz',
          Model: '250',
          'Component Type': ['Amplifier'],
          Status: "Photo'd",
          Images: [
            { id: 'att-testing', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
            { id: 'att-photo', url: 'https://example.com/photo.jpg', filename: 'photo.jpg' },
          ],
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-testing',
              url: 'https://example.com/testing.jpg',
              filename: 'testing.jpg',
              alt: 'Bench view',
              sortOrder: 1,
              sourceStage: 'testing',
              includedInListing: false,
            },
            {
              attachmentId: 'att-photo',
              url: 'https://example.com/photo.jpg',
              filename: 'photo.jpg',
              alt: 'Final hero',
              sortOrder: 2,
              sourceStage: 'photos',
              includedInListing: true,
            },
          ]),
        });
      }

      throw new Error('inventory fallback should not be used in this test');
    });

    const result = await loadPhotosFormValues('recPhotosStage');

    expect(result.stageContext.existingAttachments).toEqual([
      { id: 'att-testing', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
      { id: 'att-photo', url: 'https://example.com/photo.jpg', filename: 'photo.jpg' },
    ]);
    expect(result.stageContext.intakeReferenceAttachments).toEqual([]);
    expect(result.stageContext.testingReferenceAttachments).toEqual([
      { id: 'att-testing', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
    ]);
    expect(result.stageContext.imageMetadata).toHaveLength(3);
    expect(result.stageContext.imageMetadata.map((record) => record.sourceStage)).toEqual(['testing', 'photos', 'photos']);
  });
});