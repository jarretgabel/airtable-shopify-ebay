import axios from 'axios';
import { updateRecordFromResolvedSource } from '@/services/app-api/airtable';
import { toFormValue } from '@/stores/approvalStore';
import {
  EBAY_BODY_HTML_FIELD_CANDIDATES,
  EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_TESTING_NOTES_FIELD_CANDIDATES,
} from './listingApprovalEbayConstants';
import type { AirtableRecord } from '@/types/airtable';

interface SaveEbayApprovalFieldsParams {
  selectedRecord: AirtableRecord;
  tableReference: string;
  tableName?: string;
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  priceFieldName: string;
  bodyHtmlPreview: string;
  ebayBodyHtmlSaveFieldName: string;
  shouldForceEbayBodyHtmlSave: boolean;
  combinedSharedKeyFeaturesFieldName?: string;
  combinedEbayTestingNotesFieldName?: string;
}

function buildExistingFieldLookup(selectedRecord: AirtableRecord): Map<string, string> {
  return new Map(
    Object.keys(selectedRecord.fields).map((fieldName) => [fieldName.toLowerCase(), fieldName]),
  );
}

function resolveExistingFieldName(existingFieldLookup: Map<string, string>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const key = candidate.trim().toLowerCase();
    if (!key) continue;
    const existing = existingFieldLookup.get(key);
    if (existing) return existing;
  }
  return null;
}

async function trySaveEbayField({
  candidates,
  rawValue,
  selectedRecord,
  tableReference,
  tableName,
  options,
}: {
  candidates: string[];
  rawValue: string;
  selectedRecord: AirtableRecord;
  tableReference: string;
  tableName?: string;
  options?: { typecast?: boolean; coerceNumber?: boolean };
}): Promise<string | null> {
  const uniqueCandidates = Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)));
  if (uniqueCandidates.length === 0) return null;

  const valuesToTry: Array<string | number> = [];
  if (options?.coerceNumber) {
    const cleaned = rawValue.replace(/\$/g, '').replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      valuesToTry.push(parsed, parsed.toFixed(2));
    }
    valuesToTry.push(cleaned || rawValue);
  }
  valuesToTry.push(rawValue);

  const dedupedValues = Array.from(new Set(valuesToTry.map((value) => String(value)))).map((value) => {
    const parsed = Number(value);
    if (options?.coerceNumber && Number.isFinite(parsed) && value.trim() !== '' && !Number.isNaN(parsed)) {
      return value.includes('.') ? value : parsed;
    }
    return value;
  });

  let last422Error: unknown = null;
  for (const candidate of uniqueCandidates) {
    for (const value of dedupedValues) {
      try {
        await updateRecordFromResolvedSource(
          tableReference,
          tableName,
          selectedRecord.id,
          { [candidate]: value },
          options?.typecast ? { typecast: true } : undefined,
        );
        return candidate;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 422) {
          last422Error = error;
          continue;
        }
        throw error;
      }
    }
  }

  if (last422Error) {
    throw last422Error;
  }

  return null;
}

