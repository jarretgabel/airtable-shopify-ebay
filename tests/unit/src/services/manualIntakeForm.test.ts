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
      'Pick Up #': 'PU-42',
      'Acquired From': 'Walk-in seller',
      Cost: 1499.5,
      'Customer Cosmetic Notes': 'Seller says very clean faceplate.',
      'Customer Functional Notes': 'Seller reports fully working on both channels.',
      'Customer Inclusion Notes': 'Original cage and spare tubes included.',
      'Customer Submitted Photos Notes': 'Customer sent rear-panel serial photo.',
      Status: 'Ready to Test',
      Make: 'McIntosh',
      Model: 'MC275',
      'Component Type': ['Amplifier'],
      'Serial Number': 'SN-123',
      Voltage: '120V',
      'Inventory Notes': 'Initial notes',
      'Testing Cosmetic Notes': 'Very clean',
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
      itemTitle: 'McIntosh MC275 - Incoming123',
      workflowSource: '',
      jotFormSubmissionId: '',
      values: {
        pickUpNumber: 'PU-42',
        sellerFirstName: 'Walk-in',
        sellerLastName: 'seller',
        cost: '1499.5',
        customerCosmeticNotes: 'Seller says very clean faceplate.',
        customerFunctionalNotes: 'Seller reports fully working on both channels.',
        customerInclusionNotes: 'Original cage and spare tubes included.',
        customerSubmittedPhotosNotes: 'Customer sent rear-panel serial photo.',
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
        sellerEmail: '',
        sellerPhone: '',
        sellerZipCode: '',
        sellerLocation: '',
        howDidYouHear: '',
        originalOwner: '',
        smokeExposure: '',
      },
    });
  });

  it('returns workflow metadata for JotForm-backed intake rows', async () => {
    vi.mocked(getConfiguredRecord).mockResolvedValue(buildRecord({
      'Workflow Source': 'JotForm',
      'JotForm Submission ID': 'sub-777',
    }));

    const result = await loadManualIntakeFormValues('recIncoming123');

    expect(result.workflowSource).toBe('JotForm');
    expect(result.jotFormSubmissionId).toBe('sub-777');
  });

  it('falls back to the inventory source when the workflow source misses the row', async () => {
    vi.mocked(getConfiguredRecord)
      .mockRejectedValueOnce(new Error('Missing operational record'))
      .mockResolvedValueOnce(buildRecord({ SKU: 'INV-1' }));

    const result = await loadManualIntakeFormValues('recIncoming123');

    expect(result.source).toBe('inventory-directory');
    expect(result.values.make).toBe('');
  });

  it('submits every non-file Manual Intake schema field and uploads images', async () => {
    const values: ManualIntakeFormValues = {
      pickUpNumber: 'PU-42',
      sellerFirstName: 'Walk-in seller',
      sellerLastName: '',
      cost: '1499.5',
      customerCosmeticNotes: 'Seller says very clean faceplate.',
      customerFunctionalNotes: 'Seller reports no hum or crackle.',
      customerInclusionNotes: 'Original cage included.',
      customerSubmittedPhotosNotes: 'Customer sent front and rear photos.',
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
      sellerEmail: 'seller@example.com',
      sellerPhone: '(212) 555-0100',
      sellerZipCode: '10001',
      sellerLocation: 'Greater NYC',
      howDidYouHear: 'Friend',
      originalOwner: 'Yes - original owner',
      smokeExposure: 'No, smoke-free home',
    };

    vi.mocked(updateConfiguredRecord).mockResolvedValue(buildRecord({}));

    const result = await submitManualIntakeForm(values, 'recIncoming123');

    expect(result).toEqual({
      recordId: 'recIncoming123',
      action: 'updated',
    });

    expect(createConfiguredRecord).not.toHaveBeenCalled();
    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'inventory-directory',
      'recIncoming123',
      {
        'Pick Up #': 'PU-42',
        'Acquired From': 'Walk-in seller',
        Cost: 1499.5,
        'Customer Cosmetic Notes': 'Seller says very clean faceplate.',
        'Customer Functional Notes': 'Seller reports no hum or crackle.',
        'Customer Inclusion Notes': 'Original cage included.',
        'Customer Submitted Photos Notes': 'Customer sent front and rear photos.',
        Status: 'Ready to Test',
        'Item Title': 'McIntosh MC275 - Incoming123',
        Make: 'McIntosh',
        Model: 'MC275',
        'Component Type': ['Amplifier'],
        'Serial Number': 'SN-123',
        Voltage: '120V',
        'Inventory Notes': 'Initial notes',
        'Testing Cosmetic Notes': 'Very clean',
        'Original Box': ['Yes'],
        Manual: ['Included'],
        Remote: ['No'],
        'Power Cable': ['Included'],
        'Additional Items': 'Spare tubes',
        Weight: '68 lbs',
        'Shipping Dims': '27x25x11',
        'Shipping Method': ['Freight'],
        'Seller Email': 'seller@example.com',
        'Seller Phone': '(212) 555-0100',
        'Seller Zip Code': '10001',
        'Seller Location': 'Greater NYC',
        'How Did You Hear': 'Friend',
        'Original Owner': 'Yes - original owner',
        'Smoke Exposure': 'No, smoke-free home',
      },
      { typecast: true },
    );

    const submittedFields = vi.mocked(updateConfiguredRecord).mock.calls[0]?.[2] ?? {};
    expect(Object.keys(submittedFields).sort()).toEqual(
      [...new Set(
        manualIntakeFormFields
          .filter((field) => field.type !== 'file')
          .map((field) => field.airtableFieldName)
          .concat(['Item Title']),
      )].sort(),
    );

    expect(uploadConfiguredAttachment).toHaveBeenCalledWith(
      'inventory-directory',
      'recIncoming123',
      'fldMXp0EaUHGglU8M',
      values.imageFiles[0],
    );
  });

  it('creates manual-entry rows through the workflow source with Pending Review status', async () => {
    const values: ManualIntakeFormValues = {
      pickUpNumber: 'PU-77',
      sellerFirstName: 'Phone',
      sellerLastName: 'deal',
      cost: '999',
      customerCosmeticNotes: 'Seller reports light edge wear.',
      customerFunctionalNotes: 'Seller says both channels work.',
      customerInclusionNotes: 'Power cable only.',
      customerSubmittedPhotosNotes: 'Photos received by text message.',
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
      sellerEmail: '',
      sellerPhone: '',
      sellerZipCode: '',
      sellerLocation: '',
      howDidYouHear: '',
      originalOwner: '',
      smokeExposure: '',
    };

    vi.mocked(createConfiguredRecord).mockResolvedValue(buildRecord({}));

    const result = await submitManualIntakeForm(values, null);

    expect(result.action).toBe('created');
    expect(createConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      expect.objectContaining({
        'Workflow Source': 'Manual Entry',
        'Workflow Status': 'Pending Review',
        'Item Title': 'Marantz Model 8B',
        'Qualification Complete': false,
        'Customer Cosmetic Notes': 'Seller reports light edge wear.',
        'Customer Functional Notes': 'Seller says both channels work.',
        'Customer Inclusion Notes': 'Power cable only.',
        'Customer Submitted Photos Notes': 'Photos received by text message.',
      }),
      { typecast: true },
    );
    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recIncoming123',
      {
        'Item Title': 'Marantz Model 8B - Incoming123',
      },
      { typecast: true },
    );
  });
});
