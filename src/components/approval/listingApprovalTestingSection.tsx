import type { ReactNode } from 'react';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';

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
  { label: 'Shipping Weight', candidates: ['Shipping Weight', 'Weight'], multiline: false },
  { label: 'Shipping Dimensions', candidates: ['Shipping Dims'], multiline: false },
  { label: 'Remote', candidates: ['Remote'], multiline: false },
  { label: 'Power Cable', candidates: ['Power Cable'], multiline: false },
  {
    label: 'Testing Notes',
    candidates: ['Testing Notes', 'eBay Testing Notes', 'eBay Body Testing Notes', 'eBay Listing Testing Notes'],
    multiline: true,
  },
  { label: 'Audiogon Rating', candidates: ['Audiogon Rating'], multiline: false },
  { label: 'Cosmetic Notes', candidates: ['Testing Cosmetic Notes', 'Cosmetic Condition Notes'], multiline: true },
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
  className,
  embedded = false,
}: {
  fields: ListingApprovalTestingSectionField[];
  formValues: Record<string, string>;
  headerAction?: ReactNode;
  className?: string;
  embedded?: boolean;
}) {
  if (fields.length === 0) return null;

  const snapshotFields = fields
    .filter(({ multiline }) => !multiline)
    .map(({ fieldName, label }) => ({
      label,
      value: normalizeTestingSectionValue(formValues[fieldName]),
    }));

  const snapshotCards = fields
    .filter(({ multiline }) => multiline)
    .map(({ fieldName, label }) => ({
      title: label,
      value: normalizeTestingSectionValue(formValues[fieldName]),
      emptyValue: 'Not provided',
    }));

  if (embedded) {
    return (
      <div className={className}>
        <AppSectionTitle title="Testing" titleClassName="text-base" actions={headerAction} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {snapshotFields.map((field) => (
            <div key={field.label} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
              <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{field.label}</p>
              <p className="mt-1 text-sm leading-5 text-[var(--ink)]">{field.value || 'Not provided'}</p>
            </div>
          ))}
        </div>
        {snapshotCards.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {snapshotCards.map((card) => (
              <div key={card.title} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{card.title}</p>
                <p className="mt-2 whitespace-pre-wrap leading-6 text-[var(--ink)]">{card.value.trim() || card.emptyValue || 'No notes available.'}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <IntakeSnapshotSection
      title="Testing"
      actions={headerAction}
      fields={snapshotFields}
      cards={snapshotCards}
      className={className}
    />
  );
}