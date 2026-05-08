import { describe, expect, it } from 'vitest';
import { assertUsedGearWorkflowReadyForPublish, getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import type { AirtableRecord } from '@/types/airtable';

function buildRecord(fields: Record<string, unknown>): AirtableRecord {
  return {
    id: 'rec-readiness-1',
    createdTime: '2026-05-07T00:00:00.000Z',
    fields,
  };
}

describe('usedGearWorkflowListingReadiness', () => {
  it('derives title and description while preserving explicit price fields', () => {
    const readiness = getUsedGearWorkflowListingReadiness(buildRecord({
      Make: 'Luxman',
      Model: 'L-550AXII',
      'Component Type': 'Integrated Amplifier',
      'Inventory Notes': 'Fresh bench check completed.',
      Price: '4299.00',
    }));

    expect(readiness.title).toBe('Luxman L-550AXII');
    expect(readiness.titleFieldName).toBeNull();
    expect(readiness.description).toBe('Fresh bench check completed.');
    expect(readiness.price).toBe('4299.00');
    expect(readiness.priceFieldName).toBe('Price');
    expect(readiness.missingRequirements).toEqual([]);
  });

  it('blocks publish readiness when no listing price is present', () => {
    const record = buildRecord({
      Make: 'Nakamichi',
      Model: 'RX-505',
      'Inventory Notes': 'Needs pricing review.',
    });

    expect(getUsedGearWorkflowListingReadiness(record).missingRequirements).toEqual([
      'Capture a listing price before approving the row for publish.',
    ]);

    expect(() => assertUsedGearWorkflowReadyForPublish(record)).toThrow(
      'Capture a listing price before approving the row for publish.',
    );
  });
});