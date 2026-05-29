import { describe, expect, it } from 'vitest';
import {
  getParkingLotEffectiveStatus,
  getParkingLotStatusLabel,
} from '@/components/tabs/airtable/usedGearParkingLotPresentation';

describe('usedGearParkingLotPresentation', () => {
  it('derives an arrival-stage status from accepted markers when workflow status is stale', () => {
    const record = {
      id: 'rec-stale-accepted',
      createdTime: '2026-05-10T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Pending Review',
        'Qualification Complete': true,
        'Accepted At': '2026-05-10T10:00:00.000Z',
        'Accepted By': 'Taylor Reviewer',
        'Arrival Date': '2026-05-10',
      },
    };

    expect(getParkingLotEffectiveStatus(record)).toBe('Accepted - Arrived, Awaiting SKU');
    expect(getParkingLotStatusLabel(record)).toBe('Awaiting SKU');
  });
});