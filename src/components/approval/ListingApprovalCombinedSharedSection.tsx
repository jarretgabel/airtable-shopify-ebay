import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import {
  ListingApprovalTestingSection,
  resolveListingApprovalTestingSectionFields,
} from '@/components/approval/listingApprovalTestingSection';
import { hasWorkflowListingSourceContext } from '@/stores/approval/approvalStoreWorkflowPrefill';
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
  const workflowManagedListingContent = hasWorkflowListingSourceContext(effectiveSharedTestingSourceFieldValues);
  const sharedTestingFields = resolveListingApprovalTestingSectionFields(
    Array.from(new Set([
      ...Object.keys(originalFieldValues),
      ...Object.keys(sharedTestingSourceFieldValues),
    ])),
    { includeMissing: true },
  );
  const sharedTestingFieldSet = new Set(sharedTestingFields.map((field) => normalizeSharedFieldName(field.fieldName)));
  const standardSharedFieldNames = combinedSharedFieldNames.filter((fieldName) => !sharedTestingFieldSet.has(normalizeSharedFieldName(fieldName)));

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

        <ApprovalFormFields
          recordId={selectedRecord.id}
          approvalChannel="combined"
          isCombinedApproval
          allFieldNames={standardSharedFieldNames}
          writableFieldNames={writableFieldNames}
          requiredFieldNames={combinedRequiredFieldNames}
          shopifyRequiredFieldNames={shopifyRequiredFieldNames}
          ebayRequiredFieldNames={ebayRequiredFieldNames}
          approvedFieldName={approvedFieldName}
          formValues={formValues}
          fieldKinds={fieldKinds}
          listingFormatOptions={listingFormatOptions}
          listingDurationOptions={listingDurationOptions}
          saving={saving}
          setFormValue={setFormValue}
          suppressImageScalarFields
          originalFieldValues={originalFieldValues}
        />

        <ListingApprovalTestingSection fields={sharedTestingFields} formValues={effectiveSharedTestingSourceFieldValues} />

        {combinedSharedKeyFeaturesFieldName && (
          <Suspense fallback={<CombinedSharedEditorFallback />}>
            <KeyFeaturesEditor
              keyFeaturesFieldName={combinedSharedKeyFeaturesFieldName}
              keyFeaturesValue={formValues[combinedSharedKeyFeaturesFieldName] ?? ''}
              setFormValue={setFormValue}
              syncFieldNames={combinedSharedKeyFeaturesSyncFieldNames}
              disabled={saving || workflowManagedListingContent}
              helperText={workflowManagedListingContent
                ? 'Read-only listing details derived from the Testing form and workflow fields. Update the Testing form to change these values.'
                : undefined}
            />
          </Suspense>
        )}
      </div>
    </details>
  );
}