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
      'Workflow Status': 'Testing and Photography In Progress',
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
      'SKU Legacy Backup': 'SANSUI-717-BACKUP',
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
      'SKU Legacy Backup',
      'Approved At',
      'Approved By',
      'Photographed At',
      'Photographed By',
      'eBay Offer ID',
      'eBay Listing ID',
    ]));
    expect(result.current.combinedEbayOnlyFieldNames).not.toEqual(expect.arrayContaining(['eBay Offer ID', 'eBay Listing ID']));
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
});