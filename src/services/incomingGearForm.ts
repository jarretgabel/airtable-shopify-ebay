import {
  createConfiguredRecord,
  getConfiguredRecord,
  getConfiguredFieldMetadata,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createIncomingGearFormDefaults, type IncomingGearFormOptionFieldName, type IncomingGearFormValues } from '@/components/tabs/incoming-gear/incomingGearFormSchema';
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
] as const satisfies readonly IncomingGearFormOptionFieldName[];

type IncomingGearOptionSet = Record<IncomingGearFormOptionFieldName, string[]>;

export type IncomingGearRecordSource = 'inventory-directory' | 'used-gear-workflow';
export type IncomingGearManualEntryRoute = 'lot-1' | 'lot-2-awaiting-arrival' | 'lot-2-awaiting-sku' | 'lot-2-awaiting-missing-item';

export interface IncomingGearFormLoadResult {
  source: IncomingGearRecordSource;
  values: IncomingGearFormValues;
}

export interface IncomingGearFormSubmitResult {
  recordId: string;
  sku: string;
  action: 'created' | 'updated';
}

function normalizeQualificationNotes(value: string): string {
  return value.trim();
}

function requiresQualificationGate(route: IncomingGearManualEntryRoute): boolean {
  return route !== 'lot-1';
}

function assertQualificationGate(route: IncomingGearManualEntryRoute, qualificationNotes: string): void {
  if (!requiresQualificationGate(route)) {
    return;
  }

  if (!normalizeQualificationNotes(qualificationNotes)) {
    throw new Error('Qualification Notes are required before routing a manual-entry intake row directly to Lot 2.');
  }
}

function dedupeOptions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function trimToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function dateOrFallback(value: unknown, fallback: string): string {
  const normalizedValue = extractInventoryScalarValue(value);
  return normalizedValue ? normalizedValue.slice(0, 10) : fallback;
}

function arrayOrUndefined(value: string): string[] | undefined {
  const trimmed = trimToUndefined(value);
  return trimmed ? [trimmed] : undefined;
}

function singleValueAsArrayOrUndefined(value: string): string[] | undefined {
  const trimmed = trimToUndefined(value);
  return trimmed ? [trimmed] : undefined;
}

function compactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );
}

function createTemporarySku(): string {
  const iso = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `INTAKE-${iso}`;
}

async function uploadIncomingGearImages(recordId: string, files: File[]): Promise<void> {
  for (const file of files) {
    await uploadConfiguredAttachment('inventory-directory', recordId, IMAGE_ATTACHMENT_FIELD_ID, file);
  }
}

async function loadConfiguredIncomingGearRecord(recordId: string): Promise<{ source: IncomingGearRecordSource; record: AirtableRecord }> {
  try {
    const workflowRecord = await getConfiguredRecord('used-gear-workflow', recordId);
    return { source: 'used-gear-workflow', record: workflowRecord };
  } catch {
    const inventoryRecord = await getConfiguredRecord('inventory-directory', recordId);
    return { source: 'inventory-directory', record: inventoryRecord };
  }
}

function resolveManualEntryWorkflowStatus(route: IncomingGearManualEntryRoute): string {
  if (route === 'lot-2-awaiting-arrival') return 'Accepted - Awaiting Arrival';
  if (route === 'lot-2-awaiting-sku') return 'Accepted - Arrived, Awaiting SKU';
  if (route === 'lot-2-awaiting-missing-item') return 'Accepted - Arrived, Awaiting Missing Item';
  return 'Pending Review';
}

