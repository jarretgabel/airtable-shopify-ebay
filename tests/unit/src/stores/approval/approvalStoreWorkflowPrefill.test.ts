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
      'Testing Notes': 'Passed bench test and listening check. All inputs and outputs working normally.',
      'Internal Cosmetic Notes': 'Light wear on top cover.',
      'Internal Functional Notes': 'All inputs tested and working.',
      'Internal Inclusion Notes': 'Remote and power cable included.',
    }, values, { ...kinds });

    expect(values.Title).toBe('McIntosh MA6900');
    expect(values.Description).toBe('Fresh service completed and ready for listing.');
    expect(values['Key Features']).toBe('');
    expect(values['Testing Notes']).toBe('Passed bench test and listening check. All inputs and outputs working normally.');
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
      'Testing Notes': 'Already reviewed',
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
    expect(values['Testing Notes']).toBe('Already reviewed');
  });

  it('falls back to workflow summary notes when a direct testing field is unavailable', () => {
    const values = {
      'Testing Notes': '',
    };
    const kinds = {
      'Testing Notes': 'text',
    } as const;

    applyWorkflowListingPrefills({
      'Workflow Status': 'Approved for Publish',
      'Internal Functional Notes': 'All inputs tested and working.',
      'Internal Inclusion Notes': 'Remote and power cable included.',
      'Internal Cosmetic Notes': 'Light wear on top cover.',
    }, values, { ...kinds });

    expect(values['Testing Notes']).toBe([
      'Functional Notes: All inputs tested and working.',
      'Includes: Remote and power cable included.',
      'Cosmetic Notes: Light wear on top cover.',
    ].join('\n\n'));
  });

  it('overrides existing listing details and testing notes when testing-form source fields are present', () => {
    const values = {
      'Key Features': 'Legacy,Manual listing copy',
      'Testing Notes': 'Legacy listing notes',
      'eBay Body Key Features JSON': JSON.stringify([{ feature: 'Legacy', value: 'Manual listing copy' }]),
    };
    const kinds = {
      'Key Features': 'text',
      'Testing Notes': 'text',
      'eBay Body Key Features JSON': 'json',
    } as const;

    applyWorkflowListingPrefills({
      'Workflow Status': 'Approved for Publish',
      Make: 'Marantz',
      Model: '2270',
      'Component Type': 'Stereo Receiver',
      'Internal Inclusion Notes': 'Original wood case and power cord included.',
      'Internal Cosmetic Notes': 'Minor veneer wear on the rear-left corner.',
      'Testing Notes': 'Passed extended bench and listening tests.',
    }, values, { ...kinds });

    expect(values['Key Features']).toBe('Legacy,Manual listing copy');
    expect(values['Testing Notes']).toBe('Passed extended bench and listening tests.');
    expect(values['eBay Body Key Features JSON']).toBe(JSON.stringify([
      { feature: 'Make', value: 'Marantz' },
      { feature: 'Model', value: '2270' },
      { feature: 'Component Type', value: 'Stereo Receiver' },
      { feature: 'Cosmetic Notes', value: 'Minor veneer wear on the rear-left corner.' },
      { feature: 'Includes', value: 'Original wood case and power cord included.' },
    ]));
  });

  it('keeps make and model out of shared key features while still preloading the eBay body key-features payload', () => {
    const values = {
      'Key Features': '',
      'eBay Body Key Features JSON': '',
    };
    const kinds = {
      'Key Features': 'text',
      'eBay Body Key Features JSON': 'json',
    } as const;

    applyWorkflowListingPrefills({
      'Workflow Status': 'Approved for Publish',
      Make: 'Marantz',
      Model: '2270',
      'Component Type': 'Stereo Receiver',
      'Internal Cosmetic Notes': 'Minor veneer wear on the rear-left corner.',
      'Internal Inclusion Notes': 'Original wood case and power cord included.',
    }, values, { ...kinds });

    expect(values['Key Features']).not.toContain('Make,Marantz');
    expect(values['Key Features']).not.toContain('Model,2270');
    expect(values['Key Features']).not.toContain('Component Type');
    expect(values['Key Features']).not.toContain('Cosmetic Notes');
    expect(values['Key Features']).not.toContain('Includes');
    expect(values['eBay Body Key Features JSON']).toBe(JSON.stringify([
      { feature: 'Make', value: 'Marantz' },
      { feature: 'Model', value: '2270' },
      { feature: 'Component Type', value: 'Stereo Receiver' },
      { feature: 'Cosmetic Notes', value: 'Minor veneer wear on the rear-left corner.' },
      { feature: 'Includes', value: 'Original wood case and power cord included.' },
    ]));
  });

  it('propagates channel-specific source fields into blank shared combined fields', () => {
    const values = {
      Title: '',
      Description: '',
      'Key Features': '',
      'Key Features JSON': '',
      'Testing Notes': '',
      'Shopify REST Title': 'Accuphase E-405',
      'eBay Inventory Product Description': 'Integrated amplifier with strong phono stage and recent bench verification.',
      'eBay Body Key Features JSON': JSON.stringify([
        { feature: 'Power Output', value: '170W per channel' },
        { feature: 'Inputs', value: 'Phono, CD, tuner, aux' },
      ]),
      'eBay Testing Notes': 'Passed extended listening test. Phono input, tone controls, and speaker outputs verified.',
    };
    const kinds = {
      Title: 'text',
      Description: 'text',
      'Key Features': 'text',
      'Key Features JSON': 'json',
      'Testing Notes': 'text',
      'Shopify REST Title': 'text',
      'eBay Inventory Product Description': 'text',
      'eBay Body Key Features JSON': 'json',
      'eBay Testing Notes': 'text',
    } as const;

    applyWorkflowListingPrefills({
      'Workflow Status': 'Approved for Publish',
      'Shopify REST Title': 'Accuphase E-405',
      'eBay Inventory Product Description': 'Integrated amplifier with strong phono stage and recent bench verification.',
      'eBay Body Key Features JSON': JSON.stringify([
        { feature: 'Power Output', value: '170W per channel' },
        { feature: 'Inputs', value: 'Phono, CD, tuner, aux' },
      ]),
      'eBay Testing Notes': 'Passed extended listening test. Phono input, tone controls, and speaker outputs verified.',
    }, values, { ...kinds });

    expect(values.Title).toBe('Accuphase E-405');
    expect(values.Description).toBe('Integrated amplifier with strong phono stage and recent bench verification.');
    expect(values['Key Features']).toBe([
      'Power Output,170W per channel',
      'Inputs,"Phono, CD, tuner, aux"',
    ].join('\n'));
    expect(values['Key Features JSON']).toBe(JSON.stringify([
      { feature: 'Power Output', value: '170W per channel' },
      { feature: 'Inputs', value: 'Phono, CD, tuner, aux' },
    ]));
    expect(values['Testing Notes']).toBe('Passed extended listening test. Phono input, tone controls, and speaker outputs verified.');
  });

  it('prefills blank listing image fields from workflow attachments', () => {
    const values = {
      Images: '',
      'Images Alt Text': '',
      'Shopify REST Images JSON': '',
    };
    const kinds = {
      Images: 'text',
      'Images Alt Text': 'text',
      'Shopify REST Images JSON': 'text',
    } as const;

    applyWorkflowListingPrefills({
      'Workflow Status': 'Approved for Publish',
      Images: [
        { id: 'att-1', url: 'https://cdn.example.com/workflow-a.jpg', filename: 'workflow-a.jpg' },
        { id: 'att-2', url: 'https://cdn.example.com/workflow-b.jpg', filename: 'workflow-b.jpg' },
      ],
    }, values, { ...kinds });

    expect(values.Images).toBe('https://cdn.example.com/workflow-a.jpg, https://cdn.example.com/workflow-b.jpg');
    expect(values['Images Alt Text']).toBe('');
    expect(values['Shopify REST Images JSON']).toBe(JSON.stringify([
      { src: 'https://cdn.example.com/workflow-a.jpg', alt: '', position: 1 },
      { src: 'https://cdn.example.com/workflow-b.jpg', alt: '', position: 2 },
    ]));
  });

  it('prefills blank listing image fields from workflow image metadata before raw attachments', () => {
    const values = {
      Images: '',
      'Images Alt Text': '',
      'Shopify REST Images JSON': '',
    };
    const kinds = {
      Images: 'text',
      'Images Alt Text': 'text',
      'Shopify REST Images JSON': 'text',
    } as const;

    applyWorkflowListingPrefills({
      'Workflow Status': 'Approved for Publish',
      Images: [
        { id: 'att-1', url: 'https://cdn.example.com/workflow-a.jpg', filename: 'workflow-a.jpg' },
        { id: 'att-2', url: 'https://cdn.example.com/workflow-b.jpg', filename: 'workflow-b.jpg' },
      ],
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-2',
          url: 'https://cdn.example.com/workflow-b.jpg',
          filename: 'workflow-b.jpg',
          alt: 'Rear panel',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
        {
          attachmentId: 'att-1',
          url: 'https://cdn.example.com/workflow-a.jpg',
          filename: 'workflow-a.jpg',
          alt: 'Front panel',
          sortOrder: 2,
          sourceStage: 'photos',
          includedInListing: true,
        },
      ]),
    }, values, { ...kinds });

    expect(values.Images).toBe('https://cdn.example.com/workflow-b.jpg, https://cdn.example.com/workflow-a.jpg');
    expect(values['Images Alt Text']).toBe('Rear panel, Front panel');
    expect(values['Shopify REST Images JSON']).toBe(JSON.stringify([
      { src: 'https://cdn.example.com/workflow-b.jpg', alt: 'Rear panel', position: 1 },
      { src: 'https://cdn.example.com/workflow-a.jpg', alt: 'Front panel', position: 2 },
    ]));
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