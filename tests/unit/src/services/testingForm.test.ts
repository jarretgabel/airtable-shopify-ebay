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
  resolveCurrentActorName: vi.fn(() => 'Taylor Reviewer'),
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
import { testingFormFields, type TestingFormValues } from '@/components/tabs/testing/testingFormSchema';
import { loadTestingFormValues, submitTestingForm } from '@/services/testingForm';

function buildRecord(fields: Record<string, unknown>): AirtableRecord {
  return {
    id: 'recTesting123',
    createdTime: '2026-05-05T12:00:00.000Z',
    fields,
  };
}

describe('testingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads Testing values from the authoritative operational record and returns customer reference notes', async () => {
    vi.mocked(getConfiguredRecord).mockImplementation(async (source) => {
      if (source === 'used-gear-workflow') {
        return buildRecord({
          SKU: 'SKU-100',
          'Arrival Date': '2026-04-01T00:00:00.000Z',
          'Acquired From': 'Walk-in seller',
          Make: 'McIntosh',
          Model: 'MC275',
          'Component Type': ['Amplifier'],
          Cost: 1499.5,
          'Inventory Notes': 'Initial notes',
          'Serial Number': 'SN-123',
          Voltage: '120V',
          'Audiogon Rating': ['8/10'],
          'Cosmetic Condition Notes': 'Very clean',
          'Original Box': ['Yes'],
          Manual: ['Included'],
          Remote: ['No'],
          'Power Cable': ['Included'],
          'Additional Items': 'Spare tubes',
          'Shipping Weight': '68 lbs',
          'Shipping Dims': '27x25x11',
          'Shipping Method': ['Freight'],
          'Testing Notes': 'Passed bench test',
          'Testing Time': 5400,
          'Service Notes': 'Bias adjusted',
          'Service Time': 1800,
          Tested: '2026-04-05T00:00:00.000Z',
          Status: 'Tested',
          'Customer Cosmetic Notes': 'Faceplate has one small nick.',
          'Customer Functional Notes': 'Seller reports both channels are working.',
          'Customer Inclusion Notes': 'Original cage and manual included.',
          'Customer Submitted Photos Notes': 'Customer sent rear serial sticker photo.',
          Images: [
            { id: 'att-1', url: 'https://example.com/front.jpg', filename: 'front.jpg' },
          ],
          'Workflow Image Metadata JSON': JSON.stringify([
            {
              attachmentId: 'att-1',
              url: 'https://example.com/front.jpg',
              filename: 'front.jpg',
              alt: 'Front panel straight-on',
              sortOrder: 1,
              sourceStage: 'testing',
              includedInListing: true,
            },
          ]),
        });
      }

      throw new Error('inventory fallback should not be used in this test');
    });

    const result = await loadTestingFormValues('recTesting123');

    expect(result).toEqual({
      source: 'used-gear-workflow',
      customerReference: {
        cosmeticNotes: 'Faceplate has one small nick.',
        functionalNotes: 'Seller reports both channels are working.',
        inclusionNotes: 'Original cage and manual included.',
        submittedPhotosNotes: 'Customer sent rear serial sticker photo.',
      },
      stageContext: {
        existingAttachments: [
          { id: 'att-1', url: 'https://example.com/front.jpg', filename: 'front.jpg' },
        ],
        imageMetadata: [
          {
            attachmentId: 'att-1',
            url: 'https://example.com/front.jpg',
            filename: 'front.jpg',
            alt: 'Front panel straight-on',
            sortOrder: 1,
            sourceStage: 'testing',
            includedInListing: true,
          },
        ],
      },
      values: {
        sku: 'SKU-100',
        arrivalDate: '2026-04-01',
        acquiredFrom: 'Walk-in seller',
        make: 'McIntosh',
        model: 'MC275',
        componentType: 'Amplifier',
        cost: '1499.5',
        inventoryNotes: 'Initial notes',
        serialNumber: 'SN-123',
        voltage: '120V',
        audiogonRating: '8/10',
        cosmeticConditionNotes: 'Very clean',
        originalBox: 'Yes',
        manual: 'Included',
        remote: 'No',
        powerCable: 'Included',
        additionalItems: 'Spare tubes',
        shippingWeight: '68 lbs',
        shippingDims: '27x25x11',
        shippingMethod: 'Freight',
        imageFiles: [],
        testingNotes: 'Passed bench test',
        testingTimeMinutes: '90',
        serviceNotes: 'Bias adjusted',
        serviceTimeMinutes: '30',
        testingDate: '2026-04-05',
        status: 'Tested',
      },
    });
  });

  it('falls back to the inventory source when the workflow source lookup fails', async () => {
    vi.mocked(getConfiguredRecord)
      .mockRejectedValueOnce(new Error('not in workflow'))
      .mockResolvedValueOnce(buildRecord({
      SKU: 'SKU-100',
      Make: 'Luxman',
      Model: 'L-507',
      'Component Type': ['Amplifier'],
      Status: 'Needs Initial Processing',
    }));

    const result = await loadTestingFormValues('recTesting123');

    expect(result.source).toBe('inventory-directory');
    expect(result.values.make).toBe('Luxman');
  });

  it('submits every non-file Testing schema field and uploads images', async () => {
    const values: TestingFormValues = {
      sku: 'SKU-100',
      arrivalDate: '2026-04-01',
      acquiredFrom: 'Walk-in seller',
      make: 'McIntosh',
      model: 'MC275',
      componentType: 'Amplifier',
      cost: '1499.5',
      inventoryNotes: 'Initial notes',
      serialNumber: 'SN-123',
      voltage: '120V',
      audiogonRating: '8/10',
      cosmeticConditionNotes: 'Very clean',
      originalBox: 'Yes',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: 'Spare tubes',
      shippingWeight: '68 lbs',
      shippingDims: '27x25x11',
      shippingMethod: 'Freight',
      imageFiles: [new File(['image'], 'front.jpg', { type: 'image/jpeg' })],
      testingNotes: 'Passed bench test',
      testingTimeMinutes: '90',
      serviceNotes: 'Bias adjusted',
      serviceTimeMinutes: '30',
      testingDate: '2026-04-05',
      status: 'Tested',
    };

    vi.mocked(updateConfiguredRecord).mockResolvedValue({
      id: 'recTesting123',
      createdTime: '2026-05-05T12:00:00.000Z',
      fields: {},
    });

    const result = await submitTestingForm(values, 'recTesting123');

    expect(result).toEqual({
      recordId: 'recTesting123',
      sku: 'SKU-100',
      action: 'updated',
    });

    expect(createConfiguredRecord).not.toHaveBeenCalled();
    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'inventory-directory',
      'recTesting123',
      {
        SKU: 'SKU-100',
        'Arrival Date': '2026-04-01',
        'Acquired From': 'Walk-in seller',
        Make: 'McIntosh',
        Model: 'MC275',
        'Component Type': ['Amplifier'],
        Cost: 1499.5,
        'Inventory Notes': 'Initial notes',
        'Serial Number': 'SN-123',
        Voltage: '120V',
        'Audiogon Rating': '8/10',
        'Cosmetic Condition Notes': 'Very clean',
        'Original Box': ['Yes'],
        Manual: ['Included'],
        Remote: ['No'],
        'Power Cable': ['Included'],
        'Additional Items': 'Spare tubes',
        'Shipping Weight': '68 lbs',
        'Shipping Dims': '27x25x11',
        'Shipping Method': ['Freight'],
        'Testing Notes': 'Passed bench test',
        'Testing Time': 5400,
        'Service Notes': 'Bias adjusted',
        'Service Time': 1800,
        Tested: '2026-04-05',
        Status: 'Tested',
      },
      { typecast: true },
    );

    const submittedFields = vi.mocked(updateConfiguredRecord).mock.calls[0]?.[2] ?? {};
    expect(Object.keys(submittedFields).sort()).toEqual(
      testingFormFields
        .filter((field) => field.type !== 'file')
        .map((field) => field.airtableFieldName)
        .sort(),
    );

    expect(uploadConfiguredAttachment).toHaveBeenCalledWith(
      'inventory-directory',
      'recTesting123',
      'fldMXp0EaUHGglU8M',
      values.imageFiles[0],
    );
  });

  it('updates the workflow source when the testing form is opened from an operational row', async () => {
    const values: TestingFormValues = {
      sku: 'SKU-200',
      arrivalDate: '',
      acquiredFrom: '',
      make: 'Accuphase',
      model: 'P-300',
      componentType: 'Amplifier',
      cost: '',
      inventoryNotes: '',
      serialNumber: '',
      voltage: '',
      audiogonRating: '',
      cosmeticConditionNotes: '',
      originalBox: '',
      manual: '',
      remote: '',
      powerCable: '',
      additionalItems: '',
      shippingWeight: '',
      shippingDims: '',
      shippingMethod: '',
      imageFiles: [new File(['image'], 'front.jpg', { type: 'image/jpeg' })],
      testingNotes: 'Verified power-on.',
      testingTimeMinutes: '15',
      serviceNotes: '',
      serviceTimeMinutes: '',
      testingDate: '2026-05-06',
      status: 'Tested',
    };

    vi.mocked(updateConfiguredRecord).mockResolvedValue({
      id: 'recWorkflow123',
      createdTime: '2026-05-05T12:00:00.000Z',
      fields: {},
    });

    await submitTestingForm(values, 'recWorkflow123', { recordSource: 'used-gear-workflow' });

    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recWorkflow123',
      expect.objectContaining({
        'Testing Signed At': expect.any(String),
        'Testing Signed By': 'Taylor Reviewer',
      }),
      { typecast: true },
    );
    expect(uploadConfiguredAttachment).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recWorkflow123',
      'fldMXp0EaUHGglU8M',
      values.imageFiles[0],
    );
  });

  it('persists workflow image metadata when it is provided by the Testing form', async () => {
    const values: TestingFormValues = {
      sku: 'SKU-201',
      arrivalDate: '',
      acquiredFrom: '',
      make: 'Accuphase',
      model: 'P-300',
      componentType: 'Amplifier',
      cost: '',
      inventoryNotes: '',
      serialNumber: '',
      voltage: '',
      audiogonRating: '',
      cosmeticConditionNotes: '',
      originalBox: '',
      manual: '',
      remote: '',
      powerCable: '',
      additionalItems: '',
      shippingWeight: '',
      shippingDims: '',
      shippingMethod: '',
      imageFiles: [],
      testingNotes: 'Verified power-on.',
      testingTimeMinutes: '15',
      serviceNotes: '',
      serviceTimeMinutes: '',
      testingDate: '2026-05-06',
      status: 'Tested',
    };

    vi.mocked(updateConfiguredRecord)
      .mockResolvedValueOnce({
        id: 'recWorkflow123',
        createdTime: '2026-05-05T12:00:00.000Z',
        fields: {},
      })
      .mockResolvedValueOnce(buildRecord({}));
    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      Images: [
        { id: 'att-5', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
      ],
    }));

    await submitTestingForm(values, 'recWorkflow123', {
      recordSource: 'used-gear-workflow',
      imageMetadata: [
        {
          attachmentId: 'att-5',
          url: 'https://example.com/testing.jpg',
          filename: 'testing.jpg',
          alt: 'Bench setup overview',
          sortOrder: 1,
          sourceStage: 'testing',
          includedInListing: false,
        },
      ],
    });

    expect(updateConfiguredRecord).toHaveBeenNthCalledWith(
      2,
      'used-gear-workflow',
      'recWorkflow123',
      {
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            attachmentId: 'att-5',
            url: 'https://example.com/testing.jpg',
            filename: 'testing.jpg',
            alt: 'Bench setup overview',
            sortOrder: 1,
            sourceStage: 'testing',
            includedInListing: false,
          },
        ]),
      },
      { typecast: true },
    );
  });

  it('retries workflow updates without image metadata when the Airtable field is unavailable', async () => {
    const values: TestingFormValues = {
      sku: 'SKU-202',
      arrivalDate: '',
      acquiredFrom: '',
      make: 'Accuphase',
      model: 'P-300',
      componentType: 'Amplifier',
      cost: '',
      inventoryNotes: '',
      serialNumber: '',
      voltage: '',
      audiogonRating: '',
      cosmeticConditionNotes: '',
      originalBox: '',
      manual: '',
      remote: '',
      powerCable: '',
      additionalItems: '',
      shippingWeight: '',
      shippingDims: '',
      shippingMethod: '',
      imageFiles: [],
      testingNotes: 'Verified power-on.',
      testingTimeMinutes: '15',
      serviceNotes: '',
      serviceTimeMinutes: '',
      testingDate: '2026-05-06',
      status: 'Tested',
    };

    vi.mocked(updateConfiguredRecord)
      .mockRejectedValueOnce(new Error('Unknown field name: "Workflow Image Metadata JSON"'))
      .mockResolvedValueOnce({
        id: 'recWorkflow123',
        createdTime: '2026-05-05T12:00:00.000Z',
        fields: {},
      })
      .mockRejectedValueOnce(new Error('Unknown field name: "Workflow Image Metadata JSON"'));
    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({ Images: [] }));

    const result = await submitTestingForm(values, 'recWorkflow123', {
      recordSource: 'used-gear-workflow',
      imageMetadata: [
        {
          attachmentId: 'att-6',
          url: 'https://example.com/testing.jpg',
          filename: 'testing.jpg',
          alt: 'Bench setup overview',
          sortOrder: 1,
          sourceStage: 'testing',
          includedInListing: false,
        },
      ],
    });

    expect(result).toEqual({
      recordId: 'recWorkflow123',
      sku: 'SKU-202',
      action: 'updated',
    });
    const updateConfiguredRecordMock = vi.mocked(updateConfiguredRecord);

    expect(updateConfiguredRecordMock).toHaveBeenCalledTimes(3);
    expect(updateConfiguredRecordMock.mock.calls[1]?.[0]).toBe('used-gear-workflow');
    expect(updateConfiguredRecordMock.mock.calls[1]?.[1]).toBe('recWorkflow123');
    expect(updateConfiguredRecordMock.mock.calls[1]?.[2]).not.toHaveProperty('Workflow Image Metadata JSON');
    expect(updateConfiguredRecordMock.mock.calls[1]?.[3]).toEqual({ typecast: true });
    expect(updateConfiguredRecordMock.mock.calls[2]?.[2]).toEqual({
      'Workflow Image Metadata JSON': '',
    });
  });

  it('loads only testing-stage saved attachments into the testing context while preserving combined metadata', async () => {
    vi.mocked(getConfiguredRecord).mockImplementation(async (source) => {
      if (source === 'used-gear-workflow') {
        return buildRecord({
          SKU: 'SKU-102',
          Make: 'McIntosh',
          Model: 'MC240',
          'Component Type': ['Amplifier'],
          Status: 'Tested',
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

    const result = await loadTestingFormValues('recTestingStage');

    expect(result.stageContext.existingAttachments).toEqual([
      { id: 'att-testing', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' },
    ]);
    expect(result.stageContext.imageMetadata).toHaveLength(2);
    expect(result.stageContext.imageMetadata.map((record) => record.sourceStage)).toEqual(['testing', 'photos']);
  });
});