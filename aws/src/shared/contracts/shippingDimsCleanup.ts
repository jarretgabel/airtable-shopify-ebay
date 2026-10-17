export type ShippingCleanupPlan =
  | { kind: 'update'; fields: Record<string, string> }
  | { kind: 'skip'; reason: 'empty' | 'already-clean' }
  | { kind: 'review'; reason: 'multi-package' | 'unrecognized' | 'implausible-values' | 'weight-conflict' };

const NUMBER = '(\\d+(?:\\.\\d+)?)';
const WEIGHT = `${NUMBER}\\s*(?:lbs?|pounds?)\\.?`;
const DIMS = `\\(*\\s*${NUMBER}\\s*x\\s*${NUMBER}\\s*x\\s*${NUMBER}\\s*(?:"|in|inches)?\\s*\\)*`;
const WEIGHT_AND_DIMS = new RegExp(`^${WEIGHT}\\s*${DIMS}$`, 'i');
const WEIGHT_ONLY = new RegExp(`^${WEIGHT}$`, 'i');
const DIMS_ONLY = new RegExp(`^${NUMBER}\\s*"?\\s*x\\s*${NUMBER}\\s*"?\\s*x\\s*${NUMBER}\\s*"?$`, 'i');
const MULTI_PACKAGE = /@|\bboxes?\b|\bpallet\b|&|,|\beach\b/i;

const MAX_WEIGHT_LBS = 1000;
const MAX_DIMENSION_INCHES = 120;

function read(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function parseExistingWeightLbs(value: string): number | null {
  const match = value.match(new RegExp(`^${NUMBER}\\s*(?:lbs?|pounds?)?\\.?$`, 'i'));
  return match ? Number(match[1]) : null;
}

// Plans how to split the legacy combined "70lbs (27x25x12)" Shipping Dims value into Weight and Shipping Dims.
// Only a single package with one unambiguous weight in pounds is converted; everything else is left for a person.
export function planShippingCleanup(fields: Record<string, unknown>): ShippingCleanupPlan {
  const raw = read(fields, 'Shipping Dims').replace(/\s+/g, ' ').replace(/×/g, 'x');
  if (!raw) return { kind: 'skip', reason: 'empty' };
  if (DIMS_ONLY.test(raw)) return { kind: 'skip', reason: 'already-clean' };
  if (MULTI_PACKAGE.test(raw)) return { kind: 'review', reason: 'multi-package' };

  const combined = raw.match(WEIGHT_AND_DIMS);
  const weightOnly = combined ? null : raw.match(WEIGHT_ONLY);
  if (!combined && !weightOnly) return { kind: 'review', reason: 'unrecognized' };

  const weight = Number((combined ?? weightOnly)![1]);
  const dimensions = combined ? [combined[2], combined[3], combined[4]] : [];
  if (!(weight > 0 && weight <= MAX_WEIGHT_LBS) || dimensions.some((value) => !(Number(value) > 0 && Number(value) <= MAX_DIMENSION_INCHES))) {
    return { kind: 'review', reason: 'implausible-values' };
  }

  const dims = dimensions.join('x');
  const existing = ['Weight', 'Shipping Weight'].map((name) => read(fields, name)).filter(Boolean);
  if (existing.length === 0) {
    return { kind: 'update', fields: { Weight: `${weight} lbs`, 'Shipping Dims': dims } };
  }

  // A weight is already recorded, so it is never overwritten: it must agree, otherwise a person decides.
  return existing.every((value) => parseExistingWeightLbs(value) === weight)
    ? { kind: 'update', fields: { 'Shipping Dims': dims } }
    : { kind: 'review', reason: 'weight-conflict' };
}

const CANONICAL_WEIGHT = /^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)?\.?$/i;

// "46 lbs" (number, one space, lbs) is the canonical form: it matches the intake form and ~97% of existing values, and
// Shopify and eBay both read it as pounds. Spacing, case, a trailing period and a bare number are safe to normalize.
// Anything else (free text, several weights) is reported, not changed.
export function planWeightFormat(fields: Record<string, unknown>): { fields: Record<string, string>; freeText: string[] } {
  const update: Record<string, string> = {};
  const freeText: string[] = [];
  for (const name of ['Weight', 'Shipping Weight']) {
    const value = read(fields, name);
    if (!value) continue;
    const match = value.match(CANONICAL_WEIGHT);
    if (!match) {
      freeText.push(name);
      continue;
    }

    const pounds = Number(match[1]);
    const canonical = `${pounds} lbs`;
    if (pounds > 0 && pounds <= MAX_WEIGHT_LBS && value !== canonical) update[name] = canonical;
  }

  return { fields: update, freeText };
}

export interface ShippingRecordPlan {
  fields: Record<string, string>;
  dims: ShippingCleanupPlan;
  weightFreeText: string[];
}

// Everything the cleanup would write for one record: the dimensions split plus weight formatting.
export function planShippingRecord(fields: Record<string, unknown>): ShippingRecordPlan {
  const dims = planShippingCleanup(fields);
  const afterDims = dims.kind === 'update' ? { ...fields, ...dims.fields } : fields;
  const weight = planWeightFormat(afterDims);
  return { fields: { ...(dims.kind === 'update' ? dims.fields : {}), ...weight.fields }, dims, weightFreeText: weight.freeText };
}

export interface ShippingOriginal {
  Weight: string | null;
  'Shipping Weight': string | null;
  'Shipping Dims': string | null;
}

export type ShippingRestorePlan =
  | { kind: 'restore'; fields: Record<string, string> }
  | { kind: 'skip'; reason: 'already-original' | 'changed-since-cleanup' };

// Undo is safe against later edits: the originals are put back only if the record still holds exactly the state
// the cleanup would have produced from them. Anything else was edited since and is left alone.
export function planShippingRestore(original: ShippingOriginal, current: Record<string, unknown>): ShippingRestorePlan {
  const now = { Weight: read(current, 'Weight'), 'Shipping Weight': read(current, 'Shipping Weight'), 'Shipping Dims': read(current, 'Shipping Dims') };
  const before = { Weight: original.Weight ?? '', 'Shipping Weight': original['Shipping Weight'] ?? '', 'Shipping Dims': original['Shipping Dims'] ?? '' };
  if (now.Weight === before.Weight && now['Shipping Weight'] === before['Shipping Weight'] && now['Shipping Dims'] === before['Shipping Dims']) {
    return { kind: 'skip', reason: 'already-original' };
  }

  // Earlier cleanup runs split dimensions only; later ones also format the weight. Either result can be undone.
  const dimsOnly = planShippingCleanup({ ...before });
  const candidates = [
    planShippingRecord({ ...before }).fields,
    dimsOnly.kind === 'update' ? dimsOnly.fields : {},
  ].filter((written) => Object.keys(written).length > 0);
  const matches = candidates.some((written) => {
    const expected = { ...before, ...written };
    return now.Weight === expected.Weight && now['Shipping Weight'] === expected['Shipping Weight'] && now['Shipping Dims'] === expected['Shipping Dims'];
  });
  if (matches) {
    return { kind: 'restore', fields: before };
  }

  return { kind: 'skip', reason: 'changed-since-cleanup' };
}
