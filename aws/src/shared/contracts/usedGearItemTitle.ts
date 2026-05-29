export interface UsedGearItemTitleInput {
  make?: string | null;
  model?: string | null;
  componentType?: string | null;
  serialNumber?: string | null;
  jotFormSubmissionId?: string | null;
  pickUpId?: string | null;
  submissionGroupId?: string | null;
  recordId?: string | null;
}

function trimValue(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildShortRecordId(recordId: string): string {
  const trimmedRecordId = trimValue(recordId);
  const normalizedRecordId = trimmedRecordId.replace(/^rec[-_]?/i, '');
  if (!normalizedRecordId) {
    return trimmedRecordId;
  }

  return normalizedRecordId;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeRepeatedPrefix(value: string, prefix: string): string {
  const trimmedValue = trimValue(value);
  const trimmedPrefix = trimValue(prefix);
  if (!trimmedValue || !trimmedPrefix) {
    return trimmedValue;
  }

  const repeatedPrefixPattern = new RegExp(`^${escapeRegExp(trimmedPrefix)}(?:\s+|[-/])+`, 'i');
  return trimmedValue.replace(repeatedPrefixPattern, '').trim() || trimmedValue;
}

function buildTitleBase(input: UsedGearItemTitleInput): string {
  const make = trimValue(input.make);
  const model = removeRepeatedPrefix(trimValue(input.model), make);
  const componentType = trimValue(input.componentType);
  const primaryParts = [make, model].filter(Boolean);

  if (primaryParts.length > 0) {
    return primaryParts.join(' ');
  }

  if (make && componentType) {
    return `${make} ${componentType}`;
  }

  if (model && componentType) {
    return `${model} ${componentType}`;
  }

  if (componentType) {
    return componentType;
  }

  return 'Item';
}

function buildTitleSuffix(input: UsedGearItemTitleInput): string {
  const recordId = trimValue(input.recordId);
  if (recordId) {
    return buildShortRecordId(recordId);
  }

  return '';
}

export function buildUsedGearItemTitle(input: UsedGearItemTitleInput): string {
  const baseTitle = buildTitleBase(input);
  const suffix = buildTitleSuffix(input);

  return suffix ? `${baseTitle} - ${suffix}` : baseTitle;
}