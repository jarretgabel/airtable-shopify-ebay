import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { KeyFeaturesEditor } from '@/components/approval/KeyFeaturesEditor';
import { TestingNotesEditor } from '@/components/approval/TestingNotesEditor';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import type { ListingApprovalCombinedSharedSectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';

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
  currentPageShopifyTagValues,
  currentPageShopifyCollectionIds,
  currentPageShopifyCollectionLabelsById,
  combinedSharedKeyFeaturesFieldName,
  combinedSharedKeyFeaturesSyncFieldNames,
  combinedEbayTestingNotesFieldName,
  sharedDrawerRequiredStatus,
}: ListingApprovalCombinedSharedSectionProps) {
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
          allFieldNames={combinedSharedFieldNames}
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
          normalizedShopifyTagValues={currentPageShopifyTagValues}
          normalizedShopifyCollectionIds={currentPageShopifyCollectionIds}
          normalizedShopifyCollectionLabelsById={currentPageShopifyCollectionLabelsById}
        />

        {combinedSharedKeyFeaturesFieldName && (
          <KeyFeaturesEditor
            keyFeaturesFieldName={combinedSharedKeyFeaturesFieldName}
            keyFeaturesValue={formValues[combinedSharedKeyFeaturesFieldName] ?? ''}
            setFormValue={setFormValue}
            syncFieldNames={combinedSharedKeyFeaturesSyncFieldNames}
            disabled={saving}
          />
        )}

        {combinedEbayTestingNotesFieldName && (
          <TestingNotesEditor
            fieldName={combinedEbayTestingNotesFieldName}
            value={formValues[combinedEbayTestingNotesFieldName] ?? ''}
            setFormValue={setFormValue}
            disabled={saving}
            label="Testing Notes"
          />
        )}
      </div>
    </details>
  );
}