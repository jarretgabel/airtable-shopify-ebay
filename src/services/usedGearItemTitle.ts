import { buildUsedGearItemTitle } from '../../aws/src/shared/contracts/usedGearItemTitle';

function readFieldValue(fields: Record<string, unknown>, fieldName: string): string {
  const value = fields[fieldName];
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const firstString = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return firstString?.trim() ?? '';
  }

  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }

    if ('name' in value && typeof value.name === 'string') {
      return value.name.trim();
    }
  }

  return String(value).trim();
}

export function getUsedGearRecordItemTitle(
  fields: Record<string, unknown>,
  recordId?: string | null,
): string {
  const existingItemTitle = readFieldValue(fields, 'Item Title');
  if (existingItemTitle) {
    return existingItemTitle;
  }

  return buildUsedGearItemTitle({
    make: readFieldValue(fields, 'Make'),
    model: readFieldValue(fields, 'Model'),
    componentType: readFieldValue(fields, 'Component Type'),
    serialNumber: readFieldValue(fields, 'Serial Number'),
    jotFormSubmissionId: readFieldValue(fields, 'JotForm Submission ID'),
    pickUpId: readFieldValue(fields, 'Pick Up ID'),
    submissionGroupId: readFieldValue(fields, 'Submission Group ID'),
    recordId,
  });
}