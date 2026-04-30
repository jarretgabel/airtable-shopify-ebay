import { accentActionButtonClass, primaryActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import { errorSurfaceClass, panelSurfaceClass } from '@/components/tabs/uiClasses';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import { AirtableRecord } from '@/types/airtable';

function ListingApprovalQueueSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded-md bg-white/10" />
          <div className="h-6 w-52 animate-pulse rounded-md bg-white/10" />
          <div className="h-4 w-40 animate-pulse rounded-md bg-white/10" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-xl bg-white/10" />
      </div>
      <div className="h-4 w-36 animate-pulse rounded-md bg-white/10" />
      <div className="overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--bg)]">
        <div className="grid grid-cols-4 gap-3 border-b border-[var(--line)] px-4 py-3 max-md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={`header-${index}`} className="h-3 animate-pulse rounded-md bg-white/10" />
          ))}
        </div>
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={`row-${index}`} className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
              {Array.from({ length: 4 }, (_, columnIndex) => (
                <div key={`cell-${index}-${columnIndex}`} className="h-4 animate-pulse rounded-md bg-white/10" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ListingApprovalQueuePanelProps {
  hasTableReference: boolean;
  error: string | null;
  loading: boolean;
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  creatingShopifyListing: boolean;
  saving: boolean;
  tableReference: string;
  tableName?: string;
  records: AirtableRecord[];
  approvedFieldName: string;
  shopifyRequiredFieldNames: string[];
  ebayRequiredFieldNames: string[];
  combinedRequiredFieldNames: string[];
  titleFieldName: string;
  formatFieldName: string;
  priceFieldName: string;
  vendorFieldName: string;
  qtyFieldName: string;
  openRecord: (record: AirtableRecord) => void;
  onSelectRecord: (recordId: string) => void;
  createNewShopifyListing: () => Promise<void>;
  loadRecords: (tableReference: string, tableName?: string, force?: boolean) => Promise<void>;
}

export function ListingApprovalQueuePanel({
  hasTableReference,
  error,
  loading,
  approvalChannel,
  creatingShopifyListing,
  saving,
  tableReference,
  tableName,
  records,
  approvedFieldName,
  shopifyRequiredFieldNames,
  ebayRequiredFieldNames,
  combinedRequiredFieldNames,
  titleFieldName,
  formatFieldName,
  priceFieldName,
  vendorFieldName,
  qtyFieldName,
  openRecord,
  onSelectRecord,
  createNewShopifyListing,
  loadRecords,
}: ListingApprovalQueuePanelProps) {
  return (
    <>
      {!hasTableReference && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Listing approval source is not configured</p>
          <p className="mt-2 text-[var(--error-text)]/85">
            Set the Airtable table reference env variable for this page and refresh.
          </p>
        </section>
      )}

      {error && (
        <section className={errorSurfaceClass}>
          <p className="m-0 font-bold text-[var(--error-text)]">Error loading approval workflow</p>
          <p className="mt-2 text-[var(--error-text)]/85">{error}</p>
        </section>
      )}

      {hasTableReference && loading ? (
        <section className={panelSurfaceClass}>
          <ListingApprovalQueueSkeleton />
        </section>
      ) : hasTableReference ? (
        <section className={panelSurfaceClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow</p>
              <h3 className="m-0 mt-1 text-[1.08rem] font-semibold text-[var(--ink)]">Listing Update & Approval</h3>
              <p className="m-0 mt-1 text-sm text-[var(--muted)]">
                Source: <code>{tableReference}</code>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {approvalChannel === 'shopify' && (
                <button
                  type="button"
                  className={accentActionButtonClass}
                  onClick={() => {
                    void createNewShopifyListing();
                  }}
                  disabled={loading || saving || creatingShopifyListing}
                >
                  {creatingShopifyListing ? 'Creating Listing...' : 'New Shopify Listing'}
                </button>
              )}
              <button
                type="button"
                className={primaryActionButtonClass}
                onClick={() => {
                  trackWorkflowEvent('approval_queue_refreshed', {
                    tableReference,
                  });
                  void loadRecords(tableReference, tableName ?? '', true);
                }}
              >
                Refresh Queue
              </button>
            </div>
          </div>

          <p className="m-0 mb-4 text-sm text-[var(--muted)]">
            <strong>{records.length}</strong> listing rows loaded.
          </p>

          <ApprovalQueueTable
            records={records}
            approvedFieldName={approvedFieldName}
            requiredFieldNames={approvalChannel === 'shopify' ? shopifyRequiredFieldNames : approvalChannel === 'ebay' ? ebayRequiredFieldNames : combinedRequiredFieldNames}
            readinessColumns={approvalChannel === 'combined' ? [
              { key: 'shopify', label: 'Shopify Ready', requiredFieldNames: shopifyRequiredFieldNames },
              { key: 'ebay', label: 'eBay Ready', requiredFieldNames: ebayRequiredFieldNames },
            ] : []}
            titleFieldName={titleFieldName}
            conditionFieldName=""
            formatFieldName={approvalChannel === 'ebay' || approvalChannel === 'combined' ? '' : formatFieldName}
            priceFieldName={approvalChannel === 'shopify' ? '' : priceFieldName}
            vendorFieldName={vendorFieldName}
            qtyFieldName={approvalChannel === 'ebay' ? '' : qtyFieldName}
            openRecord={openRecord}
            onSelectRecord={onSelectRecord}
          />
        </section>
      ) : null}
    </>
  );
}