import { describe, expect, it } from 'vitest';
import { applyWorkflowListingPrefills } from '@/stores/approval/approvalStoreWorkflowPrefill';

describe('applyWorkflowListingPrefills', () => {
  it('prefills blank listing fields from workflow fields', () => {
    const values = {
      Title: '',
      Description: '',
      'Key Features': '',
      'Testing Notes': '',
      'eBay Body Key Features JSON': '',
    };
    const kinds = {
      Title: 'text',
      Description: 'text',
      'Key Features': 'text',
      'Testing Notes': 'text',
      'eBay Body Key Features JSON': 'text',
    } as const;

    applyWorkflowListingPrefills({
      'Workflow Status': 'Approved for Publish',
      Make: 'McIntosh',
      Model: 'MA6900',
      'Component Type': 'Integrated Amplifier',
      'Inventory Notes': 'Fresh service completed and ready for listing.',
      'Internal Cosmetic Notes': 'Light wear on top cover.',
      'Internal Functional Notes': 'All inputs tested and working.',
      'Internal Inclusion Notes': 'Remote and power cable included.',
    }, values, { ...kinds });

    expect(values.Title).toBe('McIntosh MA6900');
    expect(values.Description).toBe('Fresh service completed and ready for listing.');
    expect(values['Key Features']).toBe([
      'Make,McIntosh',
      'Model,MA6900',
      'Component Type,Integrated Amplifier',
      'Cosmetic Notes,Light wear on top cover.',
      'Includes,Remote and power cable included.',
    ].join('\n'));
    expect(values['Testing Notes']).toBe([
      'Functional Notes,All inputs tested and working.',
      'Includes,Remote and power cable included.',
      'Cosmetic Notes,Light wear on top cover.',
    ].join('\n'));
    expect(values['eBay Body Key Features JSON']).toBe(JSON.stringify([
      { feature: 'Make', value: 'McIntosh' },
      { feature: 'Model', value: 'MA6900' },
      { feature: 'Component Type', value: 'Integrated Amplifier' },
      { feature: 'Cosmetic Notes', value: 'Light wear on top cover.' },
      { feature: 'Includes', value: 'Remote and power cable included.' },
    ]));
  });

  it('propagates an existing title into blank title variants without overriding populated fields', () => {
    const values = {
      Title: '',
      'Shopify REST Title': 'Sansui AU-919',
      Description: 'Existing description',
      'Testing Notes': 'Functional Notes,Already reviewed',
    };
    const kinds = {
      Title: 'text',
      'Shopify REST Title': 'text',
      Description: 'text',
      'Testing Notes': 'text',
    } as const;

    applyWorkflowListingPrefills({
      'Workflow Status': 'Approved for Publish',
      Make: 'Sansui',
      Model: 'AU-919',
      'Inventory Notes': 'Should not replace existing description.',
      'Internal Functional Notes': 'Should not replace existing testing notes.',
    }, values, { ...kinds });

    expect(values.Title).toBe('Sansui AU-919');
    expect(values['Shopify REST Title']).toBe('Sansui AU-919');
    expect(values.Description).toBe('Existing description');
    expect(values['Testing Notes']).toBe('Functional Notes,Already reviewed');
  });

  it('does nothing when the record has no workflow context', () => {
    const values = {
      Title: '',
      Description: '',
    };
    const kinds = {
      Title: 'text',
      Description: 'text',
    } as const;

    applyWorkflowListingPrefills({ SKU: 'SKU-1' }, values, { ...kinds });

    expect(values).toEqual({
      Title: '',
      Description: '',
    });
  });
});