import { useEffect, useState } from 'react';
import { getConfiguredRecords } from '@/services/app-api/airtable';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { extractReadableValue } from '@/utils/valueDisplay';

const IN_STORE_STATUSES = new Set([
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
  'Sold - Ready to Ship',
]);

/** SKUs of used-gear items that are live or just sold, so the Shopify page can show the products that belong to the workflow. */
export function useUsedGearWorkflowListedSkus(enabled: boolean): ReadonlySet<string> {
  const [skus, setSkus] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getConfiguredRecords('used-gear-workflow', { subset: 'post-publish', fields: ['Workflow Status', 'SKU'] })
      .then((records) => {
        if (cancelled) return;
        const next = new Set<string>();
        for (const record of records) {
          const status = getUsedGearWorkflowStatus(record.fields);
          const sku = extractReadableValue(record.fields.SKU);
          if (status && IN_STORE_STATUSES.has(status) && sku) next.add(sku.trim());
        }
        setSkus(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return skus;
}