export async function loadIncomingGearFormValues(recordId: string): Promise<IncomingGearFormLoadResult> {
  try {
    const { source, record } = await loadConfiguredIncomingGearRecord(recordId);
    const defaults = createIncomingGearFormDefaults();

    return {
      source,
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
        sku: extractInventoryScalarValue(record.fields.SKU),
        status: extractInventoryScalarValue(record.fields.Status) || defaults.status,
        make: extractInventoryScalarValue(record.fields.Make),
        model: extractInventoryScalarValue(record.fields.Model),
        componentType: extractInventoryScalarValue(record.fields['Component Type']),
        serialNumber: extractInventoryScalarValue(record.fields['Serial Number']),
        voltage: extractInventoryScalarValue(record.fields.Voltage),
        inventoryNotes: extractInventoryScalarValue(record.fields['Inventory Notes']),
        imageFiles: [],
        cosmeticConditionNotes: extractInventoryScalarValue(record.fields['Cosmetic Condition Notes']),
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
    logServiceError('incomingGearForm', `Error loading Incoming Gear form values for ${recordId}`, error);
    const serviceError = createServiceError({
      service: 'incomingGearForm',
      code: 'INCOMING_GEAR_LOAD_FAILED',
      userMessage: 'Unable to load the selected inventory record into Incoming Gear.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function loadIncomingGearFormOptionSets(): Promise<IncomingGearOptionSet> {
  try {
    const fields = await getConfiguredFieldMetadata('inventory-directory');

    return OPTION_FIELD_NAMES.reduce<IncomingGearOptionSet>((acc, fieldName) => {
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
    logServiceError('incomingGearForm', 'Error loading Incoming Gear form option sets', error);
    const serviceError = createServiceError({
      service: 'incomingGearForm',
      code: 'INCOMING_GEAR_OPTIONS_FAILED',
      userMessage: 'Unable to load the Incoming Gear form options from Airtable.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function submitIncomingGearForm(
  values: IncomingGearFormValues,
  recordId?: string | null,
  options: {
    recordSource?: IncomingGearRecordSource;
    manualEntryRoute?: IncomingGearManualEntryRoute;
    submissionGroupId?: string;
    pickUpId?: string;
    qualificationNotes?: string;
  } = {},
): Promise<IncomingGearFormSubmitResult> {
  const costValue = trimToUndefined(values.cost);
  const skuValue = trimToUndefined(values.sku) ?? createTemporarySku();
  const statusValue = trimToUndefined(values.status) ?? DEFAULT_STATUS;
  const manualRoute = options.manualEntryRoute ?? 'lot-1';
  const qualificationNotes = normalizeQualificationNotes(options.qualificationNotes ?? '');

  assertQualificationGate(manualRoute, qualificationNotes);

  const baseFields = compactFields({
    'Arrival Date': trimToUndefined(values.arrivalDate),
    'Pick Up #': trimToUndefined(values.pickUpNumber),
    'Acquired From': trimToUndefined(values.acquiredFrom),
    Cost: costValue ? Number.parseFloat(costValue) : undefined,
    'Customer Cosmetic Notes': trimToUndefined(values.customerCosmeticNotes),
    'Customer Functional Notes': trimToUndefined(values.customerFunctionalNotes),
    'Customer Inclusion Notes': trimToUndefined(values.customerInclusionNotes),
    'Customer Submitted Photos Notes': trimToUndefined(values.customerSubmittedPhotosNotes),
    SKU: skuValue,
    Status: statusValue,
    Make: trimToUndefined(values.make),
    Model: trimToUndefined(values.model),
    'Component Type': singleValueAsArrayOrUndefined(values.componentType),
    'Serial Number': trimToUndefined(values.serialNumber),
    Voltage: trimToUndefined(values.voltage),
    'Inventory Notes': trimToUndefined(values.inventoryNotes),
    'Cosmetic Condition Notes': trimToUndefined(values.cosmeticConditionNotes),
    'Original Box': arrayOrUndefined(values.originalBox),
    Manual: arrayOrUndefined(values.manual),
    Remote: arrayOrUndefined(values.remote),
    'Power Cable': arrayOrUndefined(values.powerCable),
    'Additional Items': trimToUndefined(values.additionalItems),
    Weight: trimToUndefined(values.weight),
    'Shipping Dims': trimToUndefined(values.shippingDims),
    'Shipping Method': arrayOrUndefined(values.shippingMethod),
  });

  const workflowFields = compactFields({
    'Workflow Source': WORKFLOW_SOURCE_MANUAL_ENTRY,
    'Workflow Status': resolveManualEntryWorkflowStatus(manualRoute),
    'Submission Group ID': trimToUndefined(options.submissionGroupId ?? ''),
    'Pick Up ID': trimToUndefined(options.pickUpId ?? ''),
    'Qualification Notes': qualificationNotes || undefined,
    'Qualification Complete': manualRoute === 'lot-1' ? false : true,
    'Accepted By': manualRoute === 'lot-1' ? undefined : WORKFLOW_SOURCE_MANUAL_ENTRY,
    'Accepted At': manualRoute === 'lot-1' ? undefined : new Date().toISOString(),
    'Trash Status': null,
    'Unqualified Reason': null,
  });

  const createCandidates: Array<Record<string, unknown>> = [
    compactFields({ SKU: { text: skuValue }, ...baseFields, ...workflowFields }),
    compactFields({ SKU: skuValue, ...baseFields, ...workflowFields }),
    compactFields({ ...baseFields, ...workflowFields }),
  ];

  if (recordId) {
    try {
      const writeSource = options.recordSource ?? 'inventory-directory';
      const fieldsToUpdate = writeSource === 'used-gear-workflow'
        ? compactFields({ ...baseFields, ...workflowFields })
        : baseFields;
      const updatedRecord = await updateConfiguredRecord(
        writeSource,
        recordId,
        fieldsToUpdate,
        { typecast: true },
      );


      if (values.imageFiles.length > 0) {
        await uploadIncomingGearImages(updatedRecord.id, values.imageFiles);
      }

      return {
        recordId: updatedRecord.id,
        sku: skuValue,
        action: 'updated',
      };
    } catch (error) {
      logServiceError('incomingGearForm', `Error updating Incoming Gear submission ${recordId}`, error);
      const serviceError = createServiceError({
        service: 'incomingGearForm',
        code: 'INCOMING_GEAR_UPDATE_FAILED',
        userMessage: 'Unable to update the Incoming Gear fields for this inventory record.',
        retryable: true,
        cause: error,
      });
      const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
      typedError.serviceError = serviceError;
      throw typedError;
    }
  }

  let lastError: unknown = null;

  for (const candidate of createCandidates) {
    try {
      const createdRecord = await createConfiguredRecord(
        'used-gear-workflow',
        candidate,
        { typecast: true },
      );

      if (values.imageFiles.length > 0) {
        await uploadIncomingGearImages(createdRecord.id, values.imageFiles);
      }

      return {
        recordId: createdRecord.id,
        sku: skuValue,
        action: 'created',
      };
    } catch (error) {
      lastError = error;
    }
  }

  logServiceError('incomingGearForm', 'Error creating Incoming Gear submission', lastError);
  const serviceError = createServiceError({
    service: 'incomingGearForm',
    code: 'INCOMING_GEAR_SUBMIT_FAILED',
    userMessage: 'Unable to submit the Incoming Gear form to Airtable.',
    retryable: true,
    cause: lastError,
  });
  const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
  typedError.serviceError = serviceError;
  throw typedError;
}
