import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import {
  EBAY_LISTING_TEMPLATE_OPTIONS,
  normalizeEbayListingTemplateId,
} from '@/components/approval/listingApprovalEbayConstants';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import type { ListingApprovalCombinedEbaySectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';

const EbayApprovalPayloadDetails = lazy(async () => ({
  default: (await import('@/components/approval/ListingApprovalRecordPayloadPanels')).EbayApprovalPayloadDetails,
}));

function EbayPayloadFallback() {
  return (
    <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
      Loading eBay payload preview...
    </div>
  );
}

export function ListingApprovalCombinedEbaySection({
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
  writableFieldNames,
  originalFieldValues,
  combinedEbayOnlyFieldNames,
  ebayRequiredFieldNames,
  ebayDrawerRequiredStatus,
  combinedEbayGeneratedBodyHtml,
  ebayCategoryLabelsById,
  setEbayCategoryLabelsById,
  setBodyHtmlPreview,
  selectedEbayTemplateId,
  setSelectedEbayTemplateId,
  combinedEbayBodyHtmlFieldName,
  combinedEbayBodyHtmlValue,
  bodyHtmlPreview,
  isEbayPayloadPreviewContext,
  ebayDraftPayloadBundle,
}: ListingApprovalCombinedEbaySectionProps) {
  return (
    <AppPageSectionSurface id={sectionId} className="scroll-mt-24 space-y-4 bg-[var(--bg)]/60">
      <AppSectionTitle
        title="eBay-Specific Fields"
        actions={ebayDrawerRequiredStatus.hasRequired ? <DrawerStatusIcon allFilled={ebayDrawerRequiredStatus.allFilled} /> : null}
      />
      <div>
        <ApprovalFormFields
          recordId={selectedRecord.id}
          approvalChannel="ebay"
          isCombinedApproval
          hideEbayAdvancedOptions
          allFieldNames={combinedEbayOnlyFieldNames}
          writableFieldNames={writableFieldNames}
          requiredFieldNames={ebayRequiredFieldNames}
          shopifyRequiredFieldNames={[]}
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
          normalizedBodyHtmlPreview={combinedEbayGeneratedBodyHtml}
          normalizedEbayCategoryLabelsById={ebayCategoryLabelsById}
          onEbayCategoryLabelsChange={(labelsById) => setEbayCategoryLabelsById((current) => ({ ...current, ...labelsById }))}
          onBodyHtmlPreviewChange={setBodyHtmlPreview}
          selectedEbayTemplateId={selectedEbayTemplateId}
          onEbayTemplateIdChange={setSelectedEbayTemplateId}
        />

        <ApprovalFormFields
          recordId={selectedRecord.id}
          approvalChannel="ebay"
          isCombinedApproval
          showOnlyEbayAdvancedOptions
          allFieldNames={combinedEbayOnlyFieldNames}
          writableFieldNames={writableFieldNames}
          requiredFieldNames={ebayRequiredFieldNames}
          shopifyRequiredFieldNames={[]}
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
          normalizedBodyHtmlPreview={combinedEbayGeneratedBodyHtml}
          normalizedEbayCategoryLabelsById={ebayCategoryLabelsById}
          onEbayCategoryLabelsChange={(labelsById) => setEbayCategoryLabelsById((current) => ({ ...current, ...labelsById }))}
          onBodyHtmlPreviewChange={setBodyHtmlPreview}
          selectedEbayTemplateId={selectedEbayTemplateId}
          onEbayTemplateIdChange={setSelectedEbayTemplateId}
        />

        <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">eBay Body (HTML)</summary>
          <div className="border-t border-[var(--line)] px-3 py-3">
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">Read-only HTML from Airtable field.</p>
            {!combinedEbayBodyHtmlFieldName && (
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">No eBay Body HTML field was found for this record.</p>
            )}
            <pre className="m-0 max-h-[260px] overflow-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{combinedEbayBodyHtmlValue}</pre>
          </div>
        </details>

        <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">eBay Body Rendered</summary>
          <div className="border-t border-[var(--line)] px-3 py-3">
            <BodyHtmlPreview
              value={combinedEbayGeneratedBodyHtml || bodyHtmlPreview || combinedEbayBodyHtmlValue}
              previewOnly
              showTemplateSelector
              templateOptions={EBAY_LISTING_TEMPLATE_OPTIONS}
              selectedTemplateId={selectedEbayTemplateId}
              onTemplateChange={(templateId) => setSelectedEbayTemplateId(normalizeEbayListingTemplateId(templateId))}
            />
          </div>
        </details>

        <Suspense fallback={<EbayPayloadFallback />}>
          <EbayApprovalPayloadDetails
            isEbayPayloadPreviewContext={isEbayPayloadPreviewContext}
            ebayDraftPayloadBundle={ebayDraftPayloadBundle}
          />
        </Suspense>
      </div>
    </AppPageSectionSurface>
  );
}