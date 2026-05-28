import type { JotFormAnswer, JotFormSubmission } from './client.js';
import {
  buildUsedGearIntakeBaseFields,
  buildUsedGearWorkflowFields,
  trimToUndefined,
} from '../../shared/contracts/usedGearIntakeFields.js';

export interface NormalizedJotFormWorkflowItem {
  submissionId: string;
  submissionGroupId: string;
  airtableFields: Record<string, unknown>;
  imageUrls: string[];
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function toAnswerString(answer: JotFormAnswer): string {
  const rawValue = answer.answer;

  if (typeof rawValue === 'string') {
    return rawValue.trim();
  }

  if (Array.isArray(rawValue)) {
    return rawValue
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(', ');
  }

  if (rawValue && typeof rawValue === 'object') {
    return Object.values(rawValue)
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(', ');
  }

  return answer.prettyFormat?.trim() || '';
}

function buildAnswerIndex(submission: JotFormSubmission): Map<string, string> {
  const index = new Map<string, string>();

  for (const answer of Object.values(submission.answers ?? {})) {
    const value = toAnswerString(answer);
    if (!value) {
      continue;
    }

    const keys = [answer.name, answer.text]
      .map((entry) => normalizeKey(String(entry || '')))
      .filter(Boolean);

    for (const key of keys) {
      if (!index.has(key)) {
        index.set(key, value);
      }
    }
  }

  return index;
}

function readIndexedValue(index: Map<string, string>, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const value = index.get(normalizeKey(candidate));
    if (value) {
      return value;
    }
  }

  return undefined;
}

function toYesNoValue(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (['yes', 'y', 'true', '1'].includes(normalized)) {
    return 'Yes';
  }

  if (['no', 'n', 'false', '0'].includes(normalized)) {
    return 'No';
  }

  return value;
}

function collectImageUrls(submission: JotFormSubmission): string[] {
  const urls: string[] = [];

  for (const answer of Object.values(submission.answers ?? {})) {
    const hint = `${answer.name} ${answer.text} ${answer.type}`.toLowerCase();
    if (!hint.includes('image') && !hint.includes('photo') && !hint.includes('upload')) {
      continue;
    }

    const rawValue = answer.answer;
    const values = Array.isArray(rawValue)
      ? rawValue
      : typeof rawValue === 'string'
        ? rawValue.split(/[,\n]/)
        : [];

    for (const value of values) {
      const trimmed = String(value).trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        urls.push(trimmed);
      }
    }
  }

  return Array.from(new Set(urls));
}

export function mapJotFormSubmissionToWorkflowItems(submission: JotFormSubmission): NormalizedJotFormWorkflowItem[] {
  const answerIndex = buildAnswerIndex(submission);
  const submissionGroupId = trimToUndefined(readIndexedValue(answerIndex, [
    'Submission Group ID',
    'Submission Group',
    'Group ID',
  ])) || submission.id;

  const airtableFields = {
    ...buildUsedGearIntakeBaseFields({
      acquiredFrom: readIndexedValue(answerIndex, ['Seller Name', 'Customer Name', 'Full Name', 'Name']),
      customerCosmeticNotes: readIndexedValue(answerIndex, ['Customer Cosmetic Notes', 'Cosmetic Notes', 'Cosmetic Condition']),
      customerFunctionalNotes: readIndexedValue(answerIndex, ['Customer Functional Notes', 'Functional Notes', 'Functionality Notes']),
      customerInclusionNotes: readIndexedValue(answerIndex, ['Customer Inclusion Notes', 'Inclusion Notes', 'Included Accessories', 'Accessories Included']),
      customerSubmittedPhotosNotes: readIndexedValue(answerIndex, ['Customer Submitted Photos Notes', 'Photo Notes', 'Image Notes']),
      make: readIndexedValue(answerIndex, ['Make', 'Brand', 'Manufacturer']),
      model: readIndexedValue(answerIndex, ['Model', 'Model Number']),
      componentType: readIndexedValue(answerIndex, ['Component Type', 'Category', 'Equipment Type']),
      serialNumber: readIndexedValue(answerIndex, ['Serial Number', 'Serial']),
      voltage: readIndexedValue(answerIndex, ['Voltage']),
      inventoryNotes: readIndexedValue(answerIndex, ['Inventory Notes', 'Internal Notes', 'Additional Details']),
      originalBox: toYesNoValue(readIndexedValue(answerIndex, ['Original Box'])),
      manual: toYesNoValue(readIndexedValue(answerIndex, ['Manual'])),
      remote: toYesNoValue(readIndexedValue(answerIndex, ['Remote'])),
      powerCable: toYesNoValue(readIndexedValue(answerIndex, ['Power Cable', 'Power Cord'])),
      additionalItems: readIndexedValue(answerIndex, ['Additional Items', 'Included Items']),
      shippingMethod: readIndexedValue(answerIndex, ['Shipping Method']),
    }),
    ...buildUsedGearWorkflowFields({
      workflowSource: 'JotForm',
      workflowStatus: 'Pending Review',
      submissionGroupId,
      pickUpId: readIndexedValue(answerIndex, ['Pick Up ID', 'Pickup ID', 'Pick Up Number', 'Pickup Number']),
      qualificationComplete: false,
      jotFormSubmissionId: submission.id,
    }),
  };

  return [{
    submissionId: submission.id,
    submissionGroupId,
    airtableFields,
    imageUrls: collectImageUrls(submission),
  }];
}