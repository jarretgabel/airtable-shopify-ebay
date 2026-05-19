import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import {
  isGenericImageAltField,
  isGenericImageUrlField,
  isShopifyImagePayloadField,
} from '@/components/approval/approvalFormFieldsImageHelpers';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import { resolveListingApprovalTestingSectionFields } from '@/components/approval/listingApprovalTestingSection';
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
  'serial number',
  'component type',
  'condition',
  'item condition',
  'shopify condition',
  'shopify rest condition',
  'ebay inventory condition',
  CONDITION_FIELD.toLowerCase(),
]);

const COMBINED_HIDDEN_KEY_FEATURE_NAMES = ['Make', 'Model', 'Serial Number', 'Condition', 'Component Type', 'Cosmetic Notes', 'Includes', 'Original Box', 'Manual', 'Remote', 'Power Cable', 'Voltage', 'Audiogon Rating'];

function isSourceManagedCombinedField(fieldName: string): boolean {
  return COMBINED_SOURCE_MANAGED_FIELD_NAMES.has(normalizeSharedFieldName(fieldName));
}

function isListingImageSupportField(fieldName: string): boolean {
  return isGenericImageUrlField(fieldName)
    || isGenericImageAltField(fieldName)
    || isShopifyImagePayloadField(fieldName);
}

function resolveComponentTypeValue(
  formValues: Record<string, string>,
  recordFields: Record<string, unknown>,
): string {
  const formEntry = Object.entries(formValues).find(([fieldName]) => normalizeSharedFieldName(fieldName) === 'component type');
  if (formEntry?.[1]?.trim()) return formEntry[1].trim();

  const recordEntry = Object.entries(recordFields).find(([fieldName]) => normalizeSharedFieldName(fieldName) === 'component type');
  const rawValue = recordEntry?.[1];
  if (typeof rawValue === 'string') return rawValue.trim();
  if (Array.isArray(rawValue)) {
    return rawValue.map((value) => String(value).trim()).filter(Boolean).join(', ');
  }

  return '';
}

export function ListingApprovalCombinedSharedSection({
  sectionId,
  selectedRecord,
  approvedFieldName,
  formValues,
  fieldKinds,
  listingFormatOptions,
  listingDurationOptions,
  saving,
  setFormValue,
  setDerivedFormValue,
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
}: ListingApprovalCombinedSharedSectionProps) {
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
  const editableSharedFieldNames = standardSharedFieldNames.filter((fieldName) => !isSourceManagedCombinedField(fieldName));
  const imageSupportSharedFieldNames = editableSharedFieldNames.filter(isListingImageSupportField);
  const postKeyFeaturesSharedFieldNames = editableSharedFieldNames.filter((fieldName) => !isListingImageSupportField(fieldName));
  const componentTypeValue = resolveComponentTypeValue(formValues, selectedRecord.fields);

  return (
    <AppPageSectionSurface id={sectionId} className="scroll-mt-24 space-y-4 bg-[var(--bg)]/60">
      <div className="space-y-4">
        <AppSectionTitle
          title="Shared Fields"
          actions={sharedDrawerRequiredStatus.hasRequired ? <DrawerStatusIcon allFilled={sharedDrawerRequiredStatus.allFilled} /> : null}
        />

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
            formValues={formValues}
            fieldKinds={fieldKinds}
            listingFormatOptions={listingFormatOptions}
            listingDurationOptions={listingDurationOptions}
            saving={saving}
            setFormValue={setFormValue}
            setDerivedFormValue={setDerivedFormValue}
            suppressImageScalarFields
            originalFieldValues={originalFieldValues}
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

        {imageSupportSharedFieldNames.length > 0 && (
          <ApprovalFormFields
            recordId={selectedRecord.id}
            approvalChannel="combined"
            isCombinedApproval
            allFieldNames={imageSupportSharedFieldNames}
            writableFieldNames={writableFieldNames}
            readOnlyFieldNames={[]}
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
            setDerivedFormValue={setDerivedFormValue}
            suppressImageScalarFields
            originalFieldValues={originalFieldValues}
          />
        )}

        {combinedSharedKeyFeaturesFieldName && (
          <Suspense fallback={<CombinedSharedEditorFallback />}>
            <KeyFeaturesEditor
              keyFeaturesFieldName={combinedSharedKeyFeaturesFieldName}
              keyFeaturesValue={formValues[combinedSharedKeyFeaturesFieldName] ?? ''}
              setFormValue={setFormValue}
              syncFieldNames={combinedSharedKeyFeaturesSyncFieldNames}
              disabled={saving}
              componentTypeValue={componentTypeValue}
              hiddenFeatureNames={COMBINED_HIDDEN_KEY_FEATURE_NAMES}
              helperNotice={(
                <p className="m-0 leading-5">
                  <span className="font-semibold uppercase tracking-[0.08em]">Automatic Mapping</span>{' '}
                  Make, Model, Serial Number, Condition, Component Type, Cosmetic Notes, Includes, Original Box, Manual, Remote, Power Cable, Voltage, and Audiogon Rating come from the listing record automatically. Add one here only when you need to override the listing value.
                </p>
              )}
            />
          </Suspense>
        )}

        {postKeyFeaturesSharedFieldNames.length > 0 && (
          <ApprovalFormFields
            recordId={selectedRecord.id}
            approvalChannel="combined"
            isCombinedApproval
            allFieldNames={postKeyFeaturesSharedFieldNames}
            writableFieldNames={writableFieldNames}
            readOnlyFieldNames={[]}
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
            setDerivedFormValue={setDerivedFormValue}
            suppressImageScalarFields
            originalFieldValues={originalFieldValues}
          />
        )}
      </div>
    </AppPageSectionSurface>
  );
}