/** Field spec and validation for intake items drafted through the assistant. Mirrors the Manual Intake form. */
export interface IntakeDraftFieldSpec {
  key: string;
  label: string;
  required?: boolean;
  /** Airtable single-select field the value must match exactly. */
  optionField?: string;
  /** Extra validation: dollar amount, email, non-negative number, or YYYY-MM-DD date. */
  kind?: 'currency' | 'email' | 'number' | 'date';
  maxLength: number;
}

export const INTAKE_DRAFT_FIELDS: IntakeDraftFieldSpec[] = [
  { key: 'pickUpNumber', label: 'Pick Up ID', required: true, maxLength: 100 },
  { key: 'sellerFirstName', label: 'Seller First Name', maxLength: 100 },
  { key: 'sellerLastName', label: 'Seller Last Name', maxLength: 100 },
  { key: 'sellerEmail', label: 'Seller Email', kind: 'email', maxLength: 200 },
  { key: 'sellerPhone', label: 'Seller Phone', maxLength: 50 },
  { key: 'sellerZipCode', label: 'Seller Zip Code', maxLength: 20 },
  { key: 'sellerLocation', label: 'Seller Location', optionField: 'Seller Location', maxLength: 100 },
  { key: 'howDidYouHear', label: 'How Did You Hear', optionField: 'How Did You Hear', maxLength: 100 },
  { key: 'cost', label: 'Cost', required: true, kind: 'currency', maxLength: 20 },
  { key: 'make', label: 'Make', required: true, maxLength: 100 },
  { key: 'model', label: 'Model', required: true, maxLength: 100 },
  { key: 'componentType', label: 'Component Type', required: true, optionField: 'Component Type', maxLength: 100 },
  { key: 'serialNumber', label: 'Serial Number', maxLength: 100 },
  { key: 'voltage', label: 'Voltage', maxLength: 50 },
  { key: 'customerCosmeticNotes', label: 'Customer Cosmetic Notes', maxLength: 2000 },
  { key: 'customerFunctionalNotes', label: 'Customer Functional Notes', maxLength: 2000 },
  { key: 'customerInclusionNotes', label: 'Customer Inclusion Notes', maxLength: 2000 },
  { key: 'inventoryNotes', label: 'Inventory Notes', maxLength: 2000 },
  { key: 'cosmeticConditionNotes', label: 'Cosmetic Notes', maxLength: 2000 },
  { key: 'originalBox', label: 'Original Box', optionField: 'Original Box', maxLength: 100 },
  { key: 'manual', label: 'Manual', optionField: 'Manual', maxLength: 100 },
  { key: 'remote', label: 'Remote', optionField: 'Remote', maxLength: 100 },
  { key: 'powerCable', label: 'Power Cable', optionField: 'Power Cable', maxLength: 100 },
  { key: 'additionalItems', label: 'Additional Items', maxLength: 500 },
  { key: 'weight', label: 'Weight', maxLength: 50 },
  { key: 'shippingDims', label: 'Shipping Dimensions', maxLength: 100 },
  { key: 'shippingMethod', label: 'Shipping Method', optionField: 'Shipping Method', maxLength: 100 },
  { key: 'originalOwner', label: 'Original Owner', optionField: 'Original Owner', maxLength: 100 },
  { key: 'smokeExposure', label: 'Smoke Exposure', optionField: 'Smoke Exposure', maxLength: 100 },
];

export type DraftKind = 'intake' | 'testing' | 'photos';

const CONDITION_FIELDS: IntakeDraftFieldSpec[] = [
  { key: 'serialNumber', label: 'Serial Number', maxLength: 100 },
  { key: 'voltage', label: 'Voltage', maxLength: 50 },
  { key: 'audiogonRating', label: 'Audiogon Rating', optionField: 'Audiogon Rating', maxLength: 100 },
  { key: 'cosmeticConditionNotes', label: 'Cosmetic Notes', maxLength: 2000 },
  { key: 'originalBox', label: 'Original Box', optionField: 'Original Box', maxLength: 100 },
  { key: 'manual', label: 'Manual', optionField: 'Manual', maxLength: 100 },
  { key: 'remote', label: 'Remote', optionField: 'Remote', maxLength: 100 },
  { key: 'powerCable', label: 'Power Cable', optionField: 'Power Cable', maxLength: 100 },
  { key: 'additionalItems', label: 'Additional Items', maxLength: 500 },
];

