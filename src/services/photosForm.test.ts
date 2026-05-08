import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AirtableRecord } from '@/types/airtable';

vi.mock('@/services/app-api/airtable', () => ({
  createConfiguredRecord: vi.fn(),
  getConfiguredRecord: vi.fn(),
  getConfiguredFieldMetadata: vi.fn(),
  updateConfiguredRecord: vi.fn(),
  uploadConfiguredAttachment: vi.fn(),
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
import type { PhotosFormValues } from '@/components/tabs/photos/photosFormSchema';

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
  });

  it('loads Photos values from the authoritative workflow row and separates customer reference notes', async () => {
    vi.mocked(getConfiguredRecord).mockImplementation(async (source) => {
      if (source === 'used-gear-workflow') {
        return buildRecord({
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
          'Cosmetic Condition Notes': 'Moderate case wear.',
          "Photo'd": '2026-05-04T00:00:00.000Z',
          Status: "Photo'd",
          'Customer Cosmetic Notes': 'Seller flagged scratches on the top cover.',
          'Customer Functional Notes': 'Tuner lamp flickers intermittently.',
          'Customer Inclusion Notes': 'Manual and power cord included.',
          'Customer Submitted Photos Notes': 'Customer sent front-panel and rear-panel photos.',
          'Inventory Notes': 'Keep reflection under control on the top cover.',
          'Testing Notes': 'Receiver passed tuner and phono checks.',
          'Images (Eduardo)': [
            { id: 'att-1', url: 'https://example.com/hero.jpg', filename: 'hero.jpg' },
          ],
        });
      }

      throw new Error('inventory fallback should not be used in this test');
    });

    const result = await loadPhotosFormValues('recPhotos123');

    expect(result).toEqual({
      source: 'used-gear-workflow',
      customerReference: {
        cosmeticNotes: 'Seller flagged scratches on the top cover.',
        functionalNotes: 'Tuner lamp flickers intermittently.',
        inclusionNotes: 'Manual and power cord included.',
        submittedPhotosNotes: 'Customer sent front-panel and rear-panel photos.',
      },
      stageContext: {
        inventoryNotes: 'Keep reflection under control on the top cover.',
        testingNotes: 'Receiver passed tuner and phono checks.',
        existingAttachments: [
          { id: 'att-1', url: 'https://example.com/hero.jpg', filename: 'hero.jpg' },
        ],
      },
      values: {
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
        cosmeticConditionNotes: 'Moderate case wear.',
        imageFiles: [],
        photoDate: '2026-05-04',
        status: "Photo'd",
      },
    });
  });

  it('submits photo changes back to the workflow source when requested', async () => {
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

    vi.mocked(updateConfiguredRecord).mockResolvedValue(buildRecord({}));

    const result = await submitPhotosForm(values, 'recPhotos123', { recordSource: 'used-gear-workflow' });

    expect(result).toEqual({
      recordId: 'recPhotos123',
      sku: 'SKU-300',
      action: 'updated',
    });
    expect(createConfiguredRecord).not.toHaveBeenCalled();
    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPhotos123',
      expect.any(Object),
      { typecast: true },
    );
    expect(uploadConfiguredAttachment).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPhotos123',
      'fldMXp0EaUHGglU8M',
      values.imageFiles[0],
    );
  });
});