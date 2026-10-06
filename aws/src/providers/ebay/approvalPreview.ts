import type { AirtableConfiguredRecordsSource } from '../airtable/sources.js';
import { getConfiguredRecord } from '../airtable/sources.js';
import type {
  ApprovalEbayBodyPreviewInput as EbayBodyPreviewInput,
  ApprovalEbayCategoryPreviewInput as EbayCategoryPreviewInput,
} from '../../shared/contracts/approval.js';
import type { EbayApprovalPreviewResult as EbayApprovalPreview } from '../../shared/contracts/ebayApproval.js';
import { buildEbayDraftPayloadBundleFromApprovalFields } from './approvalDraft.js';
import { buildEbayBodyHtmlFromTemplate } from './approvalBodyTemplate.js';
import { buildCategoryFieldUpdates, resolveSelectedCategoryIds, resolveSelectedCategoryNames } from './approvalPreviewCategories.js';
import type { ApprovalFieldMap } from './approvalShared.js';

export type { EbayApprovalPreview };

const EBAY_BODY_HTML_FIELD_ALIASES = [
  'Ebay Body (HTML)',
  'Ebay Body HTML',
  'eBay Body HTML',
  'ebay_body_html',
  'eBay Body (HTML)',
  'Body HTML',
  'Body (HTML)',
  'body_html',
] as const;

function applyGeneratedBodyHtml(fields: ApprovalFieldMap, fieldName: string, generatedBodyHtml: string): void {
  const aliasKeys = new Set(EBAY_BODY_HTML_FIELD_ALIASES.map((alias) => alias.toLowerCase()));
  Object.keys(fields).forEach((existingFieldName) => {
    if (aliasKeys.has(existingFieldName.toLowerCase())) {
      fields[existingFieldName] = generatedBodyHtml;
    }
  });
  fields[fieldName] = generatedBodyHtml;
}

export function buildEbayApprovalPreviewFromFields(
  fields: ApprovalFieldMap,
  bodyPreview?: EbayBodyPreviewInput,
  categoryPreview?: EbayCategoryPreviewInput,
): EbayApprovalPreview {
  const nextFields = { ...fields };
  const generatedBodyHtml = bodyPreview ? buildEbayBodyHtmlFromTemplate(bodyPreview) : '';
  if (generatedBodyHtml.trim()) {
    const bodyHtmlFieldName = bodyPreview?.fieldName?.trim() || 'Ebay Body (HTML)';
    applyGeneratedBodyHtml(nextFields, bodyHtmlFieldName, generatedBodyHtml);
  }

  const selectedCategoryIds = resolveSelectedCategoryIds(nextFields);
  const selectedCategoryNamesFromFields = resolveSelectedCategoryNames(nextFields);
  const selectedCategoryNames = selectedCategoryIds
    .map((categoryId, index) => categoryPreview?.labelsById?.[categoryId]?.trim() || selectedCategoryNamesFromFields[index] || '')
    .filter(Boolean)
    .slice(0, 2);
  const categoryFieldUpdates = buildCategoryFieldUpdates(nextFields, selectedCategoryNames);

  return {
    generatedBodyHtml,
    draftPayloadBundle: buildEbayDraftPayloadBundleFromApprovalFields(nextFields),
    selectedCategoryIds,
    selectedCategoryNames,
    categoryFieldUpdates,
  };
}

export async function buildEbayApprovalPreviewFromSource(params: {
  source: AirtableConfiguredRecordsSource;
  recordId: string;
  fields?: ApprovalFieldMap;
  bodyPreview?: EbayBodyPreviewInput;
  categoryPreview?: EbayCategoryPreviewInput;
}): Promise<EbayApprovalPreview> {
  const record = await getConfiguredRecord(params.source, params.recordId);
  return buildEbayApprovalPreviewFromFields({
    ...(record.fields as ApprovalFieldMap),
    ...(params.fields ?? {}),
  }, params.bodyPreview, params.categoryPreview);
}