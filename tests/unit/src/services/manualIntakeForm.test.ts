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
import { manualIntakeFormFields, type ManualIntakeFormValues } from '@/components/tabs/manual-intake/manualIntakeFormSchema';
import { loadManualIntakeFormValues, submitManualIntakeForm } from '@/services/manualIntakeForm';

function buildRecord(fields: Record<string, unknown>): AirtableRecord {
  return {
    id: 'recIncoming123',
    createdTime: '2026-05-05T12:00:00.000Z',
    fields,
  };
}

describe('manualIntakeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads Manual Intake values for the full schema field set', async () => {
    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      'Arrival Date': '2026-04-01T00:00:00.000Z',
      'Pick Up #': 'PU-42',
      'Acquired From': 'Walk-in seller',
      Cost: 1499.5,
      'Customer Cosmetic Notes': 'Seller says very clean faceplate.',
      'Customer Functional Notes': 'Seller reports fully working on both channels.',
      'Customer Inclusion Notes': 'Original cage and spare tubes included.',
      'Customer Submitted Photos Notes': 'Customer sent rear-panel serial photo.',
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

    const result = await loadManualIntakeFormValues('recIncoming123');

    expect(result).toEqual({
      source: 'used-gear-workflow',
      values: {
        arrivalDate: '2026-04-01',
        pickUpNumber: 'PU-42',
        acquiredFrom: 'Walk-in seller',
        cost: '1499.5',
        customerCosmeticNotes: 'Seller says very clean faceplate.',
        customerFunctionalNotes: 'Seller reports fully working on both channels.',
        customerInclusionNotes: 'Original cage and spare tubes included.',
        customerSubmittedPhotosNotes: 'Customer sent rear-panel serial photo.',
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
      },
    });
  });

  it('falls back to the inventory source when the workflow source misses the row', async () => {
    vi.mocked(getConfiguredRecord)
      .mockRejectedValueOnce(new Error('Missing operational record'))
      .mockResolvedValueOnce(buildRecord({ SKU: 'INV-1' }));

    const result = await loadManualIntakeFormValues('recIncoming123');

    expect(result.source).toBe('inventory-directory');
    expect(result.values.sku).toBe('INV-1');
  });

  it('submits every non-file Manual Intake schema field and uploads images', async () => {
    const values: ManualIntakeFormValues = {
      arrivalDate: '2026-04-01',
      pickUpNumber: 'PU-42',
      acquiredFrom: 'Walk-in seller',
      cost: '1499.5',
      customerCosmeticNotes: 'Seller says very clean faceplate.',
      customerFunctionalNotes: 'Seller reports no hum or crackle.',
      customerInclusionNotes: 'Original cage included.',
      customerSubmittedPhotosNotes: 'Customer sent front and rear photos.',
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

    const result = await submitManualIntakeForm(values, 'recIncoming123');

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
        'Customer Cosmetic Notes': 'Seller says very clean faceplate.',
        'Customer Functional Notes': 'Seller reports no hum or crackle.',
        'Customer Inclusion Notes': 'Original cage included.',
        'Customer Submitted Photos Notes': 'Customer sent front and rear photos.',
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
      manualIntakeFormFields
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

  it('creates manual-entry rows through the workflow source with lot-routing fields', async () => {
    const values: ManualIntakeFormValues = {
      arrivalDate: '2026-04-01',
      pickUpNumber: 'PU-77',
      acquiredFrom: 'Phone deal',
      cost: '999',
      customerCosmeticNotes: 'Seller reports light edge wear.',
      customerFunctionalNotes: 'Seller says both channels work.',
      customerInclusionNotes: 'Power cable only.',
      customerSubmittedPhotosNotes: 'Photos received by text message.',
      sku: '',
      status: 'Needs Initial Processing',
      make: 'Marantz',
      model: 'Model 8B',
      componentType: 'Amplifier',
      serialNumber: '',
      voltage: '120V',
      inventoryNotes: 'Manual intake',
      imageFiles: [],
      cosmeticConditionNotes: '',
      originalBox: '',
      manual: '',
      remote: '',
      powerCable: '',
      additionalItems: '',
      weight: '',
      shippingDims: '',
      shippingMethod: '',
    };

    vi.mocked(createConfiguredRecord).mockResolvedValue(buildRecord({}));

    const result = await submitManualIntakeForm(values, null, {
      manualEntryRoute: 'lot-2-awaiting-arrival',
      submissionGroupId: 'SUB-42',
      pickUpId: 'PU-77',
      qualificationNotes: 'Seller already approved over phone.',
    });

    expect(result.action).toBe('created');
    expect(createConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      expect.objectContaining({
        'Workflow Source': 'Manual Entry',
        'Workflow Status': 'Accepted - Awaiting Arrival',
        'Submission Group ID': 'SUB-42',
        'Pick Up ID': 'PU-77',
        'Qualification Notes': 'Seller already approved over phone.',
        'Qualification Complete': true,
        'Customer Cosmetic Notes': 'Seller reports light edge wear.',
        'Customer Functional Notes': 'Seller says both channels work.',
        'Customer Inclusion Notes': 'Power cable only.',
        'Customer Submitted Photos Notes': 'Photos received by text message.',
      }),
      { typecast: true },
    );
  });

  it('requires qualification notes before routing manual entry directly to Lot 2', async () => {
    const values: ManualIntakeFormValues = {
      arrivalDate: '2026-04-01',
      pickUpNumber: 'PU-88',
      acquiredFrom: 'Walk-in seller',
      cost: '500',
      customerCosmeticNotes: '',
      customerFunctionalNotes: '',
      customerInclusionNotes: '',
      customerSubmittedPhotosNotes: '',
      sku: '',
      status: 'Needs Initial Processing',
      make: 'Adcom',
      model: 'GFA-555',
      componentType: 'Amplifier',
      serialNumber: '',
      voltage: '',
      inventoryNotes: '',
      imageFiles: [],
      cosmeticConditionNotes: '',
      originalBox: '',
      manual: '',
      remote: '',
      powerCable: '',
      additionalItems: '',
      weight: '',
      shippingDims: '',
      shippingMethod: '',
    };

    await expect(submitManualIntakeForm(values, null, {
      manualEntryRoute: 'lot-2-awaiting-arrival',
      qualificationNotes: '',
    })).rejects.toThrow('Qualification Notes are required before routing a manual-entry intake row directly to Lot 2.');
  });
});
