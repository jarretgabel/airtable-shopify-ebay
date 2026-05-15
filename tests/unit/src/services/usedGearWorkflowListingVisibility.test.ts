import { describe, expect, it } from 'vitest';
import {
  buildUsedGearWorkflowListingSkuSet,
  getUsedGearWorkflowListingSku,
  isUsedGearWorkflowListingSurfaceEligible,
} from '@/services/usedGearWorkflowListingVisibility';
import type { AirtableRecord } from '@/types/airtable';

function buildRecord(id: string, fields: Record<string, unknown>): AirtableRecord {
  return {
    id,
    createdTime: '2026-05-07T00:00:00.000Z',
    fields,
  };
}

describe('usedGearWorkflowListingVisibility', () => {
  it('requires a listing workflow status at or beyond approved for publish', () => {
    expect(isUsedGearWorkflowListingSurfaceEligible(buildRecord('rec-1', {
      SKU: 'SKU-1',
      'Workflow Status': 'Awaiting Pre-Listing Review',
      Price: '1000',
    }))).toBe(false);

    expect(isUsedGearWorkflowListingSurfaceEligible(buildRecord('rec-2', {
      SKU: 'SKU-2',
      'Workflow Status': 'Approved for Publish',
      Price: '1000',
    }))).toBe(true);
  });

  it('requires listing readiness blockers to be cleared', () => {
    expect(isUsedGearWorkflowListingSurfaceEligible(buildRecord('rec-3', {
      SKU: 'SKU-3',
      'Workflow Status': 'Listed, Shopify',
    }))).toBe(false);
  });

  it('collects eligible SKUs from workflow rows', () => {
    const skuSet = buildUsedGearWorkflowListingSkuSet([
      buildRecord('rec-4', {
        SKU: 'VISIBLE-SKU',
        'Workflow Status': 'Listed, eBay',
        Price: '1299',
      }),
      buildRecord('rec-5', {
        SKU: 'HIDDEN-SKU',
        'Workflow Status': 'Pending Review',
        Price: '899',
      }),
    ]);

    expect(Array.from(skuSet)).toEqual(['VISIBLE-SKU']);
  });

  it('resolves SKU values from common workflow field variants', () => {
    expect(getUsedGearWorkflowListingSku(buildRecord('rec-6', {
      'eBay Inventory SKU': 'EBAY-SKU',
    }))).toBe('EBAY-SKU');
  });
});