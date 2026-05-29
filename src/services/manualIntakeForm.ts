import {
  createConfiguredRecord,
  getConfiguredRecord,
  getConfiguredFieldMetadata,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';
import {
  buildUsedGearIntakeBaseFields,
  trimToUndefined,
} from '../../aws/src/shared/contracts/usedGearIntakeFields';
import { buildUsedGearItemTitle } from '../../aws/src/shared/contracts/usedGearItemTitle';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createManualIntakeFormDefaults, type ManualIntakeFormOptionFieldName, type ManualIntakeFormValues } from '@/components/tabs/manual-intake/manualIntakeFormSchema';
import { extractInventoryScalarValue } from '@/services/inventoryDirectory';
import { getUsedGearRecordItemTitle } from '@/services/usedGearItemTitle';
import type { AirtableRecord } from '@/types/airtable';

const IMAGE_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';
const DEFAULT_STATUS = 'Needs Initial Processing';
const WORKFLOW_SOURCE_MANUAL_ENTRY = 'Manual Entry';

const OPTION_FIELD_NAMES = [
  'Component Type',
  'Original Box',
  'Manual',
  'Remote',
  'Power Cable',
  'Shipping Method',
  'Seller Location',
  'How Did You Hear',
  'Original Owner',
  'Smoke Exposure',
] as const satisfies readonly ManualIntakeFormOptionFieldName[];

type ManualIntakeOptionSet = Record<ManualIntakeFormOptionFieldName, string[]>;

// "Other (describe in notes)" was added to Original Box after the Airtable schema was cached;
// seed it here so the UI always shows the option even before a record uses it.
const ORIGINAL_BOX_SEED_OPTIONS = ['Other (describe in notes)'] as const;

export type ManualIntakeRecordSource = 'inventory-directory' | 'used-gear-workflow';

export interface ManualIntakeFormLoadResult {
  source: ManualIntakeRecordSource;
  values: ManualIntakeFormValues;
  itemTitle: string;
  workflowSource?: string;
  jotFormSubmissionId?: string;
}

export interface ManualIntakeFormSubmitResult {
  recordId: string;
  action: 'created' | 'updated';
}

function dedupeOptions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function uploadManualIntakeImages(recordId: string, files: File[]): Promise<void> {
  for (const file of files) {
    await uploadConfiguredAttachment('inventory-directory', recordId, IMAGE_ATTACHMENT_FIELD_ID, file);
  }
}

async function loadConfiguredManualIntakeRecord(recordId: string): Promise<{ source: ManualIntakeRecordSource; record: AirtableRecord }> {
  try {
    const workflowRecord = await getConfiguredRecord('used-gear-workflow', recordId);
    return { source: 'used-gear-workflow', record: workflowRecord };
  } catch {
    const inventoryRecord = await getConfiguredRecord('inventory-directory', recordId);
    return { source: 'inventory-directory', record: inventoryRecord };
  }
}

function buildManualIntakeItemTitle(
  values: ManualIntakeFormValues,
  options: {
    recordId?: string | null;
  } = {},
): string {
  return buildUsedGearItemTitle({
    make: values.make,
    model: values.model,
    componentType: values.componentType,
    serialNumber: values.serialNumber,
    pickUpId: values.pickUpNumber,
    recordId: options.recordId,
  });
}

