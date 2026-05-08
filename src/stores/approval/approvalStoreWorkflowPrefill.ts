type ApprovalFieldKind = 'boolean' | 'number' | 'json' | 'text';

type ApprovalFormValues = Record<string, string>;
type ApprovalFieldKinds = Record<string, ApprovalFieldKind>;
type AirtableFields = Record<string, unknown>;

interface FeaturePair {
  feature: string;
  value: string;
}

const TITLE_FIELD_CANDIDATES = [
  'Shopify REST Title',
  'Shopify Title',
  'Item Title',
  'Title',
  'Name',
  'eBay Title',
];

const DESCRIPTION_FIELD_CANDIDATES = [
  'Shopify Body Description',
  'Shopify REST Body Description',
  'eBay Inventory Product Description',
  'Item Description',
  'Description',
];

const KEY_FEATURE_FIELD_CANDIDATES = [
  'Shopify Body Key Features JSON',
  'Shopify REST Body Key Features JSON',
  'Shopify Body Key Features',
  'Shopify REST Body Key Features',
  'eBay Body Key Features JSON',
  'eBay Body Key Features',
  'eBay Listing Key Features JSON',
  'eBay Listing Key Features',
  'Key Features JSON',
  'Key Features (Key, Value)',
  'Key Features',
  'Features JSON',
  'Features',
];

const TESTING_NOTES_FIELD_CANDIDATES = [
  'Testing Notes',
  'Testing Notes JSON',
  'eBay Body Testing Notes',
  'eBay Body Testing Notes JSON',
  'eBay Listing Testing Notes',
  'eBay Listing Testing Notes JSON',
];

const WORKFLOW_CONTEXT_FIELD_CANDIDATES = [
  'Workflow Status',
  'Make',
  'Model',
  'Component Type',
  'Inventory Notes',
  'Customer Cosmetic Notes',
  'Customer Functional Notes',
  'Customer Inclusion Notes',
  'Internal Cosmetic Notes',
  'Internal Functional Notes',
  'Internal Inclusion Notes',
];

function normalizeFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

function findMatchingFieldNames(values: ApprovalFormValues, candidates: string[]): string[] {
  const normalizedCandidates = new Set(candidates.map(normalizeFieldName));
  return Object.keys(values).filter((fieldName) => normalizedCandidates.has(normalizeFieldName(fieldName)));
}

function getTrimmedFieldValue(fields: AirtableFields, fieldName: string): string {
  const value = fields[fieldName];
  return typeof value === 'string' ? value.trim() : '';
}

function firstNonEmptyField(fields: AirtableFields, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    const value = getTrimmedFieldValue(fields, fieldName);
    if (value) return value;
  }

  return '';
}

function firstNonEmptyFormValue(values: ApprovalFormValues, fieldNames: string[]): string {
  const matchingFieldNames = findMatchingFieldNames(values, fieldNames);
  for (const fieldName of matchingFieldNames) {
    const value = values[fieldName]?.trim() ?? '';
    if (value) return value;
  }

  return '';
}

function hasWorkflowPrefillContext(fields: AirtableFields): boolean {
  return WORKFLOW_CONTEXT_FIELD_CANDIDATES.some((fieldName) => getTrimmedFieldValue(fields, fieldName).length > 0);
}

