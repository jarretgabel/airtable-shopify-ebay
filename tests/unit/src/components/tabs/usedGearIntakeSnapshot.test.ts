import { describe, expect, it } from 'vitest';
import { buildUsedGearIntakeSnapshot } from '@/components/tabs/usedGearIntakeSnapshot';

describe('buildUsedGearIntakeSnapshot', () => {
  it('adds Cost as the first intake snapshot field', () => {
    const snapshot = buildUsedGearIntakeSnapshot({
      id: 'rec-intake-cost',
      createdTime: '2026-05-18T00:00:00.000Z',
      fields: {
        Cost: 1499.5,
        SKU: 'MC275',
      },
    });

    expect(snapshot.fields[0]).toEqual({ label: 'Cost', value: '1499.5' });
  });

  it('adds Includes to the top intake details fields using customer notes first', () => {
    const snapshot = buildUsedGearIntakeSnapshot({
      id: 'rec-intake',
      createdTime: '2026-05-18T00:00:00.000Z',
      fields: {
        SKU: 'MC275',
        Make: 'McIntosh',
        Model: 'MC275',
        'Component Type': 'Amplifier',
        'Customer Inclusion Notes': 'Original box and manual',
        'Internal Inclusion Notes': 'Power cable only',
      },
    });

    expect(snapshot.fields).toEqual(expect.arrayContaining([
      { label: 'Includes', value: 'Original box and manual' },
    ]));
  });

  it('falls back to internal inclusion notes when customer notes are blank', () => {
    const snapshot = buildUsedGearIntakeSnapshot({
      id: 'rec-intake-fallback',
      createdTime: '2026-05-18T00:00:00.000Z',
      fields: {
        'Customer Inclusion Notes': '',
        'Internal Inclusion Notes': 'Remote and power cable',
      },
    });

    expect(snapshot.fields).toEqual(expect.arrayContaining([
      { label: 'Includes', value: 'Remote and power cable' },
    ]));
  });
});