export async function loadManualIntakeFormValues(recordId: string): Promise<ManualIntakeFormLoadResult> {
  try {
    const { source, record } = await loadConfiguredManualIntakeRecord(recordId);
    const defaults = createManualIntakeFormDefaults();

    return {
      source,
      itemTitle: getUsedGearRecordItemTitle(record.fields, record.id),
      workflowSource: extractInventoryScalarValue(record.fields['Workflow Source']),
      jotFormSubmissionId: extractInventoryScalarValue(record.fields['JotForm Submission ID']),
      values: {
        ...defaults,
        pickUpNumber: extractInventoryScalarValue(record.fields['Pick Up #'] ?? record.fields['Pick Up ID']),
        ...(() => {
          const full = extractInventoryScalarValue(record.fields['Acquired From']) ?? '';
          const idx = full.lastIndexOf(' ');
          const [rawFirst, rawLast] = idx >= 0
            ? [full.slice(0, idx), full.slice(idx + 1)]
            : [full, ''];
          return {
            sellerFirstName: rawFirst.replace(/,+$/, '').trimEnd(),
            sellerLastName: rawLast,
          };
        })(),
        cost: extractInventoryScalarValue(record.fields.Cost),
        customerCosmeticNotes: extractInventoryScalarValue(record.fields['Customer Cosmetic Notes']),
        customerFunctionalNotes: extractInventoryScalarValue(record.fields['Customer Functional Notes']),
        customerInclusionNotes: extractInventoryScalarValue(record.fields['Customer Inclusion Notes']),
        make: extractInventoryScalarValue(record.fields.Make),
        model: extractInventoryScalarValue(record.fields.Model),
        componentType: extractInventoryScalarValue(record.fields['Component Type']),
        serialNumber: extractInventoryScalarValue(record.fields['Serial Number']),
        voltage: extractInventoryScalarValue(record.fields.Voltage),
        inventoryNotes: extractInventoryScalarValue(record.fields['Inventory Notes']),
        imageFiles: [],
        cosmeticConditionNotes: extractInventoryScalarValue(record.fields['Testing Cosmetic Notes'] ?? record.fields['Cosmetic Condition Notes']),
        originalBox: extractInventoryScalarValue(record.fields['Original Box']),
        manual: extractInventoryScalarValue(record.fields.Manual),
        remote: extractInventoryScalarValue(record.fields.Remote),
        powerCable: extractInventoryScalarValue(record.fields['Power Cable']),
        additionalItems: extractInventoryScalarValue(record.fields['Additional Items']),
        weight: extractInventoryScalarValue(record.fields.Weight),
        shippingDims: extractInventoryScalarValue(record.fields['Shipping Dims']),
        shippingMethod: extractInventoryScalarValue(record.fields['Shipping Method']),
        sellerEmail: extractInventoryScalarValue(record.fields['Seller Email']),
        sellerPhone: extractInventoryScalarValue(record.fields['Seller Phone']),
        sellerZipCode: extractInventoryScalarValue(record.fields['Seller Zip Code']),
        sellerLocation: extractInventoryScalarValue(record.fields['Seller Location']),
        howDidYouHear: extractInventoryScalarValue(record.fields['How Did You Hear']),
        originalOwner: extractInventoryScalarValue(record.fields['Original Owner']),
        smokeExposure: extractInventoryScalarValue(record.fields['Smoke Exposure']),
      },
    };
  } catch (error) {
    logServiceError('manualIntakeForm', `Error loading Manual Intake form values for ${recordId}`, error);
    const serviceError = createServiceError({
      service: 'manualIntakeForm',
      code: 'MANUAL_INTAKE_LOAD_FAILED',
      userMessage: 'Unable to load the selected inventory record into Manual Intake.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function loadManualIntakeFormOptionSets(): Promise<ManualIntakeOptionSet> {
  try {
    const fields = await getConfiguredFieldMetadata('inventory-directory');

    return OPTION_FIELD_NAMES.reduce<ManualIntakeOptionSet>((acc, fieldName) => {
      const field = fields.find((entry) => entry.name === fieldName);
      const choices = (field?.options?.choices ?? []).map((choice) => choice.name);
      const seedOptions = fieldName === 'Original Box' ? ORIGINAL_BOX_SEED_OPTIONS : [];
      acc[fieldName] = dedupeOptions([...choices, ...seedOptions]);
      return acc;
    }, {
      'Component Type': [],
      'Original Box': [],
      Manual: [],
      Remote: [],
      'Power Cable': [],
      'Shipping Method': [],
      'Seller Location': [],
      'How Did You Hear': [],
      'Original Owner': [],
      'Smoke Exposure': [],
    });
  } catch (error) {
    logServiceError('manualIntakeForm', 'Error loading Manual Intake form option sets', error);
    const serviceError = createServiceError({
      service: 'manualIntakeForm',
      code: 'MANUAL_INTAKE_OPTIONS_FAILED',
      userMessage: 'Unable to load the Manual Intake form options from Airtable.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function submitManualIntakeForm(
  values: ManualIntakeFormValues,
  recordId?: string | null,
  options: {
    recordSource?: ManualIntakeRecordSource;
  } = {},
): Promise<ManualIntakeFormSubmitResult> {
  const costValue = trimToUndefined(values.cost);

  const baseFields = buildUsedGearIntakeBaseFields({
    pickUpNumber: values.pickUpNumber,
    acquiredFrom: [values.sellerFirstName, values.sellerLastName].filter(Boolean).join(' ').trim() || undefined,
    cost: costValue,
    customerCosmeticNotes: values.customerCosmeticNotes,
    customerFunctionalNotes: values.customerFunctionalNotes,
    customerInclusionNotes: values.customerInclusionNotes,
    status: recordId ? undefined : DEFAULT_STATUS,
    make: values.make,
    model: values.model,
    componentType: values.componentType,
    serialNumber: values.serialNumber,
    voltage: values.voltage,
    inventoryNotes: values.inventoryNotes,
    cosmeticConditionNotes: values.cosmeticConditionNotes,
    originalBox: values.originalBox,
    manual: values.manual,
    remote: values.remote,
    powerCable: values.powerCable,
    additionalItems: values.additionalItems,
    weight: values.weight,
    shippingDims: values.shippingDims,
    shippingMethod: values.shippingMethod,
    sellerEmail: values.sellerEmail,
    sellerPhone: values.sellerPhone,
    sellerZipCode: values.sellerZipCode,
    sellerLocation: values.sellerLocation,
    howDidYouHear: values.howDidYouHear,
    originalOwner: values.originalOwner,
    smokeExposure: values.smokeExposure,
  });
  const intakeFields = baseFields;

  if (recordId) {
    try {
      const writeSource = options.recordSource ?? 'inventory-directory';
      const itemTitle = buildManualIntakeItemTitle(values, { recordId });
      const fieldsToUpdate = { ...intakeFields, 'Item Title': itemTitle };
      const updatedRecord = await updateConfiguredRecord(
        writeSource,
        recordId,
        fieldsToUpdate,
        { typecast: true },
      );

      if (values.imageFiles.length > 0) {
        await uploadManualIntakeImages(updatedRecord.id, values.imageFiles);
      }

      return {
        recordId: updatedRecord.id,
        action: 'updated',
      };
    } catch (error) {
      logServiceError('manualIntakeForm', `Error updating Manual Intake submission ${recordId}`, error);
      const serviceError = createServiceError({
        service: 'manualIntakeForm',
        code: 'MANUAL_INTAKE_UPDATE_FAILED',
        userMessage: 'Unable to update the Manual Intake fields for this inventory record.',
        retryable: true,
        cause: error,
      });
      const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
      typedError.serviceError = serviceError;
      throw typedError;
    }
  }

  let lastError: unknown = null;

  const createWorkflowFields = {
    'Workflow Source': WORKFLOW_SOURCE_MANUAL_ENTRY,
    'Workflow Status': 'Pending Review',
    'Qualification Complete': false,
    'Trash Status': null,
    'Unqualified Reason': null,
  };

  try {
    const initialItemTitle = buildManualIntakeItemTitle(values);
    const createdRecord = await createConfiguredRecord(
      'used-gear-workflow',
      { ...intakeFields, ...createWorkflowFields, 'Item Title': initialItemTitle },
      { typecast: true },
    );

    const finalItemTitle = buildManualIntakeItemTitle(values, { recordId: createdRecord.id });
    if (finalItemTitle !== initialItemTitle) {
      await updateConfiguredRecord('used-gear-workflow', createdRecord.id, {
        'Item Title': finalItemTitle,
      }, { typecast: true });
    }

    if (values.imageFiles.length > 0) {
      await uploadManualIntakeImages(createdRecord.id, values.imageFiles);
    }

    return {
      recordId: createdRecord.id,
      action: 'created',
    };
  } catch (error) {
    lastError = error;
  }

  logServiceError('manualIntakeForm', 'Error creating Manual Intake submission', lastError);
  const serviceError = createServiceError({
    service: 'manualIntakeForm',
    code: 'MANUAL_INTAKE_SUBMIT_FAILED',
    userMessage: 'Unable to submit the Manual Intake form to Airtable.',
    retryable: true,
    cause: lastError,
  });
  const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
  typedError.serviceError = serviceError;
  throw typedError;
}
