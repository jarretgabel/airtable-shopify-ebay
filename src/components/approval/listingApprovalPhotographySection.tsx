import type { ReactNode } from 'react';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';

export interface ListingApprovalPhotographySectionField {
  fieldName: string;
  label: string;
  multiline: boolean;
}

interface ResolveListingApprovalPhotographySectionFieldsOptions {
  includeMissing?: boolean;
}

const LISTING_APPROVAL_PHOTOGRAPHY_SECTION_DEFINITIONS = [
  { label: 'Photo Date', candidates: ["Photo'd", 'Photo Date'], multiline: false },
  { label: 'Additional Items', candidates: ['Additional Items'], multiline: false },
  { label: 'Audiogon Rating', candidates: ['Audiogon Rating'], multiline: false },
  {
    label: 'Cosmetic Notes',
    candidates: ['Photography Cosmetic Notes'],
    multiline: true,
  },
] as const;

function normalizePhotographyFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

export function resolveListingApprovalPhotographySectionFields(
  fieldNames: string[],
  options: ResolveListingApprovalPhotographySectionFieldsOptions = {},
): ListingApprovalPhotographySectionField[] {
  return LISTING_APPROVAL_PHOTOGRAPHY_SECTION_DEFINITIONS.flatMap((definition) => {
    const fieldName = definition.candidates
      .map((candidate) => fieldNames.find((value) => normalizePhotographyFieldName(value) === candidate.toLowerCase()))
      .find(Boolean);

    if (!fieldName && !options.includeMissing) return [];

    return [{
      fieldName: fieldName ?? definition.candidates[0],
      label: definition.label,
      multiline: definition.multiline,
    }];
  });
}

function normalizePhotographySectionValue(value: unknown): string {
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

export function ListingApprovalPhotographySection({
  fields,
  formValues,
  headerAction,
  className,
  embedded = false,
}: {
  fields: ListingApprovalPhotographySectionField[];
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
      value: normalizePhotographySectionValue(formValues[fieldName]),
    }));

  const snapshotCards = fields
    .filter(({ multiline }) => multiline)
    .map(({ fieldName, label }) => ({
      title: label,
      value: normalizePhotographySectionValue(formValues[fieldName]),
      emptyValue: 'Not provided',
    }));

  if (embedded) {
    return (
      <div className={className}>
        <AppSectionTitle title="Photography" titleClassName="text-base" actions={headerAction} />
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
      title="Photography"
      actions={headerAction}
      fields={snapshotFields}
      cards={snapshotCards}
      className={className}
    />
  );
}