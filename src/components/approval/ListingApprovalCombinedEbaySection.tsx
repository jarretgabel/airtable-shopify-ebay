import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { isDeveloperRole } from '@/auth/roleAccess';
import {
  EBAY_LISTING_TEMPLATE_OPTIONS,
  normalizeEbayListingTemplateId,
} from '@/components/approval/listingApprovalEbayConstants';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
  detailPreBlockClass,
  insetPanelClass,
} from '@/components/tabs/uiClasses';
import type { ListingApprovalCombinedEbaySectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';
import { useAuthStore } from '@/stores/auth/authStore';

const EbayApprovalPayloadDetails = lazy(async () => ({
  default: (await import('@/components/approval/ListingApprovalRecordPayloadPanels')).EbayApprovalPayloadDetails,
}));

function EbayPayloadFallback() {
  return (
    <div className={`${insetPanelClass} mt-4 text-sm text-[var(--muted)]`}>
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
  const showDeveloperPayloadPanels = useAuthStore((state) => {
    const currentUser = state.users.find((user) => user.id === state.currentUserId);
    return currentUser ? isDeveloperRole(currentUser.role) : false;
  });

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

        <div
          role="separator"
          aria-label="Listing content divider"
          className="mt-5 border-t border-[var(--line)]/80"
        />

        <details className={`mt-4 ${detailDisclosureClass}`}>
          <summary className={detailDisclosureSummaryClass}>eBay Body (HTML)</summary>
          <div className={detailDisclosureBodyClass}>
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">Read-only HTML from Airtable field.</p>
            {!combinedEbayBodyHtmlFieldName && (
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">No eBay Body HTML field was found for this record.</p>
            )}
            <pre className={`${detailPreBlockClass} max-h-[260px] overflow-auto`}>{combinedEbayBodyHtmlValue}</pre>
          </div>
        </details>

        <details className={`mt-4 ${detailDisclosureClass}`}>
          <summary className={detailDisclosureSummaryClass}>eBay Body Rendered</summary>
          <div className={detailDisclosureBodyClass}>
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

        {showDeveloperPayloadPanels ? (
          <Suspense fallback={<EbayPayloadFallback />}>
            <EbayApprovalPayloadDetails
              isEbayPayloadPreviewContext={isEbayPayloadPreviewContext}
              ebayDraftPayloadBundle={ebayDraftPayloadBundle}
            />
          </Suspense>
        ) : null}
      </div>
    </AppPageSectionSurface>
  );
}