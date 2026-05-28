import {
  createConfiguredRecord,
  getConfiguredRecord,
  getConfiguredFieldMetadata,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';
import {
  buildUsedGearIntakeBaseFields,
  buildUsedGearWorkflowFields,
  trimToUndefined,
} from '../../aws/src/shared/contracts/usedGearIntakeFields';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createManualIntakeFormDefaults, type ManualIntakeFormOptionFieldName, type ManualIntakeFormValues } from '@/components/tabs/manual-intake/manualIntakeFormSchema';
import { extractInventoryScalarValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

const IMAGE_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';
const DEFAULT_STATUS = 'Needs Initial Processing';
const WORKFLOW_SOURCE_MANUAL_ENTRY = 'Manual Entry';

const OPTION_FIELD_NAMES = [
  'Status',
  'Component Type',
  'Original Box',
  'Manual',
  'Remote',
  'Power Cable',
  'Shipping Method',
] as const satisfies readonly ManualIntakeFormOptionFieldName[];

type ManualIntakeOptionSet = Record<ManualIntakeFormOptionFieldName, string[]>;

export type ManualIntakeRecordSource = 'inventory-directory' | 'used-gear-workflow';
export type ManualIntakeRoute = 'lot-1' | 'lot-2-awaiting-arrival' | 'lot-2-awaiting-sku' | 'lot-2-awaiting-missing-item';

export interface ManualIntakeFormLoadResult {
  source: ManualIntakeRecordSource;
  values: ManualIntakeFormValues;
  workflowSource?: string;
  jotFormSubmissionId?: string;
}

export interface ManualIntakeFormSubmitResult {
  recordId: string;
  action: 'created' | 'updated';
}

function normalizeQualificationNotes(value: string): string {
  return value.trim();
}

function requiresQualificationGate(route: ManualIntakeRoute): boolean {
  return route !== 'lot-1';
}

function assertQualificationGate(route: ManualIntakeRoute, qualificationNotes: string): void {
  if (!requiresQualificationGate(route)) {
    return;
  }

  if (!normalizeQualificationNotes(qualificationNotes)) {
    throw new Error('Qualification Notes are required before routing a manual-entry intake row directly into an accepted Parking Lot status.');
  }
}

function dedupeOptions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function dateOrFallback(value: unknown, fallback: string): string {
  const normalizedValue = extractInventoryScalarValue(value);
  return normalizedValue ? normalizedValue.slice(0, 10) : fallback;
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

function resolveManualEntryWorkflowStatus(route: ManualIntakeRoute): string {
  if (route === 'lot-2-awaiting-arrival') return 'Accepted - Awaiting Arrival';
  if (route === 'lot-2-awaiting-sku') return 'Accepted - Arrived, Awaiting SKU';
  if (route === 'lot-2-awaiting-missing-item') return 'Accepted - Arrived, Awaiting Missing Item';
  return 'Pending Review';
}

export async function loadManualIntakeFormValues(recordId: string): Promise<ManualIntakeFormLoadResult> {
  try {
    const { source, record } = await loadConfiguredManualIntakeRecord(recordId);
    const defaults = createManualIntakeFormDefaults();

    return {
      source,
      workflowSource: extractInventoryScalarValue(record.fields['Workflow Source']),
      jotFormSubmissionId: extractInventoryScalarValue(record.fields['JotForm Submission ID']),
      values: {
        ...defaults,
        arrivalDate: dateOrFallback(record.fields['Arrival Date'], defaults.arrivalDate),
        pickUpNumber: extractInventoryScalarValue(record.fields['Pick Up #'] ?? record.fields['Pick Up ID']),
        acquiredFrom: extractInventoryScalarValue(record.fields['Acquired From']),
        cost: extractInventoryScalarValue(record.fields.Cost),
        customerCosmeticNotes: extractInventoryScalarValue(record.fields['Customer Cosmetic Notes']),
        customerFunctionalNotes: extractInventoryScalarValue(record.fields['Customer Functional Notes']),
        customerInclusionNotes: extractInventoryScalarValue(record.fields['Customer Inclusion Notes']),
        customerSubmittedPhotosNotes: extractInventoryScalarValue(record.fields['Customer Submitted Photos Notes']),
        status: extractInventoryScalarValue(record.fields.Status) || defaults.status,
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
      acc[fieldName] = dedupeOptions((field?.options?.choices ?? []).map((choice) => choice.name));
      return acc;
    }, {
      Status: [],
      'Component Type': [],
      'Original Box': [],
      Manual: [],
      Remote: [],
      'Power Cable': [],
      'Shipping Method': [],
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
    manualEntryRoute?: ManualIntakeRoute;
    submissionGroupId?: string;
    pickUpId?: string;
    qualificationNotes?: string;
  } = {},
): Promise<ManualIntakeFormSubmitResult> {
  const costValue = trimToUndefined(values.cost);
  const statusValue = trimToUndefined(values.status) ?? DEFAULT_STATUS;
  const manualRoute = options.manualEntryRoute ?? 'lot-1';
  const qualificationNotes = normalizeQualificationNotes(options.qualificationNotes ?? '');

  assertQualificationGate(manualRoute, qualificationNotes);

  const baseFields = buildUsedGearIntakeBaseFields({
    arrivalDate: values.arrivalDate,
    pickUpNumber: values.pickUpNumber,
    acquiredFrom: values.acquiredFrom,
    cost: costValue,
    customerCosmeticNotes: values.customerCosmeticNotes,
    customerFunctionalNotes: values.customerFunctionalNotes,
    customerInclusionNotes: values.customerInclusionNotes,
    customerSubmittedPhotosNotes: values.customerSubmittedPhotosNotes,
    status: statusValue,
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
  });

  const workflowFields = buildUsedGearWorkflowFields({
    workflowSource: WORKFLOW_SOURCE_MANUAL_ENTRY,
    workflowStatus: resolveManualEntryWorkflowStatus(manualRoute),
    submissionGroupId: options.submissionGroupId ?? '',
    pickUpId: options.pickUpId ?? '',
    qualificationNotes,
    qualificationComplete: manualRoute === 'lot-1' ? false : true,
    acceptedBy: manualRoute === 'lot-1' ? undefined : WORKFLOW_SOURCE_MANUAL_ENTRY,
    acceptedAt: manualRoute === 'lot-1' ? undefined : new Date().toISOString(),
    trashStatus: null,
    unqualifiedReason: null,
  });

  if (recordId) {
    try {
      const writeSource = options.recordSource ?? 'inventory-directory';
      const fieldsToUpdate = writeSource === 'used-gear-workflow'
        ? { ...baseFields, ...workflowFields }
        : baseFields;
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

  try {
    const createdRecord = await createConfiguredRecord(
      'used-gear-workflow',
      { ...baseFields, ...workflowFields },
      { typecast: true },
    );

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
