import { describe, expect, it } from 'vitest';
import {
  filterWorkflowAttachmentsByStage,
  filterWorkflowImageMetadataByStage,
  mergeWorkflowImageMetadata,
  parseWorkflowImageMetadata,
  replaceWorkflowImageMetadataStage,
  reorderWorkflowImageMetadata,
  serializeWorkflowImageMetadata,
  updateWorkflowImageAltText,
  updateWorkflowImageInclusion,
} from '@/services/workflowImageMetadata';

describe('workflowImageMetadata', () => {
  it('parses and compacts workflow image metadata records', () => {
    const parsed = parseWorkflowImageMetadata(JSON.stringify([
      {
        attachmentId: 'att-2',
        url: 'https://cdn.example.com/b.jpg',
        filename: 'b.jpg',
        alt: 'Back',
        sortOrder: 2,
        sourceStage: 'photos',
        includedInListing: true,
      },
      {
        attachmentId: 'att-1',
        url: 'https://cdn.example.com/a.jpg',
        filename: 'a.jpg',
        alt: 'Front',
        sortOrder: 1,
        sourceStage: 'testing',
        includedInListing: false,
      },
    ]));

    expect(parsed).toEqual([
      {
        attachmentId: 'att-1',
        url: 'https://cdn.example.com/a.jpg',
        filename: 'a.jpg',
        alt: 'Front',
        sortOrder: 1,
        sourceStage: 'testing',
        includedInListing: false,
      },
      {
        attachmentId: 'att-2',
        url: 'https://cdn.example.com/b.jpg',
        filename: 'b.jpg',
        alt: 'Back',
        sortOrder: 2,
        sourceStage: 'photos',
        includedInListing: true,
      },
    ]);
    expect(serializeWorkflowImageMetadata(parsed)).toBe(JSON.stringify(parsed));
  });

  it('merges attachments with existing metadata and appends newly uploaded images', () => {
    const merged = mergeWorkflowImageMetadata({
      attachments: [
        { id: 'att-1', url: 'https://cdn.example.com/a.jpg', filename: 'a.jpg' },
        { id: 'att-2', url: 'https://cdn.example.com/b.jpg', filename: 'b.jpg' },
      ],
      existingMetadata: [{
        attachmentId: 'att-1',
        url: 'https://cdn.example.com/a.jpg',
        filename: 'a.jpg',
        alt: 'Front',
        sortOrder: 1,
        sourceStage: 'testing',
        includedInListing: true,
      }],
      sourceStage: 'photos',
      nowIso: '2026-05-10T12:00:00.000Z',
    });

    expect(merged).toEqual([
      {
        attachmentId: 'att-1',
        url: 'https://cdn.example.com/a.jpg',
        filename: 'a.jpg',
        alt: 'Front',
        sortOrder: 1,
        sourceStage: 'testing',
        includedInListing: true,
      },
      {
        attachmentId: 'att-2',
        url: 'https://cdn.example.com/b.jpg',
        filename: 'b.jpg',
        alt: '',
        sortOrder: 2,
        sourceStage: 'photos',
        includedInListing: true,
        createdAt: '2026-05-10T12:00:00.000Z',
        updatedAt: '2026-05-10T12:00:00.000Z',
      },
    ]);
  });

  it('reorders records and updates alt text and inclusion flags', () => {
    const initial = parseWorkflowImageMetadata(JSON.stringify([
      {
        attachmentId: 'att-1',
        url: 'https://cdn.example.com/a.jpg',
        filename: 'a.jpg',
        alt: 'Front',
        sortOrder: 1,
        sourceStage: 'testing',
        includedInListing: true,
      },
      {
        attachmentId: 'att-2',
        url: 'https://cdn.example.com/b.jpg',
        filename: 'b.jpg',
        alt: '',
        sortOrder: 2,
        sourceStage: 'photos',
        includedInListing: false,
      },
    ]));

    const reordered = reorderWorkflowImageMetadata(initial, ['https://cdn.example.com/b.jpg', 'https://cdn.example.com/a.jpg']);
    const withAlt = updateWorkflowImageAltText(reordered, 'https://cdn.example.com/b.jpg', 'Rear angle', '2026-05-10T13:00:00.000Z');
    const withInclusion = updateWorkflowImageInclusion(withAlt, 'https://cdn.example.com/b.jpg', true, '2026-05-10T14:00:00.000Z');

    expect(withInclusion[0]).toEqual({
      attachmentId: 'att-2',
      url: 'https://cdn.example.com/b.jpg',
      filename: 'b.jpg',
      alt: 'Rear angle',
      sortOrder: 1,
      sourceStage: 'photos',
      includedInListing: true,
      updatedAt: '2026-05-10T14:00:00.000Z',
    });
    expect(withInclusion[1].sortOrder).toBe(2);
  });

  it('filters and replaces metadata within a single stage while preserving the other stage', () => {
    const initial = parseWorkflowImageMetadata(JSON.stringify([
      {
        attachmentId: 'att-1',
        url: 'https://cdn.example.com/testing-a.jpg',
        filename: 'testing-a.jpg',
        alt: 'Testing A',
        sortOrder: 1,
        sourceStage: 'testing',
        includedInListing: true,
      },
      {
        attachmentId: 'att-2',
        url: 'https://cdn.example.com/photo-a.jpg',
        filename: 'photo-a.jpg',
        alt: 'Photo A',
        sortOrder: 2,
        sourceStage: 'photos',
        includedInListing: true,
      },
      {
        attachmentId: 'att-3',
        url: 'https://cdn.example.com/testing-b.jpg',
        filename: 'testing-b.jpg',
        alt: 'Testing B',
        sortOrder: 3,
        sourceStage: 'testing',
        includedInListing: false,
      },
    ]));

    expect(filterWorkflowImageMetadataByStage(initial, 'testing').map((record) => record.filename)).toEqual([
      'testing-a.jpg',
      'testing-b.jpg',
    ]);

    const replaced = replaceWorkflowImageMetadataStage(initial, 'testing', [
      {
        attachmentId: 'att-3',
        url: 'https://cdn.example.com/testing-b.jpg',
        filename: 'testing-b.jpg',
        alt: 'Updated Testing B',
        sortOrder: 1,
        sourceStage: 'testing',
        includedInListing: true,
      },
      {
        attachmentId: 'att-1',
        url: 'https://cdn.example.com/testing-a.jpg',
        filename: 'testing-a.jpg',
        alt: 'Updated Testing A',
        sortOrder: 2,
        sourceStage: 'testing',
        includedInListing: false,
      },
    ]);

    expect(replaced.map((record) => `${record.sourceStage}:${record.filename}`)).toEqual([
      'testing:testing-b.jpg',
      'photos:photo-a.jpg',
      'testing:testing-a.jpg',
    ]);
    expect(replaced[1]).toEqual(expect.objectContaining({
      attachmentId: 'att-2',
      filename: 'photo-a.jpg',
      alt: 'Photo A',
      sourceStage: 'photos',
    }));

    expect(filterWorkflowAttachmentsByStage([
      { id: 'att-1', url: 'https://cdn.example.com/testing-a.jpg', filename: 'testing-a.jpg' },
      { id: 'att-2', url: 'https://cdn.example.com/photo-a.jpg', filename: 'photo-a.jpg' },
      { id: 'att-3', url: 'https://cdn.example.com/testing-b.jpg', filename: 'testing-b.jpg' },
    ], replaced, 'photos')).toEqual([
      { id: 'att-2', url: 'https://cdn.example.com/photo-a.jpg', filename: 'photo-a.jpg' },
    ]);
  });

  it('filters stage attachments by url when attachment ids are missing', () => {
    const metadata = parseWorkflowImageMetadata(JSON.stringify([
      {
        url: 'https://cdn.example.com/testing-no-id.jpg',
        filename: 'testing-no-id.jpg',
        alt: 'Testing without id',
        sortOrder: 1,
        sourceStage: 'testing',
        includedInListing: true,
      },
      {
        url: 'https://cdn.example.com/photos-no-id.jpg',
        filename: 'photos-no-id.jpg',
        alt: 'Photos without id',
        sortOrder: 2,
        sourceStage: 'photos',
        includedInListing: true,
      },
    ]));

    expect(filterWorkflowAttachmentsByStage([
      { url: 'https://cdn.example.com/testing-no-id.jpg', filename: 'testing-no-id.jpg' },
      { url: 'https://cdn.example.com/photos-no-id.jpg', filename: 'photos-no-id.jpg' },
    ], metadata, 'photos')).toEqual([
      { url: 'https://cdn.example.com/photos-no-id.jpg', filename: 'photos-no-id.jpg' },
    ]);
  });
});