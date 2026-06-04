import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useListingApprovalCombinedFieldState } from '@/components/approval/useListingApprovalCombinedFieldState';
import type { AirtableRecord } from '@/types/airtable';

vi.mock('@/components/approval/useListingApprovalCombinedFieldSync', () => ({
  useListingApprovalCombinedFieldSync: vi.fn(),
}));

function buildRecord(fields: Record<string, unknown>): AirtableRecord {
  return {
    id: 'rec-combined-test',
    createdTime: '2026-05-11T00:00:00.000Z',
    fields,
  };
}

function renderCombinedFieldState(record: AirtableRecord) {
  return renderHook(() => useListingApprovalCombinedFieldState({
    records: [record],
    selectedRecordId: record.id,
    allFieldNames: Object.keys(record.fields),
    approvalChannel: 'combined',
    isCombinedApproval: true,
    formValues: Object.fromEntries(Object.keys(record.fields).map((fieldName) => [fieldName, String(record.fields[fieldName] ?? '')])),
    setFormValue: vi.fn(),
    setDerivedFormValue: vi.fn(),
    selectedEbayTemplateId: 'classic',
    setSelectedEbayTemplateId: vi.fn(),
  }));
}

function renderCombinedFieldStateWithFormValues(record: AirtableRecord, formValues: Record<string, string>) {
  return renderHook(() => useListingApprovalCombinedFieldState({
    records: [record],
    selectedRecordId: record.id,
    allFieldNames: Object.keys(record.fields),
    approvalChannel: 'combined',
    isCombinedApproval: true,
    formValues,
    setFormValue: vi.fn(),
    setDerivedFormValue: vi.fn(),
    selectedEbayTemplateId: 'classic',
    setSelectedEbayTemplateId: vi.fn(),
  }));
}

