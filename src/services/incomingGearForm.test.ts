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
import { incomingGearFormFields, type IncomingGearFormValues } from '@/components/tabs/incoming-gear/incomingGearFormSchema';
import { loadIncomingGearFormValues, submitIncomingGearForm } from '@/services/incomingGearForm';
import { loadInventoryRecord } from '@/services/inventoryDirectory';

function buildRecord(fields: Record<string, unknown>): AirtableRecord {
  return {
    id: 'recIncoming123',
    createdTime: '2026-05-05T12:00:00.000Z',
    fields,
  };
}

describe('incomingGearForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads Incoming Gear values for the full schema field set', async () => {
    vi.mocked(loadInventoryRecord).mockResolvedValue(buildRecord({
      'Arrival Date': '2026-04-01T00:00:00.000Z',
      'Pick Up #': 'PU-42',
      'Acquired From': 'Walk-in seller',
      Cost: 1499.5,
      SKU: 'SKU-100',
      Status: 'Ready to Test',
      Make: 'McIntosh',
      Model: 'MC275',
      'Component Type': ['Amplifier'],
      'Serial Number': 'SN-123',
      Voltage: '120V',
      'Inventory Notes': 'Initial notes',
      'Cosmetic Condition Notes': 'Very clean',
      'Original Box': ['Yes'],
      Manual: ['Included'],
      Remote: ['No'],
      'Power Cable': ['Included'],
      'Additional Items': 'Spare tubes',
      Weight: '68 lbs',
      'Shipping Dims': '27x25x11',
      'Shipping Method': ['Freight'],
    }));

    const values = await loadIncomingGearFormValues('recIncoming123');

    expect(values).toEqual({
      arrivalDate: '2026-04-01',
      pickUpNumber: 'PU-42',
      acquiredFrom: 'Walk-in seller',
      cost: '1499.5',
      sku: 'SKU-100',
      status: 'Ready to Test',
      make: 'McIntosh',
      model: 'MC275',
      componentType: 'Amplifier',
      serialNumber: 'SN-123',
      voltage: '120V',
      inventoryNotes: 'Initial notes',
      imageFiles: [],
      cosmeticConditionNotes: 'Very clean',
      originalBox: 'Yes',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: 'Spare tubes',
      weight: '68 lbs',
      shippingDims: '27x25x11',
      shippingMethod: 'Freight',
    });
  });

  it('submits every non-file Incoming Gear schema field and uploads images', async () => {
    const values: IncomingGearFormValues = {
      arrivalDate: '2026-04-01',
      pickUpNumber: 'PU-42',
      acquiredFrom: 'Walk-in seller',
      cost: '1499.5',
      sku: 'SKU-100',
      status: 'Ready to Test',
      make: 'McIntosh',
      model: 'MC275',
      componentType: 'Amplifier',
      serialNumber: 'SN-123',
      voltage: '120V',
      inventoryNotes: 'Initial notes',
      imageFiles: [new File(['image'], 'front.jpg', { type: 'image/jpeg' })],
      cosmeticConditionNotes: 'Very clean',
      originalBox: 'Yes',
      manual: 'Included',
      remote: 'No',
      powerCable: 'Included',
      additionalItems: 'Spare tubes',
      weight: '68 lbs',
      shippingDims: '27x25x11',
      shippingMethod: 'Freight',
    };

    vi.mocked(updateConfiguredRecord).mockResolvedValue(buildRecord({}));

    const result = await submitIncomingGearForm(values, 'recIncoming123');

    expect(result).toEqual({
      recordId: 'recIncoming123',
      sku: 'SKU-100',
      action: 'updated',
    });

    expect(createConfiguredRecord).not.toHaveBeenCalled();
    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'inventory-directory',
      'recIncoming123',
      {
        'Arrival Date': '2026-04-01',
        'Pick Up #': 'PU-42',
        'Acquired From': 'Walk-in seller',
        Cost: 1499.5,
        SKU: 'SKU-100',
        Status: 'Ready to Test',
        Make: 'McIntosh',
        Model: 'MC275',
        'Component Type': ['Amplifier'],
        'Serial Number': 'SN-123',
        Voltage: '120V',
        'Inventory Notes': 'Initial notes',
        'Cosmetic Condition Notes': 'Very clean',
        'Original Box': ['Yes'],
        Manual: ['Included'],
        Remote: ['No'],
        'Power Cable': ['Included'],
        'Additional Items': 'Spare tubes',
        Weight: '68 lbs',
        'Shipping Dims': '27x25x11',
        'Shipping Method': ['Freight'],
      },
      { typecast: true },
    );

    const submittedFields = vi.mocked(updateConfiguredRecord).mock.calls[0]?.[2] ?? {};
    expect(Object.keys(submittedFields).sort()).toEqual(
      incomingGearFormFields
        .filter((field) => field.type !== 'file')
        .map((field) => field.airtableFieldName)
        .sort(),
    );

    expect(uploadConfiguredAttachment).toHaveBeenCalledWith(
      'inventory-directory',
      'recIncoming123',
      'fldMXp0EaUHGglU8M',
      values.imageFiles[0],
    );
  });
});