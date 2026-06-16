import { useMemo } from 'react';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';
import { WorkflowReferenceImagesPanel } from '@/components/tabs/WorkflowReferenceImagesPanel';
import { parseKeyFeatureEntries } from '@/services/shopifyBodyHtml';
import { parseWorkflowImageMetadata } from '@/services/workflowImageMetadata';
import {
  ListingApprovalTestingSection,
  resolveListingApprovalTestingSectionFields,
} from '@/components/approval/listingApprovalTestingSection';
import {
  ListingApprovalPhotographySection,
  resolveListingApprovalPhotographySectionFields,
} from '@/components/approval/listingApprovalPhotographySection';
import {
  findWorkflowImageAttachmentFieldName,
  findWorkflowImageMetadataFieldName,
  parseWorkflowImageAttachments,
} from '@/components/approval/workflowListingImageHelpers';
import { sharedIconActionButtonClass } from '@/components/tabs/uiClasses';
import { CONDITION_FIELD } from '@/stores/approvalStore';
import type { ListingApprovalCombinedIntakeSectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';

const iconActionButtonClass = sharedIconActionButtonClass;

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
  includes: 6,
  'original box': 7,
  manual: 8,
  remote: 9,
  'power cable': 10,
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

function resolveIntakeTestingSnapshotValue(
  field: { fieldName: string; label: string },
  values: Record<string, string>,
): string {
  return normalizeSnapshotValue(values[field.fieldName] ?? '');
}

function resolveFeatureValueFromKeyFeatureFields(
  values: Array<Record<string, string>>,
  featureName: string,
): string {
  const normalizedFeatureName = normalizeSharedFieldName(featureName);
  const candidateFieldNames = [
    'eBay Body Key Features JSON',
    'eBay Body Key Features',
    'eBay Listing Key Features JSON',
    'eBay Listing Key Features',
    'Key Features JSON',
    'Key Features',
  ];

  for (const sourceValues of values) {
    for (const fieldName of candidateFieldNames) {
      const rawValue = sourceValues[fieldName];
      if (!rawValue || !rawValue.trim()) continue;

      const match = parseKeyFeatureEntries(rawValue).find((entry) => normalizeSharedFieldName(entry.feature) === normalizedFeatureName);
      if (match?.value?.trim()) return match.value;
    }
  }

  return '';
}

function resolveIncludesSnapshotValue(
  sourceValues: Record<string, string>,
  formValues: Record<string, string>,
): string {
  const customerValue = sourceValues['Customer Inclusion Notes'];
  if (customerValue?.trim()) return normalizeSnapshotValue(customerValue);

  const internalValue = sourceValues['Internal Inclusion Notes'];
  if (internalValue?.trim()) return normalizeSnapshotValue(internalValue);

  return normalizeSnapshotValue(resolveFeatureValueFromKeyFeatureFields([
    formValues,
    sourceValues,
  ], 'Includes'));
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
  onOpenPhotosForm,
}: ListingApprovalCombinedIntakeSectionProps) {
  const allOriginalFieldNames = useMemo(() => Object.keys(originalFieldValues), [originalFieldValues]);

  const intakeImages = useMemo(() => {
    const attachmentFieldName = findWorkflowImageAttachmentFieldName(allOriginalFieldNames);
    const metadataFieldName = findWorkflowImageMetadataFieldName(allOriginalFieldNames);
    const attachments = parseWorkflowImageAttachments(attachmentFieldName ? (originalFieldValues[attachmentFieldName] ?? '') : '');
    if (attachments.length === 0) return [];
    const metadata = parseWorkflowImageMetadata(metadataFieldName ? (originalFieldValues[metadataFieldName] ?? '') : '');
    if (metadata.length === 0) return attachments;
    const metadataByUrl = new Map(metadata.map((m) => [m.url.trim().toLowerCase(), m]));
    return attachments.filter((a) => {
      const meta = metadataByUrl.get(a.url.trim().toLowerCase());
      return meta?.sourceStage === 'intake';
    });
  }, [allOriginalFieldNames, originalFieldValues]);

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
  const displayedPhotographyFields = resolveListingApprovalPhotographySectionFields(
    Array.from(new Set([
      ...Object.keys(originalFieldValues),
      ...Object.keys(sharedTestingSourceFieldValues),
    ])),
    { includeMissing: true },
  );
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
    {
      label: 'Includes',
      value: resolveIncludesSnapshotValue(effectiveSharedTestingSourceFieldValues, formValues),
    },
    ...intakeTestingFields.map((field) => ({
      label: field.label,
      value: resolveIntakeTestingSnapshotValue(field, effectiveSharedTestingSourceFieldValues),
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
  const photographyHeaderAction = onOpenPhotosForm ? (
    <button
      type="button"
      className={iconActionButtonClass}
      onClick={() => onOpenPhotosForm(selectedRecord.id)}
      aria-label="Edit photos form"
      title="Edit photos form"
    >
      <EditIcon />
    </button>
  ) : null;
  const hasSections = intakeSnapshotFields.length > 0
    || displayedTestingFields.length > 0
    || displayedPhotographyFields.length > 0
    || intakeImages.length > 0;

  if (!hasSections) return null;

  return (
    <AppPageSectionSurface id={sectionId} className="scroll-mt-24 space-y-4 bg-[var(--bg)]/60">
      <div className="space-y-4">
        {intakeSnapshotFields.length > 0 || displayedTestingFields.length > 0 || intakeImages.length > 0 ? (
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
            <ListingApprovalPhotographySection
              fields={displayedPhotographyFields}
              formValues={effectiveSharedTestingSourceFieldValues}
              headerAction={photographyHeaderAction}
              className="mt-4 border-t border-[var(--line)] pt-4"
              embedded
            />
            <WorkflowReferenceImagesPanel
              title="Intake Photos"
              description="Images captured during intake."
              images={intakeImages}
            />
          </IntakeSnapshotSection>
        ) : null}
      </div>
    </AppPageSectionSurface>
  );
}