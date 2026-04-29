import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { BodyHtmlPreview } from '@/components/approval/BodyHtmlPreview';
import {
  EBAY_LISTING_TEMPLATE_OPTIONS,
  normalizeEbayListingTemplateId,
} from '@/components/approval/listingApprovalEbayConstants';
import { DrawerStatusIcon } from '@/components/approval/listingApprovalRequiredFieldHelpers';
import type { ListingApprovalCombinedEbaySectionProps } from '@/components/approval/listingApprovalCombinedSectionTypes';

export function ListingApprovalCombinedEbaySection({
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
  ebayDraftPayloadBundleJson,
  ebayPayloadDocsJson,
}: ListingApprovalCombinedEbaySectionProps) {
  return (
    <details className="rounded-lg border border-[var(--line)] bg-white/5" open>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
        <span className="inline-flex items-center gap-2">
          <span>eBay-Specific Fields</span>
          {ebayDrawerRequiredStatus.hasRequired && <DrawerStatusIcon allFilled={ebayDrawerRequiredStatus.allFilled} />}
        </span>
      </summary>
      <div className="border-t border-[var(--line)] px-3 py-3">
        <ApprovalFormFields
          recordId={selectedRecord.id}
          approvalChannel="ebay"
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

        <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
            eBay Create Listing API Payload (Exact Request)
          </summary>
          <div className="border-t border-[var(--line)] px-3 py-3">
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">
              Live payload preview for eBay Inventory Item and Offer requests using the current page values.
            </p>
            <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{ebayDraftPayloadBundleJson || '{\n  "inventoryItem": {},\n  "offer": {}\n}'}</pre>
          </div>
        </details>

        <details className="mt-4 rounded-lg border border-[var(--line)] bg-white/5">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
            eBay Create Listing API Payload (Docs Example)
          </summary>
          <div className="border-t border-[var(--line)] px-3 py-3">
            <p className="m-0 mb-2 text-xs text-[var(--muted)]">
              Reference example for typical Sell Inventory API inventory item and offer request bodies.
            </p>
            <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--ink)]">{ebayPayloadDocsJson}</pre>
          </div>
        </details>
      </div>
    </details>
  );
}