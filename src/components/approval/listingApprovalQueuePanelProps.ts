import type { ComponentProps } from 'react';
import { ListingApprovalQueuePanel } from '@/components/approval/ListingApprovalQueuePanel';
import type { AirtableRecord } from '@/types/airtable';

type ListingApprovalQueuePanelProps = ComponentProps<typeof ListingApprovalQueuePanel>;

interface BuildListingApprovalQueuePanelPropsParams {
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

export function buildListingApprovalQueuePanelProps({
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
}: BuildListingApprovalQueuePanelPropsParams) {
  return {
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
  } satisfies ListingApprovalQueuePanelProps;
}