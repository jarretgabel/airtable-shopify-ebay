import { accentActionButtonClass, primaryActionButtonClass } from '@/components/app/buttonStyles';
import { ApprovalQueueTable } from '@/components/approval/ApprovalQueueTable';
import { errorSurfaceClass, loadingSurfaceClass, panelSurfaceClass, spinnerClass } from '@/components/tabs/uiClasses';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import { AirtableRecord } from '@/types/airtable';

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
  loadRecords: (tableReference: string, tableName: string) => Promise<void>;
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
        <section className={loadingSurfaceClass}>
          <div className={spinnerClass} />
          <p>Loading listing approval queue...</p>
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
                  void loadRecords(tableReference, tableName ?? '');
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