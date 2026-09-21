interface InlineActionNotice {
  id: string;
  message: string;
  title: string;
  tone: 'success' | 'warning' | 'error' | 'info';
}

interface ListingApprovalRecordAlertsProps {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  workflowStatus?: string | null;
  workflowReadinessMissingRequirements?: string[];
  hasUnsavedChanges: boolean;
  changedFieldNames: string[];
  hasMissingShopifyRequiredFields: boolean;
  missingShopifyRequiredFieldNames: string[];
  missingShopifyRequiredFieldLabels: string[];
  hasMissingEbayRequiredFields: boolean;
  missingEbayRequiredFieldNames: string[];
  missingEbayRequiredFieldLabels: string[];
  inlineActionNotices: InlineActionNotice[];
  fadingInlineNoticeIds: string[];
}

export function ListingApprovalRecordAlerts({
  approvalChannel,
  workflowStatus,
  workflowReadinessMissingRequirements = [],
  hasUnsavedChanges,
  changedFieldNames,
  hasMissingShopifyRequiredFields,
  missingShopifyRequiredFieldNames,
  missingShopifyRequiredFieldLabels,
  hasMissingEbayRequiredFields,
  missingEbayRequiredFieldNames,
  missingEbayRequiredFieldLabels,
  inlineActionNotices,
  fadingInlineNoticeIds,
}: ListingApprovalRecordAlertsProps) {
  const isWorkflowListingReview = approvalChannel === 'combined' && workflowStatus === 'Awaiting Pre-Listing Review';
  const shopifyMissingCount = missingShopifyRequiredFieldNames.length;
  const ebayMissingCount = missingEbayRequiredFieldNames.length;
  const blockerMessages: string[] = [
    ...workflowReadinessMissingRequirements,
    ...((approvalChannel === 'shopify' || approvalChannel === 'combined') && hasMissingShopifyRequiredFields
      ? [`Shopify required (${shopifyMissingCount}): ${missingShopifyRequiredFieldLabels.join(', ')}`]
      : []),
    ...((approvalChannel === 'ebay' || approvalChannel === 'combined') && hasMissingEbayRequiredFields
      ? [`eBay required (${ebayMissingCount}): ${missingEbayRequiredFieldLabels.join(', ')}`]
      : []),
  ].filter((entry) => entry.trim().length > 0);

  const hasActionBlockers = blockerMessages.length > 0;
  const changedFieldPreview = changedFieldNames.slice(0, 6);
  const changedFieldRemainderCount = Math.max(changedFieldNames.length - changedFieldPreview.length, 0);
  const sortedInlineActionNotices = [...inlineActionNotices].sort((left, right) => {
    const toneWeight = (tone: InlineActionNotice['tone']) => {
      switch (tone) {
        case 'error': return 0;
        case 'warning': return 1;
        case 'info': return 2;
        case 'success': return 3;
        default: return 4;
      }
    };

    return toneWeight(left.tone) - toneWeight(right.tone);
  });

  return (
    <>
      {isWorkflowListingReview && workflowReadinessMissingRequirements.length === 0 && (
        <section className="mt-4 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2">
          <p className="m-0 text-sm font-semibold text-sky-200">
            Listing review is in progress.
          </p>
          <p className="m-0 mt-1 text-xs text-sky-200/85">
            Confirm pricing, content, and marketplace readiness here, then approve the row for publish.
          </p>
        </section>
      )}

      {isWorkflowListingReview && hasActionBlockers && (
        <section className="mt-4 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2">
          <p className="m-0 text-sm font-semibold text-amber-200">
            Resolve action blockers before approving for publish.
          </p>
          <ul className="m-0 mt-1 list-disc space-y-1 pl-5 text-xs text-amber-200/85">
            {blockerMessages.map((message, index) => (
              <li key={`blocker-${index}`}>{message}</li>
            ))}
          </ul>
        </section>
      )}

      {!isWorkflowListingReview && hasActionBlockers && (
        <section className="mt-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2">
          <p className="m-0 text-sm font-semibold text-rose-200">
            Required fields are missing.
          </p>
          <ul className="m-0 mt-1 list-disc space-y-1 pl-5 text-xs text-rose-200/85">
            {blockerMessages.map((message, index) => (
              <li key={`required-${index}`}>{message}</li>
            ))}
          </ul>
        </section>
      )}

      {hasUnsavedChanges && (
        <section className="mt-4 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2">
          <p className="m-0 text-sm font-semibold text-sky-200">
            Unsaved changes ({changedFieldNames.length}). Save updates before approving.
          </p>
          <p className="m-0 mt-1 text-xs text-sky-200/85">
            {changedFieldPreview.join(', ')}
            {changedFieldRemainderCount > 0 ? `, +${changedFieldRemainderCount} more` : ''}
          </p>
        </section>
      )}

      {inlineActionNotices.length > 0 && (
        <div className="mt-3 space-y-2">
          {sortedInlineActionNotices.map((notice) => (
            <section
              key={notice.id}
              className={`rounded-lg border px-3 py-2 transition-opacity duration-300 ${
                fadingInlineNoticeIds.includes(notice.id) ? 'opacity-0' : 'opacity-100'
              } ${
                notice.tone === 'success'
                  ? 'border-emerald-400/35 bg-emerald-500/10'
                  : notice.tone === 'warning'
                    ? 'border-amber-400/35 bg-amber-500/10'
                    : notice.tone === 'error'
                      ? 'border-rose-400/35 bg-rose-500/10'
                      : 'border-sky-400/35 bg-sky-500/10'
              }`}
            >
              <p
                className={`m-0 text-sm font-semibold ${
                  notice.tone === 'success'
                    ? 'text-emerald-200'
                    : notice.tone === 'warning'
                      ? 'text-amber-200'
                      : notice.tone === 'error'
                        ? 'text-rose-200'
                        : 'text-sky-200'
                }`}
              >
                {notice.title}
              </p>
              <p
                className={`m-0 mt-1 text-xs ${
                  notice.tone === 'success'
                    ? 'text-emerald-200/90'
                    : notice.tone === 'warning'
                      ? 'text-amber-200/90'
                      : notice.tone === 'error'
                        ? 'text-rose-200/90'
                        : 'text-sky-200/90'
                }`}
              >
                {notice.message}
              </p>
            </section>
          ))}
        </div>
      )}
    </>
  );
}