import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import {
  ListingApprovalTestingSection,
  resolveListingApprovalTestingSectionFields,
} from '@/components/approval/listingApprovalTestingSection';
import { CONDITION_FIELD } from '@/stores/approvalStore';
import type { ListingApprovalCombinedSharedSectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';

const iconActionButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white/5 text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-white/10 hover:text-[var(--ink)]';

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5">
      <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L6 12H4v-2l7.5-7.5Z" />
      <path d="M10.5 3.5l2 2" />
    </svg>
  );
}

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
  titleFieldName,
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
  onOpenOperationalRecord,
  onOpenTestingForm,
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
  const normalizedTitleFieldName = normalizeSharedFieldName(titleFieldName);
  const standardSharedFieldNames = combinedSharedFieldNames.filter((fieldName) => {
    const normalizedFieldName = normalizeSharedFieldName(fieldName);
    return !sharedTestingFieldSet.has(normalizedFieldName) && normalizedFieldName !== normalizedTitleFieldName;
  });
  const readOnlySharedFieldNames = standardSharedFieldNames.filter(isSourceManagedCombinedField);
  const editableSharedFieldNames = standardSharedFieldNames.filter((fieldName) => !isSourceManagedCombinedField(fieldName));
  const effectiveSharedFormValues = {
    ...formValues,
    ...Object.fromEntries(
      readOnlySharedFieldNames
        .filter((fieldName) => hasReadableValue(effectiveSharedTestingSourceFieldValues[fieldName]))
        .map((fieldName) => [fieldName, effectiveSharedTestingSourceFieldValues[fieldName] ?? '']),
    ),
  };
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

  return (
    <details className="rounded-lg border border-[var(--line)] bg-white/5" open>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
        <span className="inline-flex items-center gap-2">
          <span>Shared Fields</span>
          {sharedDrawerRequiredStatus.hasRequired && <DrawerStatusIcon allFilled={sharedDrawerRequiredStatus.allFilled} />}
        </span>
      </summary>
      <div className="border-t border-[var(--line)] px-3 py-3 space-y-4">
        {titleFieldName && (
          <ApprovalFormFields
            recordId={selectedRecord.id}
            approvalChannel="combined"
            isCombinedApproval
            allFieldNames={[titleFieldName]}
            writableFieldNames={writableFieldNames}
            readOnlyFieldNames={[]}
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
        )}

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
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 px-4 py-3">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Source-Managed Details</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Make, Model, Condition, SKU, and Component Type are auto-populated from the workflow and testing source forms.
                </p>
              </div>
              {workflowHeaderAction ? <div className="shrink-0">{workflowHeaderAction}</div> : null}
            </div>

            <div className="pt-3">
              <ApprovalFormFields
                recordId={selectedRecord.id}
                approvalChannel="combined"
                isCombinedApproval
                allFieldNames={readOnlySharedFieldNames}
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
            </div>
          </section>
        )}

        {editableSharedFieldNames.length > 0 && (
          <ApprovalFormFields
            recordId={selectedRecord.id}
            approvalChannel="combined"
            isCombinedApproval
            allFieldNames={editableSharedFieldNames}
            writableFieldNames={writableFieldNames}
            readOnlyFieldNames={[]}
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
        )}

        <ListingApprovalTestingSection fields={sharedTestingFields} formValues={effectiveSharedTestingSourceFieldValues} headerAction={testingHeaderAction} />

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