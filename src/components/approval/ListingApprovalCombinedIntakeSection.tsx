import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';
import {
  ListingApprovalTestingSection,
  resolveListingApprovalTestingSectionFields,
} from '@/components/approval/listingApprovalTestingSection';
import { CONDITION_FIELD } from '@/stores/approvalStore';
import type { ListingApprovalCombinedIntakeSectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';

const iconActionButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white/5 text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-white/10 hover:text-[var(--ink)]';

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5">
      <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L6 12H4v-2l7.5-7.5Z" />
      <path d="M10.5 3.5l2 2" />
    </svg>
  );
}

function normalizeSharedFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

const COMBINED_SOURCE_MANAGED_FIELD_NAMES = new Set([
  'sku',
  'make',
  'model',
  'serial number',
  'component type',
  'condition',
  'item condition',
  'shopify condition',
  'shopify rest condition',
  'ebay inventory condition',
  CONDITION_FIELD.toLowerCase(),
]);

const INTAKE_TESTING_FIELD_NAMES = new Set([
  'manual',
  'original box',
  'remote',
  'power cable',
]);

const INTAKE_SNAPSHOT_FIELD_ORDER: Record<string, number> = {
  make: 0,
  model: 1,
  sku: 2,
  'serial number': 3,
  'component type': 4,
  condition: 5,
  'original box': 6,
  manual: 7,
  remote: 8,
  'power cable': 9,
};

function isSourceManagedCombinedField(fieldName: string): boolean {
  return COMBINED_SOURCE_MANAGED_FIELD_NAMES.has(normalizeSharedFieldName(fieldName));
}

function hasReadableValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeSnapshotValue(value: unknown): string {
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

function toSourceManagedSnapshotLabel(fieldName: string): string {
  return normalizeSharedFieldName(fieldName) === normalizeSharedFieldName(CONDITION_FIELD)
    ? 'Condition'
    : fieldName;
}

export function ListingApprovalCombinedIntakeSection({
  sectionId,
  selectedRecord,
  formValues,
  combinedSharedFieldNames,
  originalFieldValues,
  sharedTestingSourceFieldValues,
  onOpenOperationalRecord,
  onOpenTestingForm,
}: ListingApprovalCombinedIntakeSectionProps) {
  const effectiveSharedTestingSourceFieldValues = {
    ...originalFieldValues,
    ...sharedTestingSourceFieldValues,
  };
  const sharedTestingFields = resolveListingApprovalTestingSectionFields(
    Array.from(new Set([
      ...Object.keys(originalFieldValues),
      ...Object.keys(sharedTestingSourceFieldValues),
    ])),
    { includeMissing: true },
  );
  const intakeTestingFields = sharedTestingFields.filter((field) => INTAKE_TESTING_FIELD_NAMES.has(normalizeSharedFieldName(field.fieldName)));
  const displayedTestingFields = sharedTestingFields.filter((field) => (
    !INTAKE_TESTING_FIELD_NAMES.has(normalizeSharedFieldName(field.fieldName))
  ));
  const readOnlySharedFieldNames = combinedSharedFieldNames.filter(isSourceManagedCombinedField);
  const intakeSnapshotFields = [
    ...readOnlySharedFieldNames.map((fieldName) => ({
      label: toSourceManagedSnapshotLabel(fieldName),
      value: normalizeSnapshotValue(
        hasReadableValue(effectiveSharedTestingSourceFieldValues[fieldName])
          ? effectiveSharedTestingSourceFieldValues[fieldName]
          : formValues[fieldName] ?? '',
      ),
    })),
    ...intakeTestingFields.map((field) => ({
      label: field.label,
      value: normalizeSnapshotValue(effectiveSharedTestingSourceFieldValues[field.fieldName] ?? ''),
    })),
  ].sort((left, right) => {
    const leftOrder = INTAKE_SNAPSHOT_FIELD_ORDER[normalizeSharedFieldName(left.label)] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = INTAKE_SNAPSHOT_FIELD_ORDER[normalizeSharedFieldName(right.label)] ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
  const workflowHeaderAction = onOpenOperationalRecord ? (
    <button
      type="button"
      className={iconActionButtonClass}
      onClick={() => onOpenOperationalRecord(selectedRecord.id)}
      aria-label="Edit workflow source record"
      title="Edit workflow source record"
    >
      <EditIcon />
    </button>
  ) : null;
  const testingHeaderAction = onOpenTestingForm ? (
    <button
      type="button"
      className={iconActionButtonClass}
      onClick={() => onOpenTestingForm(selectedRecord.id)}
      aria-label="Edit testing form"
      title="Edit testing form"
    >
      <EditIcon />
    </button>
  ) : null;
  const hasSections = intakeSnapshotFields.length > 0 || displayedTestingFields.length > 0;

  if (!hasSections) return null;

  return (
    <AppPageSectionSurface id={sectionId} className="scroll-mt-24 space-y-4 bg-[var(--bg)]/60">
      <div className="space-y-4">
        {intakeSnapshotFields.length > 0 || displayedTestingFields.length > 0 ? (
          <IntakeSnapshotSection
            title="Intake Details"
            actions={workflowHeaderAction}
            fields={intakeSnapshotFields}
            cards={[]}
            className="bg-[var(--panel)]/70"
          >
            <ListingApprovalTestingSection
              fields={displayedTestingFields}
              formValues={effectiveSharedTestingSourceFieldValues}
              headerAction={testingHeaderAction}
              className="mt-4 border-t border-[var(--line)] pt-4"
              embedded
            />
          </IntakeSnapshotSection>
        ) : null}
      </div>
    </AppPageSectionSurface>
  );
}