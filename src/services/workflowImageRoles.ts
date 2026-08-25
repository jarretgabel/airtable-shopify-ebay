import { createConfiguredRecord, getConfiguredRecords } from '@/services/app-api/airtable';
import { WORKFLOW_IMAGE_ROLE_OPTIONS, type WorkflowImageRole } from '@/services/workflowImageMetadata';

const SHARED_ROLE_NAME_FIELD = 'Name';

const CUSTOM_ROLE_PREFIX = 'custom:';

export interface WorkflowImageRoleSelectOption {
  value: string;
  label: string;
  role: WorkflowImageRole;
  customImageRole?: string;
}

function ensureCustomSelectionOption(options: WorkflowImageRoleSelectOption[]): WorkflowImageRoleSelectOption[] {
  const hasCustom = options.some((option) => option.value === 'custom');
  if (hasCustom) {
    return options;
  }

  return [
    ...options,
    {
      value: 'custom',
      label: 'Custom',
      role: 'custom',
    },
  ];
}

function toRoleOption(choice: string): WorkflowImageRoleSelectOption {
  const mappedRole = decodeChoiceToRole(choice);
  if (mappedRole && mappedRole !== 'custom') {
    return {
      value: mappedRole,
      label: choice,
      role: mappedRole,
    };
  }

  if (mappedRole === 'custom') {
    return {
      value: 'custom',
      label: choice,
      role: 'custom',
    };
  }

  return customRoleOption(choice);
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-');
}

function normalizeFreeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeComparisonKey(value: string): string {
  return normalizeToken(value).replace(/-/g, '');
}

function isBuiltInRole(value: string): value is WorkflowImageRole {
  return (WORKFLOW_IMAGE_ROLE_OPTIONS as readonly string[]).includes(value);
}

function decodeChoiceToRole(choice: string): WorkflowImageRole | undefined {
  const normalized = normalizeToken(choice);
  if (!normalized) return undefined;

  if (isBuiltInRole(normalized)) {
    return normalized;
  }

  const fallbackMap: Record<string, WorkflowImageRole> = {
    serialplate: 'serial-plate',
    cosmeticdetail: 'cosmetic-detail',
  };

  return fallbackMap[normalized.replace(/-/g, '')];
}

function customRoleOption(customImageRole: string): WorkflowImageRoleSelectOption {
  return {
    value: `${CUSTOM_ROLE_PREFIX}${customImageRole}`,
    label: customImageRole,
    role: 'custom',
    customImageRole,
  };
}

function valuesToStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = normalizeFreeText(value);
    return trimmed ? [trimmed] : [];
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => valuesToStrings(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [record.text, record.name, record.id]
      .flatMap((entry) => valuesToStrings(entry));
  }

  return [];
}

function extractSharedRoleValue(fields: Record<string, unknown>): string {
  const directValues = valuesToStrings(fields[SHARED_ROLE_NAME_FIELD]);
  if (directValues.length > 0) {
    return directValues[0] || '';
  }

  const nameLikeField = Object.entries(fields).find(([fieldName]) => fieldName.trim().toLowerCase() === 'name');
  if (!nameLikeField) {
    return '';
  }

  const values = valuesToStrings(nameLikeField[1]);
  return values[0] || '';
}

async function loadRoleRecordsFromConfiguredSource(): Promise<Array<{ fields: Record<string, unknown> }>> {
  try {
    const scoped = await getConfiguredRecords('workflow-image-roles', {
      fields: [SHARED_ROLE_NAME_FIELD],
      maxRecords: 1000,
    });
    return scoped.map((record) => ({ fields: (record.fields || {}) as Record<string, unknown> }));
  } catch {
    const unscoped = await getConfiguredRecords('workflow-image-roles', {
      maxRecords: 1000,
    });
    return unscoped.map((record) => ({ fields: (record.fields || {}) as Record<string, unknown> }));
  }
}

export async function loadWorkflowImageRoleOptions(): Promise<WorkflowImageRoleSelectOption[]> {
  try {
    const records = await loadRoleRecordsFromConfiguredSource();
    const choices = records
      .map((record) => extractSharedRoleValue(record.fields))
      .map((choice) => normalizeFreeText(choice))
      .filter((choice) => choice.length > 0);

    const seen = new Set<string>();
    const options: WorkflowImageRoleSelectOption[] = [];

    choices.forEach((choice) => {
      const key = normalizeComparisonKey(choice);
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);

      options.push(toRoleOption(choice));
    });

    return ensureCustomSelectionOption(options);
  } catch {
    return ensureCustomSelectionOption([]);
  }
}

export function findWorkflowImageRoleOption(
  options: WorkflowImageRoleSelectOption[],
  value: string,
): WorkflowImageRoleSelectOption | undefined {
  const normalized = normalizeComparisonKey(value);
  if (!normalized) {
    return undefined;
  }

  return options.find((option) => {
    const candidate = option.customImageRole || option.label || option.value;
    return normalizeComparisonKey(candidate) === normalized;
  });
}

export async function createWorkflowImageRoleOption(rawValue: string): Promise<WorkflowImageRoleSelectOption> {
  const choice = normalizeFreeText(rawValue);
  if (!choice) {
    throw new Error('Enter a custom role before adding it to Airtable.');
  }

  try {
    await createConfiguredRecord('workflow-image-roles', { [SHARED_ROLE_NAME_FIELD]: choice }, { typecast: true });
    return toRoleOption(choice);
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      throw error;
    }
    throw new Error('Unable to add image role to Airtable. Check table permissions and Name field access.');
  }
}

export function getWorkflowImageRoleSelectValue(
  imageRole: WorkflowImageRole | undefined,
  customImageRole: string | undefined,
  options: WorkflowImageRoleSelectOption[],
): string {
  if (!imageRole) {
    return '';
  }

  if (imageRole !== 'custom') {
    return imageRole;
  }

  const normalizedCustom = normalizeComparisonKey(customImageRole || '');
  if (!normalizedCustom) {
    return 'custom';
  }

  const sharedCustomMatch = options.find((option) => option.role === 'custom'
    && option.customImageRole
    && normalizeComparisonKey(option.customImageRole) === normalizedCustom);

  return sharedCustomMatch?.value || 'custom';
}

export function toWorkflowImageRoleSelection(
  selectedValue: string,
  currentCustomImageRole: string,
): { imageRole: WorkflowImageRole | undefined; customImageRole: string } {
  const normalizedSelection = selectedValue.trim();

  if (!normalizedSelection) {
    return { imageRole: undefined, customImageRole: '' };
  }

  if (normalizedSelection === 'custom') {
    return {
      imageRole: 'custom',
      customImageRole: normalizeFreeText(currentCustomImageRole),
    };
  }

  if (normalizedSelection.startsWith(CUSTOM_ROLE_PREFIX)) {
    const sharedCustomRole = normalizeFreeText(normalizedSelection.slice(CUSTOM_ROLE_PREFIX.length));
    return {
      imageRole: 'custom',
      customImageRole: sharedCustomRole,
    };
  }

  if (isBuiltInRole(normalizedSelection)) {
    return {
      imageRole: normalizedSelection,
      customImageRole: '',
    };
  }

  return { imageRole: undefined, customImageRole: '' };
}