function uniqueFeaturePairs(pairs: FeaturePair[]): FeaturePair[] {
  const seen = new Set<string>();
  const nextPairs: FeaturePair[] = [];

  pairs.forEach((pair) => {
    const feature = pair.feature.trim();
    const value = pair.value.trim();
    if (!feature || !value) return;

    const key = `${feature.toLowerCase()}::${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    nextPairs.push({ feature, value });
  });

  return nextPairs;
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function serializeFeaturePairs(fieldName: string, pairs: FeaturePair[]): string {
  if (pairs.length === 0) return '';

  if (normalizeFieldName(fieldName).includes('json')) {
    return JSON.stringify(pairs);
  }

  return pairs
    .map((pair) => `${escapeCsvCell(pair.feature)},${escapeCsvCell(pair.value)}`)
    .join('\n');
}

function buildWorkflowTitle(fields: AirtableFields): string {
  const make = getTrimmedFieldValue(fields, 'Make');
  const model = getTrimmedFieldValue(fields, 'Model');
  const componentType = getTrimmedFieldValue(fields, 'Component Type');

  const primaryParts = [make, model].filter(Boolean);
  if (primaryParts.length > 0) return primaryParts.join(' ');
  return componentType;
}

function buildWorkflowDescription(fields: AirtableFields): string {
  return firstNonEmptyField(fields, ['Inventory Notes']);
}

function buildWorkflowKeyFeaturePairs(fields: AirtableFields): FeaturePair[] {
  return uniqueFeaturePairs([
    { feature: 'Make', value: getTrimmedFieldValue(fields, 'Make') },
    { feature: 'Model', value: getTrimmedFieldValue(fields, 'Model') },
    { feature: 'Component Type', value: getTrimmedFieldValue(fields, 'Component Type') },
    {
      feature: 'Cosmetic Notes',
      value: firstNonEmptyField(fields, ['Internal Cosmetic Notes', 'Customer Cosmetic Notes']),
    },
    {
      feature: 'Includes',
      value: firstNonEmptyField(fields, ['Internal Inclusion Notes', 'Customer Inclusion Notes']),
    },
  ]);
}

function buildWorkflowTestingNotePairs(fields: AirtableFields): FeaturePair[] {
  return uniqueFeaturePairs([
    {
      feature: 'Functional Notes',
      value: firstNonEmptyField(fields, ['Internal Functional Notes', 'Customer Functional Notes']),
    },
    {
      feature: 'Includes',
      value: firstNonEmptyField(fields, ['Internal Inclusion Notes', 'Customer Inclusion Notes']),
    },
    {
      feature: 'Cosmetic Notes',
      value: firstNonEmptyField(fields, ['Internal Cosmetic Notes', 'Customer Cosmetic Notes']),
    },
  ]);
}

function applyTextPrefill(
  values: ApprovalFormValues,
  kinds: ApprovalFieldKinds,
  fieldNames: string[],
  value: string,
) {
  if (!value) return;

  fieldNames.forEach((fieldName) => {
    if ((values[fieldName]?.trim() ?? '').length > 0) return;
    values[fieldName] = value;
    kinds[fieldName] = 'text';
  });
}

function applyPairPrefill(
  values: ApprovalFormValues,
  kinds: ApprovalFieldKinds,
  fieldNames: string[],
  pairs: FeaturePair[],
) {
  if (pairs.length === 0) return;

  fieldNames.forEach((fieldName) => {
    if ((values[fieldName]?.trim() ?? '').length > 0) return;
    values[fieldName] = serializeFeaturePairs(fieldName, pairs);
    kinds[fieldName] = normalizeFieldName(fieldName).includes('json') ? 'json' : 'text';
  });
}

export function applyWorkflowListingPrefills(
  fields: AirtableFields,
  values: ApprovalFormValues,
  kinds: ApprovalFieldKinds,
) {
  if (!hasWorkflowPrefillContext(fields)) return;

  const titleFieldNames = findMatchingFieldNames(values, TITLE_FIELD_CANDIDATES);
  const existingTitle = firstNonEmptyFormValue(values, TITLE_FIELD_CANDIDATES);
  applyTextPrefill(values, kinds, titleFieldNames, existingTitle || buildWorkflowTitle(fields));

  const descriptionFieldNames = findMatchingFieldNames(values, DESCRIPTION_FIELD_CANDIDATES);
  const existingDescription = firstNonEmptyFormValue(values, DESCRIPTION_FIELD_CANDIDATES);
  applyTextPrefill(values, kinds, descriptionFieldNames, existingDescription || buildWorkflowDescription(fields));

  const keyFeatureFieldNames = findMatchingFieldNames(values, KEY_FEATURE_FIELD_CANDIDATES);
  const existingKeyFeatures = firstNonEmptyFormValue(values, KEY_FEATURE_FIELD_CANDIDATES);
  applyPairPrefill(
    values,
    kinds,
    keyFeatureFieldNames,
    existingKeyFeatures ? [] : buildWorkflowKeyFeaturePairs(fields),
  );

  const testingNotesFieldNames = findMatchingFieldNames(values, TESTING_NOTES_FIELD_CANDIDATES);
  const existingTestingNotes = firstNonEmptyFormValue(values, TESTING_NOTES_FIELD_CANDIDATES);
  applyPairPrefill(
    values,
    kinds,
    testingNotesFieldNames,
    existingTestingNotes ? [] : buildWorkflowTestingNotePairs(fields),
  );
}