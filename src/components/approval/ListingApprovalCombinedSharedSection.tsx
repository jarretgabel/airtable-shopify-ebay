import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import {
  ListingApprovalTestingSection,
  resolveListingApprovalTestingSectionFields,
} from '@/components/approval/listingApprovalTestingSection';
import { CONDITION_FIELD } from '@/stores/approvalStore';
import type { ListingApprovalCombinedSharedSectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';

const KeyFeaturesEditor = lazy(async () => ({
  default: (await import('@/components/approval/KeyFeaturesEditor')).KeyFeaturesEditor,
}));

function CombinedSharedEditorFallback() {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
      Loading shared editor...
    </div>
  );
}

function normalizeSharedFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

const COMBINED_SOURCE_MANAGED_FIELD_NAMES = new Set([
  'sku',
  'make',
  'model',
  'component type',
  'condition',
  'item condition',
  'shopify condition',
  'shopify rest condition',
  'ebay inventory condition',
  CONDITION_FIELD.toLowerCase(),
]);

function isSourceManagedCombinedField(fieldName: string): boolean {
  return COMBINED_SOURCE_MANAGED_FIELD_NAMES.has(normalizeSharedFieldName(fieldName));
}

function hasReadableValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function ListingApprovalCombinedSharedSection({
  selectedRecord,
  approvedFieldName,
  formValues,
  fieldKinds,
  listingFormatOptions,
  listingDurationOptions,
  saving,
  setFormValue,
  writableFieldNames,
  originalFieldValues,
  combinedDescriptionFieldName,
  combinedSharedFieldNames,
  combinedRequiredFieldNames,
  shopifyRequiredFieldNames,
  ebayRequiredFieldNames,
  combinedSharedKeyFeaturesFieldName,
  combinedSharedKeyFeaturesSyncFieldNames,
  sharedTestingSourceFieldValues,
  sharedDrawerRequiredStatus,
}: ListingApprovalCombinedSharedSectionProps) {
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
  const sharedTestingFieldSet = new Set(sharedTestingFields.map((field) => normalizeSharedFieldName(field.fieldName)));
  const standardSharedFieldNames = combinedSharedFieldNames.filter((fieldName) => !sharedTestingFieldSet.has(normalizeSharedFieldName(fieldName)));
  const readOnlySharedFieldNames = standardSharedFieldNames.filter(isSourceManagedCombinedField);
  const effectiveSharedFormValues = {
    ...formValues,
    ...Object.fromEntries(
      readOnlySharedFieldNames
        .filter((fieldName) => hasReadableValue(effectiveSharedTestingSourceFieldValues[fieldName]))
        .map((fieldName) => [fieldName, effectiveSharedTestingSourceFieldValues[fieldName] ?? '']),
    ),
  };

  return (
    <details className="rounded-lg border border-[var(--line)] bg-white/5" open>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
        <span className="inline-flex items-center gap-2">
          <span>Shared Fields</span>
          {sharedDrawerRequiredStatus.hasRequired && <DrawerStatusIcon allFilled={sharedDrawerRequiredStatus.allFilled} />}
        </span>
      </summary>
      <div className="border-t border-[var(--line)] px-3 py-3 space-y-4">
        {combinedDescriptionFieldName && (
          <label className="flex flex-col gap-2">
            <span className="mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Description</span>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70"
              value={formValues[combinedDescriptionFieldName] ?? ''}
              onChange={(event) => setFormValue(combinedDescriptionFieldName, event.target.value)}
              disabled={saving}
            />
          </label>
        )}

        {readOnlySharedFieldNames.length > 0 && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 px-4 py-3 text-sm text-[var(--muted)]">
            Make, Model, Condition, SKU, and Component Type are auto-populated from the workflow and testing source forms. Update those source records to change these values.
          </div>
        )}

        <ApprovalFormFields
          recordId={selectedRecord.id}
          approvalChannel="combined"
          isCombinedApproval
          allFieldNames={standardSharedFieldNames}
          writableFieldNames={writableFieldNames}
          readOnlyFieldNames={readOnlySharedFieldNames}
          requiredFieldNames={combinedRequiredFieldNames}
          shopifyRequiredFieldNames={shopifyRequiredFieldNames}
          ebayRequiredFieldNames={ebayRequiredFieldNames}
          approvedFieldName={approvedFieldName}
          formValues={effectiveSharedFormValues}
          fieldKinds={fieldKinds}
          listingFormatOptions={listingFormatOptions}
          listingDurationOptions={listingDurationOptions}
          saving={saving}
          setFormValue={setFormValue}
          suppressImageScalarFields
          originalFieldValues={effectiveSharedTestingSourceFieldValues}
        />

        <ListingApprovalTestingSection fields={sharedTestingFields} formValues={effectiveSharedTestingSourceFieldValues} />

        {combinedSharedKeyFeaturesFieldName && (
          <Suspense fallback={<CombinedSharedEditorFallback />}>
            <KeyFeaturesEditor
              keyFeaturesFieldName={combinedSharedKeyFeaturesFieldName}
              keyFeaturesValue={formValues[combinedSharedKeyFeaturesFieldName] ?? ''}
              setFormValue={setFormValue}
              syncFieldNames={combinedSharedKeyFeaturesSyncFieldNames}
              disabled={saving}
            />
          </Suspense>
        )}
      </div>
    </details>
  );
}