describe('useListingApprovalCombinedFieldState', () => {
  it('prefers a real testing notes field when present', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      'Key Features': 'Make,Sansui',
      'eBay Testing Notes': 'Passed extended listening test.',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedEbayTestingNotesFieldName).toBe('eBay Testing Notes');
  });

  it('does not fall back to key-features fields when no testing notes field exists', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      'Key Features': 'Make,Sansui',
      'eBay Body Key Features JSON': JSON.stringify([{ feature: 'Make', value: 'Sansui' }]),
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedEbayTestingNotesFieldName).toBe('');
  });

  it('filters workflow-only and system-managed fields out of combined listing forms', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      SKU: 'SANSUI-717',
      Make: 'Sansui',
      Model: 'AU-717',
      'Accepted At': '2026-05-06T14:00:00.000Z',
      'Workflow Status': 'Testing In Progress',
      'Qualification Notes': 'Waiting on testing signoff only.',
      'Submission Group ID': 'sample-workflow-group-06',
      'Offer Amount': 950,
      'Paid Amount': 525,
      'Acquired From': 'Walk-in seller',
      'Arrival Date': '2026-05-06',
      Cost: 525,
      'Inventory Notes': 'Fresh service notes for intake only.',
      'Internal Cosmetic Notes': 'Scuffs on the left side panel.',
      'Internal Functional Notes': 'Bias adjusted during bench check.',
      'Internal Inclusion Notes': 'Remote stored separately.',
      'Approved At': '2026-05-07T10:00:00.000Z',
      'Approved By': 'Taylor Reviewer',
      'Photographed At': '2026-05-07T09:00:00.000Z',
      'Photographed By': 'Phoebe Photographer',
      'eBay Offer ID': 'offer-123',
      'eBay Listing ID': 'listing-123',
      'Shopify Price': '3499.99',
      Categories: '3276',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedSharedFieldNames).toEqual(expect.arrayContaining(['Title', 'SKU', 'Make', 'Model']));
    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining([
      'Accepted At',
      'Workflow Status',
      'Qualification Notes',
      'Submission Group ID',
      'Offer Amount',
      'Paid Amount',
      'Acquired From',
      'Arrival Date',
      'Cost',
      'Inventory Notes',
      'Internal Cosmetic Notes',
      'Internal Functional Notes',
      'Internal Inclusion Notes',
      'Approved At',
      'Approved By',
      'Photographed At',
      'Photographed By',
      'eBay Offer ID',
      'eBay Listing ID',
    ]));
    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining(['eBay Offer ID', 'eBay Listing ID']));
  });

  it('discovers hydrated make and model fields from form values even when the selected queue record is stale', () => {
    const record = buildRecord({
      Title: 'Marantz 2270',
      Description: 'Receiver ready for listing.',
      'Key Features': 'Component Type,Stereo Receiver',
      'Testing Notes': 'Bench tested.',
    });

    const { result } = renderCombinedFieldStateWithFormValues(record, {
      Title: 'Marantz 2270',
      Description: 'Receiver ready for listing.',
      Make: 'Marantz',
      Model: '2270',
      'Key Features': 'Component Type,Stereo Receiver',
      'Testing Notes': 'Bench tested.',
    });

    expect(result.current.combinedMakeFieldName).toBe('Make');
    expect(result.current.combinedModelFieldName).toBe('Model');
    expect(result.current.combinedSharedFieldNames).toEqual(expect.arrayContaining(['Make', 'Model']));
  });

  it('routes Shopify tags into Shopify-only fields and keeps Testing Notes out of the combined eBay-only group', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      Tags: 'Vintage Audio,Integrated Amplifier',
      'Testing Notes': 'Passed bench test.',
      Vendor: 'Sansui',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedShopifyOnlyFieldNames).toEqual(expect.arrayContaining(['Tags']));
    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining(['Testing Notes']));
    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining(['Tags']));
  });

  it('keeps photo date workflow fields out of listing sections', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      "Photo'd": '2026-05-08',
      'Photographed At': '2026-05-08T12:00:00.000Z',
      'Photographed By': 'Phoebe Photographer',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining(["Photo'd", 'Photographed At', 'Photographed By']));
    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining(["Photo'd"]));
    expect(result.current.combinedShopifyOnlyFieldNames).not.toEqual(expect.arrayContaining(["Photo'd"]));
  });

  it('routes eBay shipping fee fields into the eBay section', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      'Domestic Shipping Fees': '25.00',
      'International Shipping Fees': '95.00',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedEbayOnlyFieldNames).toEqual(expect.arrayContaining([
      'Domestic Shipping Fees',
      'International Shipping Fees',
    ]));
    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining([
      'Domestic Shipping Fees',
      'International Shipping Fees',
    ]));
  });

  it('keeps the derived shipping method out of shared fields and in the eBay section', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      '__Shipping Services__': 'FedEx Ground',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining(['__Shipping Services__']));
    expect(result.current.combinedEbayOnlyFieldNames).toEqual(expect.arrayContaining(['__Shipping Services__']));
  });

  it('removes shipping method from combined listing record sections', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      'Shipping Method': 'Freight',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining(['Shipping Method']));
    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining(['Shipping Method']));
    expect(result.current.combinedShopifyOnlyFieldNames).not.toEqual(expect.arrayContaining(['Shipping Method']));
  });

  it('removes Shopify variant barcode from combined listing record sections', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      'Shopify Variant Barcode': 'SANSUI-717',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining(['Shopify Variant Barcode']));
    expect(result.current.combinedShopifyOnlyFieldNames).not.toEqual(expect.arrayContaining(['Shopify Variant Barcode']));
    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining(['Shopify Variant Barcode']));
  });

  it('keeps Status out of the eBay-specific field list', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      Status: 'Listed',
      Categories: '3276',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining(['Status']));
    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining(['Status']));
  });

  it('removes non-listing workflow metadata fields from combined listing record sections', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      'Additional Items': 'Power cable and shelf card',
      'Customer Cosmetic Notes': 'Customer reported light wear.',
      'Customer Functional Notes': 'Customer said both channels worked.',
      'Customer Inclusion Notes': 'Original accessories included.',
      'Service Notes': 'Controls cleaned and switches exercised.',
      Tested: '2026-05-14',
      'Testing Time': '5400',
      'Service Time': '1800',
      'Unqualified Reason': 'Missing serial plate',
      Price: '1899.99',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining([
      'Additional Items',
      'Customer Cosmetic Notes',
      'Customer Functional Notes',
      'Customer Inclusion Notes',
      'Service Notes',
      'Tested',
      'Testing Time',
      'Service Time',
      'Unqualified Reason',
    ]));
    expect(result.current.combinedShopifyOnlyFieldNames).not.toEqual(expect.arrayContaining([
      'Additional Items',
      'Customer Cosmetic Notes',
      'Customer Functional Notes',
      'Customer Inclusion Notes',
      'Service Notes',
      'Tested',
      'Testing Time',
      'Service Time',
      'Unqualified Reason',
    ]));
    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining([
      'Additional Items',
      'Customer Cosmetic Notes',
      'Customer Functional Notes',
      'Customer Inclusion Notes',
      'Service Notes',
      'Tested',
      'Testing Time',
      'Service Time',
      'Unqualified Reason',
    ]));
  });

  it('removes eBay product aspects fields from combined listing record sections', () => {
    const record = buildRecord({
      Title: 'Sansui AU-717',
      Description: 'Integrated amp ready for listing.',
      'eBay Inventory Product Aspects JSON': '{"Brand":["Sansui"]}',
      Categories: '3276',
    });

    const { result } = renderCombinedFieldState(record);

    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining([
      'eBay Inventory Product Aspects JSON',
    ]));
    expect(result.current.combinedSharedFieldNames).not.toEqual(expect.arrayContaining([
      'eBay Inventory Product Aspects JSON',
    ]));
  });
});