export async function saveEbayApprovalSupplementalFields({
  selectedRecord,
  tableReference,
  tableName,
  formValues,
  setFormValue,
  priceFieldName,
  bodyHtmlPreview,
  ebayBodyHtmlSaveFieldName,
  shouldForceEbayBodyHtmlSave,
  combinedSharedKeyFeaturesFieldName,
  combinedEbayTestingNotesFieldName,
}: SaveEbayApprovalFieldsParams): Promise<void> {
  const existingFieldLookup = buildExistingFieldLookup(selectedRecord);

  const priceRaw = priceFieldName ? (formValues[priceFieldName] ?? '') : '';
  const priceCandidates = [priceFieldName, ...EBAY_PRICE_FIELD_CANDIDATES];
  const existingPriceFieldName = resolveExistingFieldName(existingFieldLookup, priceCandidates);
  const originalPriceRaw = existingPriceFieldName ? toFormValue(selectedRecord.fields[existingPriceFieldName]) : '';
  const shouldSavePrice = priceRaw.trim().length > 0 && priceRaw !== originalPriceRaw;
  if (shouldSavePrice) {
    const savedPriceField = await trySaveEbayField({
      candidates: priceCandidates,
      rawValue: priceRaw,
      selectedRecord,
      tableReference,
      tableName,
      options: { typecast: true, coerceNumber: true },
    });
    if (savedPriceField && savedPriceField !== priceFieldName) {
      setFormValue(savedPriceField, priceRaw);
    }
  }

  const bodyHtmlRaw = bodyHtmlPreview || (ebayBodyHtmlSaveFieldName ? (formValues[ebayBodyHtmlSaveFieldName] ?? '') : '');
  const bodyHtmlCandidates = [ebayBodyHtmlSaveFieldName, ...EBAY_BODY_HTML_FIELD_CANDIDATES, 'Body html'];
  const existingBodyHtmlFieldName = resolveExistingFieldName(existingFieldLookup, bodyHtmlCandidates);
  const originalBodyHtmlRaw = existingBodyHtmlFieldName ? toFormValue(selectedRecord.fields[existingBodyHtmlFieldName]) : '';
  const shouldSaveBodyHtml = Boolean(existingBodyHtmlFieldName) && bodyHtmlRaw.trim().length > 0 && (
    shouldForceEbayBodyHtmlSave || bodyHtmlRaw !== originalBodyHtmlRaw
  );
  if (shouldSaveBodyHtml) {
    const savedBodyHtmlField = await trySaveEbayField({
      candidates: bodyHtmlCandidates,
      rawValue: bodyHtmlRaw,
      selectedRecord,
      tableReference,
      tableName,
      options: { typecast: false, coerceNumber: false },
    });
    if (savedBodyHtmlField) {
      setFormValue(savedBodyHtmlField, bodyHtmlRaw);
    }
  }

  const keyFeaturesFieldName = resolveExistingFieldName(existingFieldLookup, [
    combinedSharedKeyFeaturesFieldName ?? '',
    'Key Features (Key, Value)',
    'Key Features',
    'Key Features JSON',
    'Features',
    'Features JSON',
  ]);
  const keyFeaturesRaw = keyFeaturesFieldName ? (formValues[keyFeaturesFieldName] ?? '') : '';
  const keyFeaturesCandidates = [
    keyFeaturesFieldName,
    'Key Features (Key, Value)',
    'Key Features',
    'Key Features JSON',
    'Features',
    'Features JSON',
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0));
  const existingKeyFeaturesFieldName = resolveExistingFieldName(existingFieldLookup, keyFeaturesCandidates);
  const originalKeyFeaturesRaw = existingKeyFeaturesFieldName
    ? toFormValue(selectedRecord.fields[existingKeyFeaturesFieldName])
    : '';
  const shouldSaveKeyFeatures = keyFeaturesRaw.trim().length > 0 && keyFeaturesRaw !== originalKeyFeaturesRaw;
  if (shouldSaveKeyFeatures) {
    const savedKeyFeaturesField = await trySaveEbayField({
      candidates: keyFeaturesCandidates,
      rawValue: keyFeaturesRaw,
      selectedRecord,
      tableReference,
      tableName,
      options: { typecast: false, coerceNumber: false },
    });
    if (savedKeyFeaturesField) {
      setFormValue(savedKeyFeaturesField, keyFeaturesRaw);
    }
  }

  const testingNotesFieldName = resolveExistingFieldName(existingFieldLookup, [
    combinedEbayTestingNotesFieldName ?? '',
    ...EBAY_TESTING_NOTES_FIELD_CANDIDATES,
    ...EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  ]);
  const testingNotesRaw = testingNotesFieldName ? (formValues[testingNotesFieldName] ?? '') : '';
  const testingNotesCandidates = [
    testingNotesFieldName,
    ...EBAY_TESTING_NOTES_FIELD_CANDIDATES,
    ...EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 0));
  const existingTestingNotesFieldName = resolveExistingFieldName(existingFieldLookup, testingNotesCandidates);
  const originalTestingNotesRaw = existingTestingNotesFieldName
    ? toFormValue(selectedRecord.fields[existingTestingNotesFieldName])
    : '';
  const shouldSaveTestingNotes = testingNotesRaw.trim().length > 0 && testingNotesRaw !== originalTestingNotesRaw;
  if (shouldSaveTestingNotes) {
    const savedTestingNotesField = await trySaveEbayField({
      candidates: testingNotesCandidates,
      rawValue: testingNotesRaw,
      selectedRecord,
      tableReference,
      tableName,
      options: { typecast: false, coerceNumber: false },
    });
    if (savedTestingNotesField) {
      setFormValue(savedTestingNotesField, testingNotesRaw);
    }
  }
}