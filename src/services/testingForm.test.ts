import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AirtableRecord } from '@/types/airtable';

vi.mock('@/services/app-api/airtable', () => ({
  createConfiguredRecord: vi.fn(),
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
  loadInventoryRecord: vi.fn(),
}));

import { createConfiguredRecord, updateConfiguredRecord, uploadConfiguredAttachment } from '@/services/app-api/airtable';
import { testingFormFields, type TestingFormValues } from '@/components/tabs/testing/testingFormSchema';
import { loadTestingFormValues, submitTestingForm } from '@/services/testingForm';
import { loadInventoryRecord } from '@/services/inventoryDirectory';

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

  it('loads Testing values for the full schema field set', async () => {
    vi.mocked(loadInventoryRecord).mockResolvedValue(buildRecord({
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
    }));

    const values = await loadTestingFormValues('recTesting123');

    expect(values).toEqual({
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
    });
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

    vi.mocked(updateConfiguredRecord).mockResolvedValue(buildRecord({}));

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
});