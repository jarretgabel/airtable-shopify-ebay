export interface FieldMeta {
  type: string;
  options?: { choices?: Array<{ name: string }> } | null;
}

export interface FieldIssue {
  field: string;
  message: string;
}

const NUMERIC_TYPES = new Set(['number', 'currency', 'percent', 'rating', 'duration']);

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function issueFor(name: string, meta: FieldMeta, value: unknown): string | null {
  if (isEmpty(value)) return null;
  const choices = (meta.options?.choices ?? []).map((choice) => choice.name);
  switch (meta.type) {
    case 'singleSelect':
      if (typeof value !== 'string') return 'must be one option name';
      return choices.includes(value) ? null : `"${value}" is not an option`;
    case 'multipleSelects': {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return 'must be a list of option names';
      const unknown = (value as string[]).filter((item) => !choices.includes(item));
      return unknown.length ? `${unknown.map((item) => `"${item}"`).join(', ')} not an option` : null;
    }
    case 'checkbox':
      return typeof value === 'boolean' ? null : 'must be true or false';
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? null : 'must be a YYYY-MM-DD date';
    case 'dateTime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? null : 'must be an ISO date and time';
    default:
      if (NUMERIC_TYPES.has(meta.type)) return typeof value === 'number' && Number.isFinite(value) ? null : 'must be a number';
      return null;
  }
}

/**
 * App-side replacement for Airtable's type and select-option checks. Only values that change are checked, so an
 * edit form that resends old values never fails because of older data. Typecast writes are not checked: Airtable
 * converts those values and creates new select options itself.
 */
export function validateFieldValues(
  metaByName: Map<string, FieldMeta>,
  patch: Record<string, unknown>,
  current: Record<string, unknown>,
  typecast: boolean,
): FieldIssue[] {
  if (typecast) return [];
  const issues: FieldIssue[] = [];
  for (const [name, value] of Object.entries(patch)) {
    const meta = metaByName.get(name);
    if (!meta || sameValue(value, current[name])) continue;
    const message = issueFor(name, meta, value);
    if (message) issues.push({ field: name, message });
  }
  return issues;
}
