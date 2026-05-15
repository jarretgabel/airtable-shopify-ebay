import type { ReactNode } from 'react';

export interface ListingApprovalTestingSectionField {
  fieldName: string;
  label: string;
  multiline: boolean;
}

interface ResolveListingApprovalTestingSectionFieldsOptions {
  includeMissing?: boolean;
}

const LISTING_APPROVAL_TESTING_SECTION_DEFINITIONS = [
  { label: 'Manual', candidates: ['Manual'], multiline: false },
  { label: 'Original Box', candidates: ['Original Box'], multiline: false },
  { label: 'Voltage', candidates: ['Voltage'], multiline: false },
  { label: 'Remote', candidates: ['Remote'], multiline: false },
  { label: 'Power Cable', candidates: ['Power Cable'], multiline: false },
  {
    label: 'Testing Notes',
    candidates: ['Testing Notes', 'eBay Testing Notes', 'eBay Body Testing Notes', 'eBay Listing Testing Notes'],
    multiline: true,
  },
  { label: 'Audiogon Rating', candidates: ['Audiogon Rating'], multiline: false },
  { label: 'Cosmetic Notes', candidates: ['Cosmetic Condition Notes'], multiline: true },
] as const;

function normalizeTestingFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

export function resolveListingApprovalTestingSectionFields(
  fieldNames: string[],
  options: ResolveListingApprovalTestingSectionFieldsOptions = {},
): ListingApprovalTestingSectionField[] {
  return LISTING_APPROVAL_TESTING_SECTION_DEFINITIONS.flatMap((definition) => {
    const fieldName = definition.candidates
      .map((candidate) => fieldNames.find((value) => normalizeTestingFieldName(value) === candidate.toLowerCase()))
      .find(Boolean);

    if (!fieldName && !options.includeMissing) return [];

    return [{
      fieldName: fieldName ?? definition.candidates[0],
      label: definition.label,
      multiline: definition.multiline,
    }];
  });
}

function normalizeTestingSectionValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(', ');
  if (typeof value !== 'string') return String(value);

  const trimmed = value.trim();
  if (!trimmed.startsWith('[')) return value;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return value;
    return parsed.map((entry) => String(entry)).join(', ');
  } catch {
    return value;
  }
}

export function ListingApprovalTestingSection({
  fields,
  formValues,
  headerAction,
}: {
  fields: ListingApprovalTestingSectionField[];
  formValues: Record<string, string>;
  headerAction?: ReactNode;
}) {
  if (fields.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg border border-[var(--line)] bg-white/5 px-3 py-3 md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Testing</h3>
          <p className="m-0 text-xs leading-5 text-[var(--muted)]">
            Read-only testing details mirrored from the Testing form.
          </p>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map(({ fieldName, label, multiline }) => {
          const value = normalizeTestingSectionValue(formValues[fieldName]);

          return (
            <label
              key={fieldName}
              className={`flex flex-col gap-2 ${multiline ? 'md:col-span-2' : ''}`}
            >
              <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
              {multiline ? (
                <textarea
                  className="min-h-[110px] w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  value={value}
                  readOnly
                  disabled
                  aria-label={label}
                />
              ) : (
                <input
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  value={value}
                  readOnly
                  disabled
                  aria-label={label}
                />
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}