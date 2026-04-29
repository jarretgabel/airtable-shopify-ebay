interface InlineActionNotice {
  id: string;
  message: string;
  title: string;
  tone: 'success' | 'warning' | 'error' | 'info';
}

interface ListingApprovalRecordAlertsProps {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
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
  return (
    <>
      {hasUnsavedChanges && (
        <section className="mt-4 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2">
          <p className="m-0 text-sm font-semibold text-amber-200">
            Fields changed ({changedFieldNames.length}). Save page data before approving.
          </p>
          <p className="m-0 mt-1 text-xs text-amber-200/85">
            {changedFieldNames.join(', ')}
          </p>
        </section>
      )}

      {(approvalChannel === 'shopify' || approvalChannel === 'combined') && hasMissingShopifyRequiredFields && (
        <section className="mt-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2">
          <p className="m-0 text-sm font-semibold text-rose-200">
            Shopify required fields are missing ({missingShopifyRequiredFieldNames.length}).
          </p>
          <p className="m-0 mt-1 text-xs text-rose-200/85">
            Complete before approving: {missingShopifyRequiredFieldLabels.join(', ')}
          </p>
        </section>
      )}

      {(approvalChannel === 'ebay' || approvalChannel === 'combined') && hasMissingEbayRequiredFields && (
        <section className="mt-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2">
          <p className="m-0 text-sm font-semibold text-rose-200">
            eBay required fields are missing ({missingEbayRequiredFieldNames.length}).
          </p>
          <p className="m-0 mt-1 text-xs text-rose-200/85">
            Complete before approving: {missingEbayRequiredFieldLabels.join(', ')}
          </p>
        </section>
      )}

      {inlineActionNotices.length > 0 && (
        <div className="mt-3 space-y-2">
          {inlineActionNotices.map((notice) => (
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