/** Fields the Testing form can change on an existing item. Required-to-complete is checked client-side against the saved record. */
export const TESTING_DRAFT_FIELDS: IntakeDraftFieldSpec[] = [
  { key: 'testingNotes', label: 'Testing Notes', maxLength: 4000 },
  { key: 'testingTimeMinutes', label: 'Testing Time (minutes)', kind: 'number', maxLength: 10 },
  { key: 'serviceNotes', label: 'Service Notes', maxLength: 4000 },
  { key: 'serviceTimeMinutes', label: 'Service Time (minutes)', kind: 'number', maxLength: 10 },
  { key: 'testingDate', label: 'Testing Date', kind: 'date', maxLength: 10 },
  ...CONDITION_FIELDS,
  { key: 'shippingWeight', label: 'Shipping Weight', maxLength: 50 },
  { key: 'shippingDims', label: 'Shipping Dimensions', maxLength: 100 },
  { key: 'shippingMethod', label: 'Shipping Method', optionField: 'Shipping Method', maxLength: 100 },
];

/** Fields the Photos form can change on an existing item. */
export const PHOTOS_DRAFT_FIELDS: IntakeDraftFieldSpec[] = [
  { key: 'photoDate', label: 'Photo Date', kind: 'date', maxLength: 10 },
  ...CONDITION_FIELDS.filter((spec) => spec.key !== 'serialNumber' && spec.key !== 'voltage'),
];

export interface AssistantDraft extends IntakeDraftResult {
  kind: DraftKind;
  /** Workflow record the testing/photos draft applies to. */
  recordId?: string;
}

export const DRAFT_FIELDS_BY_KIND: Record<DraftKind, IntakeDraftFieldSpec[]> = {
  intake: INTAKE_DRAFT_FIELDS,
  testing: TESTING_DRAFT_FIELDS,
  photos: PHOTOS_DRAFT_FIELDS,
};

export const ALL_DRAFT_OPTION_FIELDS: string[] = Array.from(new Set(
  Object.values(DRAFT_FIELDS_BY_KIND).flat().flatMap((spec) => (spec.optionField ? [spec.optionField] : [])),
));

export type IntakeOptionSets = Record<string, string[]>;

export interface IntakeDraftIssue {
  field: string;
  message: string;
  allowedOptions?: string[];
}

export interface IntakeDraftResult {
  values: Record<string, string>;
  missing: string[];
  invalid: IntakeDraftIssue[];
}

const MAX_ALLOWED_OPTIONS = 40;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cleans raw values, matches select values to existing options and reports what is missing or invalid. Never throws. */
export function normalizeIntakeDraft(raw: unknown, optionSets: IntakeOptionSets | null): IntakeDraftResult {
  return normalizeDraft(INTAKE_DRAFT_FIELDS, raw, optionSets);
}

export function normalizeDraft(specs: IntakeDraftFieldSpec[], raw: unknown, optionSets: IntakeOptionSets | null): IntakeDraftResult {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const values: Record<string, string> = {};
  const invalid: IntakeDraftIssue[] = [];

  for (const spec of specs) {
    const value = input[spec.key];
    let text = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
    if (!text) continue;
    if (text.length > spec.maxLength) {
      invalid.push({ field: spec.label, message: `Too long (max ${spec.maxLength} characters).` });
      continue;
    }

    if (spec.kind === 'currency') {
      const amount = Number(text.replace(/[$,\s]/g, ''));
      if (!Number.isFinite(amount) || amount < 0) {
        invalid.push({ field: spec.label, message: 'Must be a dollar amount such as 1500.' });
        continue;
      }
      text = String(amount);
    } else if (spec.kind === 'number') {
      const amount = Number(text);
      if (!Number.isFinite(amount) || amount < 0) {
        invalid.push({ field: spec.label, message: 'Must be a number such as 45.' });
        continue;
      }
      text = String(amount);
    } else if (spec.kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
        invalid.push({ field: spec.label, message: 'Must be a date formatted YYYY-MM-DD.' });
        continue;
      }
    } else if (spec.kind === 'email' && !EMAIL.test(text)) {
      invalid.push({ field: spec.label, message: 'Not a valid email address.' });
      continue;
    } else if (spec.optionField) {
      const options = optionSets?.[spec.optionField];
      if (!options) {
        invalid.push({ field: spec.label, message: 'Options could not be loaded to verify this value.' });
        continue;
      }
      const match = options.find((option) => option.toLowerCase() === text.toLowerCase());
      if (!match) {
        invalid.push({ field: spec.label, message: `"${text}" is not an existing option.`, allowedOptions: options.slice(0, MAX_ALLOWED_OPTIONS) });
        continue;
      }
      text = match;
    }
    values[spec.key] = text;
  }

  const missing = specs.filter((spec) => spec.required && !values[spec.key]).map((spec) => spec.label);
  return { values, missing, invalid };
}
