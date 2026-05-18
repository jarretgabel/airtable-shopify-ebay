export const COMBINED_RECORD_SECTION_ITEMS = [
  { key: 'intake', id: 'combined-record-intake-details', label: 'Intake Details' },
  { key: 'shared', id: 'combined-record-shared-fields', label: 'Shared' },
  { key: 'shopify', id: 'combined-record-shopify-fields', label: 'Shopify' },
  { key: 'ebay', id: 'combined-record-ebay-fields', label: 'eBay' },
] as const;

export type CombinedRecordSectionKey = typeof COMBINED_RECORD_SECTION_ITEMS[number]['key'];