import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
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
import { findEbayBodyHtmlFieldName } from '@/components/approval/listingApprovalFieldHelpers';
import type { ListingApprovalCombinedEbaySectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';
import { getEbayRuntimeConfig } from '@/services/app-api/ebay';
import type { EbayRuntimeConfig } from '@/services/ebay/types';
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
  const editableEbayBodyHtmlFieldName = combinedEbayBodyHtmlFieldName
    || findEbayBodyHtmlFieldName(Object.keys(selectedRecord.fields));
  const editableEbayBodyHtmlValue = editableEbayBodyHtmlFieldName
    ? (formValues[editableEbayBodyHtmlFieldName] ?? '')
    : '';
  const effectiveEbayBodyHtmlForPreview = bodyHtmlPreview
    || combinedEbayGeneratedBodyHtml
    || editableEbayBodyHtmlValue
    || combinedEbayBodyHtmlValue;

  const showDeveloperPayloadPanels = useAuthStore((state) => {
    const currentUser = state.users.find((user) => user.id === state.currentUserId);
    return currentUser ? isDeveloperRole(currentUser.role) : false;
  });
  const [ebayRuntimeConfig, setEbayRuntimeConfig] = useState<EbayRuntimeConfig | null>(null);

  useEffect(() => {
    if (!showDeveloperPayloadPanels) return;
    let active = true;
    void getEbayRuntimeConfig()
      .then((config) => {
        if (active) setEbayRuntimeConfig(config);
      })
      .catch(() => {
        if (active) setEbayRuntimeConfig(null);
      });
    return () => {
      active = false;
    };
  }, [showDeveloperPayloadPanels]);

  const ebayLocationSyncPreview = useMemo(() => {
    const location = ebayRuntimeConfig?.publishSetup.locationConfig;
    if (!location) return null;

    const rawItemPostalCode = selectedRecord.fields['Item Zip Code']
      ?? selectedRecord.fields['Item Postal Code']
      ?? selectedRecord.fields['Location Zip Code']
      ?? selectedRecord.fields['Location Postal Code'];
    const itemPostalCode = typeof rawItemPostalCode === 'string' || typeof rawItemPostalCode === 'number'
      ? String(rawItemPostalCode).trim()
      : '';
    const postalCode = itemPostalCode || location.postalCode;
    const address = {
      country: location.country,
      ...(postalCode ? { postalCode } : {}),
      ...(location.city ? { city: location.city } : {}),
      ...(location.stateOrProvince ? { stateOrProvince: location.stateOrProvince } : {}),
    };
    const createBody = {
      name: location.name || location.key,
      merchantLocationStatus: 'ENABLED',
      locationTypes: ['WAREHOUSE'],
      location: { address },
    };
    const { merchantLocationStatus: _status, ...updateBody } = createBody;
    const locationPath = `/sell/inventory/v1/location/${encodeURIComponent(location.key)}`;

    return {
      postalCodeSource: itemPostalCode ? 'Item Zip Code' : 'eBay default location configuration',
      effectivePostalCode: postalCode,
      lookup: { method: 'GET', path: locationPath },
      createIfMissing: { method: 'POST', path: locationPath, body: createBody },
      updateIfDifferent: { method: 'POST', path: `${locationPath}/update_location_details`, body: updateBody },
    };
  }, [ebayRuntimeConfig, selectedRecord.fields]);

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
          showWorkflowImageSelector={false}
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
          showSupplementalEditors={false}
          showWorkflowImageSelector={false}
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
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">Current HTML source saved for this listing.</p>
            {!combinedEbayBodyHtmlFieldName && (
              <p className="m-0 mb-2 text-xs text-[var(--muted)]">No canonical eBay Body HTML field was found; showing the currently edited preview source.</p>
            )}
            <pre className={`${detailPreBlockClass} max-h-[260px] overflow-auto`}>{effectiveEbayBodyHtmlForPreview}</pre>
          </div>
        </details>

        <details className={`mt-4 ${detailDisclosureClass}`}>
          <summary className={detailDisclosureSummaryClass}>eBay Body Rendered</summary>
          <div className={detailDisclosureBodyClass}>
            <BodyHtmlPreview
              value={effectiveEbayBodyHtmlForPreview}
              previewOnly
              showTemplateSelector={false}
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
              ebayLocationSyncPreview={ebayLocationSyncPreview}
            />
          </Suspense>
        ) : null}
      </div>
    </AppPageSectionSurface>
  );
}