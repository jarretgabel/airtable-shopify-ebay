import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteConfiguredRecord, getConfiguredRecord, getConfiguredRecords, updateConfiguredRecord } from '@/services/app-api/airtable';
import {
  acceptPendingReviewRecord,
  acceptPendingReviewGroup,
  assignWorkflowOwner,
  assignWorkflowOwnerBatch,
  clearWorkflowOwner,
  completePreListingReviewStage,
  completeProcessingStage,
  distributeUsedGearPendingReviewTotal,
  groupUsedGearWorkflowRecords,
  hasUsedGearPendingReviewPricingPath,
  loadParkingLotArrivalGroup,
  loadParkingLotArrivalQueue,
  loadUsedGearOperationalRecordBySku,
  loadWorkflowPostPublishQueue,
  loadTrashQueue,
  loadUsedGearWorkflowNotificationCounts,
  loadUsedGearWorkflowNotificationSummary,
  loadUsedGearOperationalRecord,
  loadUsedGearOperationalRecordContext,
  loadWorkflowProgressQueue,
  loadPendingReviewQueue,
  loadPendingReviewGroup,
  markWorkflowRelisted,
  markWorkflowListingStale,
  markWorkflowRowsShipped,
  markWorkflowRowsSoldReadyToShip,
  markPendingReviewUnqualified,
  markPendingReviewGroupUnqualified,
  saveWorkflowStaleRecovery,
  saveWorkflowShipmentFollowThrough,
  markWorkflowShipped,
  markWorkflowSoldReadyToShip,
  permanentlyDeleteTrashRecord,
  requalifyTrashRecord,
  restoreTrashRecord,
  saveParkingLotArrivalReviewRecord,
  savePendingReviewRecordReview,
  savePendingReviewGroupReview,
  saveUsedGearWorkflowStageSignoff,
  summarizeUsedGearWorkflowPostPublishQueue,
} from '@/services/usedGearQueue';

vi.mock('@/services/app-api/airtable', () => ({
  deleteConfiguredRecord: vi.fn(),
  getConfiguredRecord: vi.fn(),
  getConfiguredRecords: vi.fn(),
  updateConfiguredRecord: vi.fn(),
}));

const mockDeleteConfiguredRecord = vi.mocked(deleteConfiguredRecord);
const mockGetConfiguredRecord = vi.mocked(getConfiguredRecord);
const mockGetConfiguredRecords = vi.mocked(getConfiguredRecords);
const mockUpdateConfiguredRecord = vi.mocked(updateConfiguredRecord);

describe('usedGearQueue', () => {
  beforeEach(() => {
    mockDeleteConfiguredRecord.mockReset();
    mockGetConfiguredRecord.mockReset();
    mockGetConfiguredRecords.mockReset();
    mockUpdateConfiguredRecord.mockReset();
  });

  it('splits a confirmed grand total evenly with cent-safe remainder handling', () => {
    expect(distributeUsedGearPendingReviewTotal(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it('detects when any approved pricing path is present', () => {
    expect(hasUsedGearPendingReviewPricingPath({ 'Offer Amount': 100 })).toBe(true);
    expect(hasUsedGearPendingReviewPricingPath({ 'Paid Amount': '125.50' })).toBe(true);
    expect(hasUsedGearPendingReviewPricingPath({ 'Confirmed Grand Total': 400 })).toBe(true);
    expect(hasUsedGearPendingReviewPricingPath({})).toBe(false);
  });

  it('loads only pending-review records from the workflow source', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recPending',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Pending Review', SKU: 'P-1' },
      },
      {
        id: 'recAccepted',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', SKU: 'A-1' },
      },
    ]);

    const records = await loadPendingReviewQueue();

    expect(mockGetConfiguredRecords).toHaveBeenCalledWith('used-gear-workflow', expect.objectContaining({ fields: expect.any(Array) }));
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('recPending');
    expect(records[0]?.fields['Workflow Intake Decision']).toBe('Pending');
  });

  it('loads only active trash rows from the workflow source', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recTrash',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Active Trash',
          SKU: 'T-1',
        },
      },
      {
        id: 'recIgnored',
        createdTime: 'later',
        fields: {
          'Workflow Status': 'Unqualified',
          'Trash Status': 'Restored',
          SKU: 'T-2',
        },
      },
    ]);

    const records = await loadTrashQueue();

    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('recTrash');
    expect(records[0]?.fields['Workflow Intake Decision']).toBe('Unqualified');
  });

  it('loads workflow progress records only for accepted and active specialist statuses', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recAccepted',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', SKU: 'A-1' },
      },
      {
        id: 'recConcurrent',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Testing In Progress', SKU: 'B-1' },
      },
      {
        id: 'recIgnored',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Pending Review', SKU: 'C-1' },
      },
    ]);

    const records = await loadWorkflowProgressQueue();

    expect(mockGetConfiguredRecords).toHaveBeenCalledWith(
      'used-gear-workflow',
      expect.objectContaining({
        fields: expect.not.arrayContaining([
          'Shipment Follow-Through Notes',
          'Shipment Follow-Through Updated At',
        ]),
      }),
    );
    expect(records.map((record) => record.id)).toEqual(['recAccepted', 'recConcurrent']);
  });

  it('loads only Parking Lot arrival-stage records from the workflow source', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recAwaitingArrival',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', SKU: 'A-1' },
      },
      {
        id: 'recAwaitingSku',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Accepted - Arrived, Awaiting SKU', SKU: 'A-2' },
      },
      {
        id: 'recAwaitingMissingItem',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Accepted - Arrived, Awaiting Missing Item', SKU: 'A-3' },
      },
      {
        id: 'recIgnored',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Testing In Progress', SKU: 'A-4' },
      },
    ]);

    const records = await loadParkingLotArrivalQueue();

    expect(records.map((record) => record.id)).toEqual([
      'recAwaitingArrival',
      'recAwaitingSku',
      'recAwaitingMissingItem',
    ]);
  });

  it('loads a grouped Parking Lot handoff set', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recAwaitingArrival',
        createdTime: 'now',
        fields: {
          'Pick Up ID': 'pickup-100',
          'Workflow Status': 'Accepted - Awaiting Arrival',
          SKU: 'A-1',
        },
      },
      {
        id: 'recAwaitingSku',
        createdTime: 'later',
        fields: {
          'Pick Up ID': 'pickup-100',
          'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
          SKU: 'A-2',
        },
      },
    ]);

    const group = await loadParkingLotArrivalGroup('pickup-100');

    expect(group.label).toBe('pickup-100');
    expect(group.records.map((record) => record.id)).toEqual(['recAwaitingArrival', 'recAwaitingSku']);
  });

  it('loads post-publish operational rows for listed and shipping lifecycle statuses', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recListed',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Listed, Shopify', SKU: 'L-1' },
      },
      {
        id: 'recSold',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Sold - Ready to Ship', SKU: 'S-1' },
      },
      {
        id: 'recIgnored',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Approved for Publish', SKU: 'A-1' },
      },
    ]);

    const records = await loadWorkflowPostPublishQueue();

    expect(records.map((record) => record.id)).toEqual(['recListed', 'recSold']);
  });

  it('requests the live Airtable price fields for queue reads without stale aliases', async () => {
    mockGetConfiguredRecords.mockResolvedValueOnce([]);

    await loadWorkflowPostPublishQueue();

    expect(mockGetConfiguredRecords).toHaveBeenCalledWith(
      'used-gear-workflow',
      expect.objectContaining({
        fields: expect.arrayContaining([
          'Shopify Price',
          'Ebay Price',
        ]),
      }),
    );

    const requiredFields = mockGetConfiguredRecords.mock.calls[0]?.[1]?.fields;
    const fields = requiredFields;
    expect(fields).toBeDefined();
    expect(fields).not.toContain('Price');
    expect(fields).not.toContain('eBay Price');
    expect(fields).not.toContain('Shipment Follow-Through Notes');
    expect(fields).not.toContain('Shipment Follow-Through Updated At');
  });

  it('requests optional shipment fields when loading a single operational record', async () => {
    mockGetConfiguredRecords
      .mockResolvedValueOnce([
        {
          id: 'recSold',
          createdTime: 'later',
          fields: { 'Workflow Status': 'Sold - Ready to Ship', SKU: 'S-1' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'recSold',
          createdTime: 'later',
          fields: {
            'Shipment Follow-Through Notes': 'Carrier booking pending.',
            'Shipment Follow-Through Updated At': '2026-05-13T00:00:00.000Z',
          },
        },
      ]);

    const record = await loadUsedGearOperationalRecord('recSold');

    expect(record.fields['Shipment Follow-Through Notes']).toBe('Carrier booking pending.');
    expect(mockGetConfiguredRecords).toHaveBeenCalledTimes(2);
    expect(mockGetConfiguredRecords).toHaveBeenNthCalledWith(
      2,
      'used-gear-workflow',
      expect.objectContaining({
        fields: [
          'Shipment Follow-Through Notes',
          'Shipment Follow-Through Updated At',
        ],
      }),
    );
  });

  it('falls back to required operational fields when optional shipment fields are unavailable for detail reads', async () => {
    mockGetConfiguredRecords
      .mockResolvedValueOnce([
        {
          id: 'recSold',
          createdTime: 'later',
          fields: { 'Workflow Status': 'Sold - Ready to Ship', SKU: 'S-1' },
        },
      ])
      .mockRejectedValueOnce(new Error('Failed to load Airtable records for used-gear-workflow.'));

    const record = await loadUsedGearOperationalRecord('recSold');

    expect(record.id).toBe('recSold');
    expect(mockGetConfiguredRecords).toHaveBeenCalledTimes(2);
  });

  it('summarizes post-publish operational rows by lifecycle bucket', () => {
    const summary = summarizeUsedGearWorkflowPostPublishQueue([
      {
        id: 'recActive',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2099-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'recStale',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Stale Listing, eBay',
          'Listed At': '2026-01-01T00:00:00.000Z',
          'Workflow Owner': 'Taylor Reviewer',
        },
      },
      {
        id: 'recSold',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Sold - Ready to Ship',
        },
      },
      {
        id: 'recShipped',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Shipped',
        },
      },
    ], 'Taylor Reviewer');

    expect(summary).toEqual({
      activeListingCount: 1,
      staleListingCount: 1,
      staleListingMineCount: 1,
      staleListingUnassignedCount: 0,
      soldReadyCount: 1,
      soldReadyMineCount: 0,
      soldReadyUnassignedCount: 1,
      shippedCount: 1,
      totalCount: 4,
    });
  });

  it('groups operational rows by pickup first, then submission id', () => {
    const groups = groupUsedGearWorkflowRecords([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: { SKU: 'A', 'Pick Up ID': 'PU-1', 'Submission Group ID': 'SUB-1' },
      },
      {
        id: 'rec2',
        createdTime: 'now',
        fields: { SKU: 'B', 'Pick Up ID': 'PU-1', 'Submission Group ID': 'SUB-2' },
      },
      {
        id: 'rec3',
        createdTime: 'now',
        fields: { SKU: 'C', 'Submission Group ID': 'SUB-9' },
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.key).toBe('PU-1');
    expect(groups[0]?.records).toHaveLength(2);
    expect(groups[1]?.key).toBe('SUB-9');
  });

  it('accepts a pending-review row with the approved status transition fields', async () => {
    mockGetConfiguredRecord.mockResolvedValue({
      id: 'recPending',
      createdTime: 'now',
      fields: { 'Offer Amount': 500 },
    });
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'recPending',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Accepted - Awaiting Arrival' },
    });

    await acceptPendingReviewRecord('recPending', 'Taylor Reviewer', {
      acceptedStatus: 'Accepted - Awaiting Arrival',
      qualificationNotes: 'Offer confirmed and waiting on pickup scheduling.',
    });

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPending',
      expect.objectContaining({
        'Workflow Status': 'Accepted - Awaiting Arrival',
        'Qualification Complete': true,
        'Qualification Notes': 'Offer confirmed and waiting on pickup scheduling.',
        'Accepted By': 'Taylor Reviewer',
      }),
      { typecast: true },
    );
  });

  it('requires qualification notes before accepting a pending-review row into parking lot', async () => {
    await expect(acceptPendingReviewRecord('recPending', 'Taylor Reviewer', {
      acceptedStatus: 'Accepted - Awaiting Arrival',
      qualificationNotes: '   ',
    })).rejects.toThrow('Qualification Notes are required before routing a pending-review row into Parking Lot.');
  });

  it('requires pricing before accepting a pending-review row into parking lot', async () => {
    mockGetConfiguredRecord.mockResolvedValue({
      id: 'recPending',
      createdTime: 'now',
      fields: {},
    });

    await expect(acceptPendingReviewRecord('recPending', 'Taylor Reviewer', {
      acceptedStatus: 'Accepted - Awaiting Arrival',
      qualificationNotes: 'Offer discussed with seller.',
    })).rejects.toThrow('Offer Amount, Paid Amount, or Confirmed Grand Total is required before routing a pending-review row into Parking Lot.');
  });

  it('loads a specific pending-review group by its grouped queue id', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recPendingA',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Pending Review', 'Submission Group ID': 'SUB-42', SKU: 'A-1' },
      },
      {
        id: 'recPendingB',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Pending Review', 'Submission Group ID': 'SUB-42', SKU: 'A-2' },
      },
    ]);

    const group = await loadPendingReviewGroup('SUB-42');

    expect(group.id).toBe('SUB-42');
    expect(group.records).toHaveLength(2);
  });

  it('loads an operational row by exact sku lookup', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recSku',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', SKU: 'SKU-42' },
      },
    ]);

    const record = await loadUsedGearOperationalRecordBySku('sku-42');

    expect(record.id).toBe('recSku');
  });

  it('saves grouped intake review fields with equal split allocation', async () => {
    mockUpdateConfiguredRecord
      .mockResolvedValueOnce({ id: 'rec1', createdTime: 'now', fields: {} })
      .mockResolvedValueOnce({ id: 'rec2', createdTime: 'now', fields: {} });

    await savePendingReviewGroupReview({
      submissionGroupId: 'SUB-42',
      confirmedGrandTotal: 100,
      allocationMode: 'Equal Split',
      allocationNotes: 'Split evenly across the stereo pair.',
      records: [
        {
          recordId: 'rec1',
          acceptedStatus: 'Accepted - Awaiting Arrival',
          qualificationNotes: 'First item approved.',
        },
        {
          recordId: 'rec2',
          acceptedStatus: 'Accepted - Awaiting Arrival',
          qualificationNotes: 'Second item approved.',
        },
      ],
    });

    expect(mockUpdateConfiguredRecord).toHaveBeenNthCalledWith(
      1,
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Offer Amount': 50,
        'Confirmed Grand Total': 100,
        'Allocation Mode': 'Equal Split',
      }),
      { typecast: true },
    );
    expect(mockUpdateConfiguredRecord).toHaveBeenNthCalledWith(
      2,
      'used-gear-workflow',
      'rec2',
      expect.objectContaining({
        'Offer Amount': 50,
        'Confirmed Grand Total': 100,
        'Allocation Mode': 'Equal Split',
      }),
      { typecast: true },
    );
  });

  it('saves single-record pending-review notes and handoff fields', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'recPending',
      createdTime: 'now',
      fields: {
        'Qualification Notes': 'Ready for same-day testing.',
        'Arrival Date': '2026-05-12',
        SKU: 'SKU-42',
      },
    });

    await savePendingReviewRecordReview('recPending', {
      qualificationNotes: 'Ready for same-day testing.',
      arrivalDate: '2026-05-12',
      sku: 'SKU-42',
    });

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPending',
      {
        'Qualification Notes': 'Ready for same-day testing.',
        'Arrival Date': '2026-05-12',
        SKU: 'SKU-42',
      },
      { typecast: true },
    );
  });

  it('requires arrival date before saving a sku on a pending-review row', async () => {
    await expect(savePendingReviewRecordReview('recPending', {
      qualificationNotes: 'Ready for same-day testing.',
      arrivalDate: '   ',
      sku: 'SKU-42',
    })).rejects.toThrow('Arrival Date is required before saving a SKU in Parking Lot.');
  });

  it('accepts a grouped intake review after validation passes', async () => {
    mockGetConfiguredRecord
      .mockResolvedValueOnce({ id: 'rec1', createdTime: 'now', fields: { 'Confirmed Grand Total': 100 } })
      .mockResolvedValueOnce({ id: 'rec2', createdTime: 'now', fields: { 'Confirmed Grand Total': 100 } });
    mockUpdateConfiguredRecord
      .mockResolvedValueOnce({ id: 'rec1', createdTime: 'now', fields: { 'Workflow Status': 'Accepted - Awaiting Arrival' } })
      .mockResolvedValueOnce({ id: 'rec2', createdTime: 'now', fields: { 'Workflow Status': 'Accepted - Arrived, Awaiting SKU' } });

    const result = await acceptPendingReviewGroup({
      submissionGroupId: 'SUB-42',
      confirmedGrandTotal: 100,
      allocationMode: 'Equal Split',
      records: [
        {
          recordId: 'rec1',
          acceptedStatus: 'Accepted - Awaiting Arrival',
          qualificationNotes: 'Approved for pickup.',
        },
        {
          recordId: 'rec2',
          acceptedStatus: 'Accepted - Arrived, Awaiting SKU',
          qualificationNotes: 'Already in the shop.',
        },
      ],
    }, 'Taylor Reviewer');

    expect(result).toHaveLength(2);
    expect(mockUpdateConfiguredRecord).toHaveBeenCalledTimes(2);
  });

  it('restores an active trash row back to pending review', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'recTrash',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Pending Review', 'Trash Status': 'Restored' },
    });

    await restoreTrashRecord('recTrash');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recTrash',
      expect.objectContaining({
        'Workflow Status': 'Pending Review',
        'Trash Status': 'Restored',
      }),
      { typecast: true },
    );
  });

  it('re-qualifies a trash row into the accepted workflow', async () => {
    mockGetConfiguredRecord.mockResolvedValue({
      id: 'recTrash',
      createdTime: 'now',
      fields: { 'Offer Amount': 400 },
    });
    mockUpdateConfiguredRecord
      .mockResolvedValueOnce({
        id: 'recTrash',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival' },
      })
      .mockResolvedValueOnce({
        id: 'recTrash',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', 'Trash Status': 'Restored' },
      });

    await requalifyTrashRecord('recTrash', 'Taylor Reviewer', {
      acceptedStatus: 'Accepted - Awaiting Arrival',
      qualificationNotes: 'Seller followed up with the missing pricing details.',
    });

    expect(mockUpdateConfiguredRecord).toHaveBeenLastCalledWith(
      'used-gear-workflow',
      'recTrash',
      { 'Trash Status': 'Restored' },
      { typecast: true },
    );
  });

  it('permanently deletes a trash row through the workflow source', async () => {
    await permanentlyDeleteTrashRecord('recTrash');

    expect(mockDeleteConfiguredRecord).toHaveBeenCalledWith('used-gear-workflow', 'recTrash');
  });

  it('requires a reason before routing a row to unqualified', async () => {
    await expect(markPendingReviewUnqualified('recPending', '')).rejects.toThrow('Unqualified reason is required.');
  });

  it('prevents saving a parking lot SKU before arrival is recorded', async () => {
    await expect(saveParkingLotArrivalReviewRecord('recPending', {
      arrivalDate: '',
      sku: 'SKU-123',
    })).rejects.toThrow('Arrival Date is required before saving a SKU in Parking Lot.');

    expect(mockUpdateConfiguredRecord).not.toHaveBeenCalled();
  });

  it('saves parking lot arrival review fields once arrival is recorded', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'recPending',
      createdTime: 'now',
      fields: {
        'Arrival Date': '2026-05-12',
        SKU: 'SKU-123',
        'Workflow Status': 'Accepted - Arrived, Awaiting SKU',
      },
    });

    await saveParkingLotArrivalReviewRecord('recPending', {
      arrivalDate: '2026-05-12',
      sku: 'SKU-123',
    });

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'recPending',
      {
        'Arrival Date': '2026-05-12',
        SKU: 'SKU-123',
      },
      { typecast: true },
    );
  });

  it('writes workflow signoff fields through the workflow source', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Testing In Progress' },
    });

    await saveUsedGearWorkflowStageSignoff('rec1', 'testing', 'Taylor Reviewer', '2026-05-07T18:00:00.000Z');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      {
        'Testing Signed By': 'Taylor Reviewer',
        'Testing Signed At': '2026-05-07T18:00:00.000Z',
      },
      { typecast: true },
    );
  });

  it('marks processing complete and advances into testing', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Testing In Progress' },
    });

    await completeProcessingStage('rec1', 'Taylor Reviewer');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Testing In Progress',
        'Processing Signed By': 'Taylor Reviewer',
      }),
      { typecast: true },
    );
  });

  it('loads a single operational record through the workflow source', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Pending Review' },
      },
    ]);

    const record = await loadUsedGearOperationalRecord('rec1');

    expect(record.id).toBe('rec1');
  });

  it('requests the approved workflow field inventory when loading a single operational record', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Pending Review' },
      },
    ]);

    await loadUsedGearOperationalRecord('rec1');

    expect(mockGetConfiguredRecords).toHaveBeenCalledWith(
      'used-gear-workflow',
      expect.objectContaining({
        fields: expect.arrayContaining([
          'Workflow Source',
          'Submission Group ID',
          'Pick Up ID',
          'Workflow Owner',
          'Workflow Owner Assigned At',
          'Trash Status',
          'Accepted By',
          'Accepted At',
          'Processing Signed By',
          'Processing Signed At',
          'Testing Signed By',
          'Testing Signed At',
          'Photography Signed By',
          'Photography Signed At',
          'Pre-Listing Reviewed By',
          'Pre-Listing Reviewed At',
          'Qualification Notes',
          'Qualification Complete',
          'Unqualified Reason',
          'Customer Cosmetic Notes',
          'Customer Functional Notes',
          'Customer Inclusion Notes',
          'Internal Cosmetic Notes',
          'Internal Functional Notes',
          'Internal Inclusion Notes',
          'Offer Amount',
          'Paid Amount',
          'Confirmed Grand Total',
          'Allocation Mode',
          'Allocation Notes',
          'Workflow Status',
          'Awaiting Pre-Listing Review At',
          'Approved For Publish At',
          'Listed At',
          'Stale Listing At',
          'Stale Recovery Status',
          'Stale Recovery Notes',
          'Stale Recovery Updated At',
          'Relisted At',
          'Sold Ready To Ship At',
          'Shipped At',
        ]),
      }),
    );
  });

  it('loads grouped operational context for a record with sibling rows', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Pending Review', 'Submission Group ID': 'SUB-42', SKU: 'SKU-1' },
      },
      {
        id: 'rec2',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', 'Submission Group ID': 'SUB-42', SKU: 'SKU-2' },
      },
    ]);

    const context = await loadUsedGearOperationalRecordContext('rec1');

    expect(context.record.id).toBe('rec1');
    expect(context.group?.id).toBe('SUB-42');
    expect(context.group?.records).toHaveLength(2);
  });

  it('marks all rows in a pending-review group unqualified', async () => {
    mockUpdateConfiguredRecord
      .mockResolvedValueOnce({ id: 'rec1', createdTime: 'now', fields: { 'Workflow Status': 'Unqualified' } })
      .mockResolvedValueOnce({ id: 'rec2', createdTime: 'now', fields: { 'Workflow Status': 'Unqualified' } });

    const records = await markPendingReviewGroupUnqualified(['rec1', 'rec2'], 'Customer declined the revised offer.');

    expect(records).toHaveLength(2);
    expect(mockUpdateConfiguredRecord).toHaveBeenNthCalledWith(
      1,
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Unqualified',
        'Unqualified Reason': 'Customer declined the revised offer.',
      }),
      { typecast: true },
    );
    expect(mockUpdateConfiguredRecord).toHaveBeenNthCalledWith(
      2,
      'used-gear-workflow',
      'rec2',
      expect.objectContaining({
        'Workflow Status': 'Unqualified',
        'Unqualified Reason': 'Customer declined the revised offer.',
      }),
      { typecast: true },
    );
  });

  it('completes listing review and advances to approved for publish', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Awaiting Pre-Listing Review',
          Price: '2199.00',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Approved for Publish' },
    });

    await completePreListingReviewStage('rec1', 'Taylor Reviewer');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Approved for Publish',
        'Approved For Publish At': expect.any(String),
        'Pre-Listing Reviewed By': 'Taylor Reviewer',
      }),
      { typecast: true },
    );
  });

  it('assigns workflow ownership on the authoritative row', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Owner': 'Taylor Reviewer' },
    });

    await assignWorkflowOwner('rec1', 'Taylor Reviewer');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Owner': 'Taylor Reviewer',
        'Workflow Owner Assigned At': expect.any(String),
      }),
      { typecast: true },
    );
  });

  it('clears workflow ownership metadata from the row', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Owner': null },
    });

    await clearWorkflowOwner('rec1');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      {
        'Workflow Owner': null,
        'Workflow Owner Assigned At': null,
      },
      { typecast: true },
    );
  });

  it('assigns workflow ownership across a selected batch', async () => {
    mockUpdateConfiguredRecord
      .mockResolvedValueOnce({ id: 'rec1', createdTime: 'now', fields: { 'Workflow Owner': 'Taylor Reviewer' } })
      .mockResolvedValueOnce({ id: 'rec2', createdTime: 'now', fields: { 'Workflow Owner': 'Taylor Reviewer' } });

    const records = await assignWorkflowOwnerBatch(['rec1', 'rec2'], 'Taylor Reviewer');

    expect(records).toHaveLength(2);
    expect(mockUpdateConfiguredRecord).toHaveBeenNthCalledWith(
      1,
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({ 'Workflow Owner': 'Taylor Reviewer' }),
      { typecast: true },
    );
    expect(mockUpdateConfiguredRecord).toHaveBeenNthCalledWith(
      2,
      'used-gear-workflow',
      'rec2',
      expect.objectContaining({ 'Workflow Owner': 'Taylor Reviewer' }),
      { typecast: true },
    );
  });

  it('marks listed rows stale using the channel-specific stale status', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Listed, eBay',
          'Listed At': '2026-03-01T00:00:00.000Z',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Stale Listing, eBay' },
    });

    await markWorkflowListingStale('rec1');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Stale Listing, eBay',
        'Stale Listing At': expect.any(String),
      }),
      { typecast: true },
    );
  });

  it('moves listed operational rows into sold-ready-to-ship', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Stale Listing, Shopify',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-20T00:00:00.000Z',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Sold - Ready to Ship' },
    });

    await markWorkflowSoldReadyToShip('rec1');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Sold - Ready to Ship',
        'Sold Ready To Ship At': expect.any(String),
      }),
      { typecast: true },
    );
  });

  it('saves stale recovery details for stale operational rows', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Stale Listing, Shopify',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-20T00:00:00.000Z',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: {
        'Workflow Status': 'Stale Listing, Shopify',
        'Stale Recovery Status': 'Price Refresh',
        'Stale Recovery Notes': 'Adjust pricing before relist.',
      },
    });

    await saveWorkflowStaleRecovery('rec1', {
      staleRecoveryStatus: 'Price Refresh',
      staleRecoveryNotes: 'Adjust pricing before relist.',
    });

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Stale Recovery Status': 'Price Refresh',
        'Stale Recovery Notes': 'Adjust pricing before relist.',
        'Stale Recovery Updated At': expect.any(String),
      }),
      { typecast: true },
    );
  });

  it('returns stale operational rows to active listed status when relisted', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Stale Listing, eBay',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-20T00:00:00.000Z',
          'Stale Recovery Status': 'Ready To Relist',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: {
        'Workflow Status': 'Listed, eBay',
        'Relisted At': '2026-05-07T00:00:00.000Z',
      },
    });

    await markWorkflowRelisted('rec1');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Listed, eBay',
        'Relisted At': expect.any(String),
        'Stale Recovery Updated At': expect.any(String),
        'Stale Recovery Status': 'Ready To Relist',
      }),
      { typecast: true },
    );
  });

  it('marks sold-ready operational rows shipped', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Shipped' },
    });

    await markWorkflowShipped('rec1');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Shipped',
        'Shipped At': expect.any(String),
      }),
      { typecast: true },
    );
  });

  it('saves shipment follow-through notes for sold-ready operational rows', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: {
        'Workflow Status': 'Sold - Ready to Ship',
        'Shipment Follow-Through Notes': 'Carrier pickup booked.',
      },
    });

    await saveWorkflowShipmentFollowThrough('rec1', {
      shipmentFollowThroughNotes: 'Carrier pickup booked.',
    });

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Shipment Follow-Through Notes': 'Carrier pickup booked.',
        'Shipment Follow-Through Updated At': expect.any(String),
      }),
      { typecast: true },
    );
  });

  it('marks a selected batch of listed operational rows sold ready', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Listed, Shopify',
          'Listed At': '2026-03-01T00:00:00.000Z',
        },
      },
      {
        id: 'rec2',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Stale Listing, eBay',
          'Listed At': '2026-03-01T00:00:00.000Z',
          'Stale Listing At': '2026-04-20T00:00:00.000Z',
        },
      },
    ]);
    mockUpdateConfiguredRecord
      .mockResolvedValueOnce({ id: 'rec1', createdTime: 'now', fields: { 'Workflow Status': 'Sold - Ready to Ship' } })
      .mockResolvedValueOnce({ id: 'rec2', createdTime: 'now', fields: { 'Workflow Status': 'Sold - Ready to Ship' } });

    const records = await markWorkflowRowsSoldReadyToShip(['rec1', 'rec2']);

    expect(records).toHaveLength(2);
    expect(mockUpdateConfiguredRecord).toHaveBeenCalledTimes(2);
  });

  it('marks a selected batch of sold-ready operational rows shipped', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
        },
      },
      {
        id: 'rec2',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Sold - Ready to Ship',
          'Sold Ready To Ship At': '2026-05-06T00:00:00.000Z',
        },
      },
    ]);
    mockUpdateConfiguredRecord
      .mockResolvedValueOnce({ id: 'rec1', createdTime: 'now', fields: { 'Workflow Status': 'Shipped' } })
      .mockResolvedValueOnce({ id: 'rec2', createdTime: 'now', fields: { 'Workflow Status': 'Shipped' } });

    const records = await markWorkflowRowsShipped(['rec1', 'rec2']);

    expect(records).toHaveLength(2);
    expect(mockUpdateConfiguredRecord).toHaveBeenCalledTimes(2);
  });

  it('blocks listing review approval when no listing price is captured', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Awaiting Pre-Listing Review',
        },
      },
    ]);

    await expect(completePreListingReviewStage('rec1', 'Taylor Reviewer')).rejects.toThrow(
      'Capture a listing price before approving the row for publish.',
    );

    expect(mockUpdateConfiguredRecord).not.toHaveBeenCalled();
  });

  it('summarizes workflow notification counts by queue stage', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recPending',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Pending Review' },
      },
      {
        id: 'recProcessing',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival' },
      },
      {
        id: 'recConcurrentA',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Testing In Progress' },
      },
      {
        id: 'recConcurrentB',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Photography In Progress',
          'Testing Signed By': 'Taylor',
          'Testing Signed At': '2026-05-07T10:00:00.000Z',
        },
      },
      {
        id: 'recPreListing',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Awaiting Pre-Listing Review' },
      },
      {
        id: 'recApproved',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Approved for Publish' },
      },
    ]);

    await expect(loadUsedGearWorkflowNotificationCounts()).resolves.toEqual({
      pendingReview: 1,
      processing: 1,
      testing: 1,
      photography: 1,
      preListingReview: 1,
      approvedForPublish: 1,
    });
  });

  it('returns workflow notification targets and a unique inventory badge count', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recPending',
        createdTime: '2026-05-01T00:00:00.000Z',
        fields: { 'Workflow Status': 'Pending Review', 'Pick Up ID': 'pickup-100' },
      },
      {
        id: 'recProcessing',
        createdTime: '2026-05-02T00:00:00.000Z',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival' },
      },
      {
        id: 'recConcurrent',
        createdTime: '2026-05-03T00:00:00.000Z',
        fields: { 'Workflow Status': 'Testing In Progress' },
      },
      {
        id: 'recPreListing',
        createdTime: '2026-05-04T00:00:00.000Z',
        fields: { 'Workflow Status': 'Awaiting Pre-Listing Review' },
      },
      {
        id: 'recApproved',
        createdTime: '2026-05-05T00:00:00.000Z',
        fields: { 'Workflow Status': 'Approved for Publish' },
      },
    ]);

    await expect(loadUsedGearWorkflowNotificationSummary()).resolves.toEqual({
      counts: {
        pendingReview: 1,
        processing: 1,
        testing: 1,
        photography: 0,
        preListingReview: 1,
        approvedForPublish: 1,
      },
      targets: {
        pendingReview: {
          destinationTab: 'parking-lot',
          recordId: null,
          sectionId: 'used-gear-pending-review',
          groupId: 'pickup-100',
          path: '/parking-lot?workflowPendingReviewGroup=pickup-100#used-gear-pending-review',
        },
        processing: {
          destinationTab: 'parking-lot',
          recordId: 'recProcessing',
          sectionId: 'used-gear-parking-lot',
          groupId: null,
          path: '/parking-lot#used-gear-parking-lot',
        },
        testing: {
          destinationTab: 'testing-queue',
          recordId: 'recConcurrent',
          sectionId: 'used-gear-testing-queue',
          groupId: null,
          path: '/testing#used-gear-testing-queue',
        },
        photography: null,
        preListingReview: {
          destinationTab: 'listings',
          recordId: 'recPreListing',
          sectionId: null,
          groupId: null,
          path: null,
        },
        approvedForPublish: {
          destinationTab: 'listings',
          recordId: 'recApproved',
          sectionId: null,
          groupId: null,
          path: null,
        },
      },
      workflowQueueBadgeCount: 3,
      listingsBadgeCount: 1,
    });
  });

  it('filters workflow notification summary by owner preference inputs', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recMine',
        createdTime: '2026-05-01T00:00:00.000Z',
        fields: { 'Workflow Status': 'Pending Review', 'Pick Up ID': 'pickup-100', 'Workflow Owner': 'Taylor Reviewer' },
      },
      {
        id: 'recUnassigned',
        createdTime: '2026-05-02T00:00:00.000Z',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', 'Workflow Owner': '' },
      },
      {
        id: 'recOther',
        createdTime: '2026-05-03T00:00:00.000Z',
        fields: { 'Workflow Status': 'Awaiting Pre-Listing Review', 'Workflow Owner': 'Someone Else' },
      },
    ]);

    await expect(loadUsedGearWorkflowNotificationSummary({
      currentUserName: 'Taylor Reviewer',
      includeAssignedToCurrentUser: true,
      includeUnassigned: false,
    })).resolves.toEqual({
      counts: {
        pendingReview: 1,
        processing: 0,
        testing: 0,
        photography: 0,
        preListingReview: 0,
        approvedForPublish: 0,
      },
      targets: {
        pendingReview: {
          destinationTab: 'parking-lot',
          recordId: null,
          sectionId: 'used-gear-pending-review',
          groupId: 'pickup-100',
          path: '/parking-lot?workflowPendingReviewGroup=pickup-100#used-gear-pending-review',
        },
        processing: null,
        testing: null,
        photography: null,
        preListingReview: null,
        approvedForPublish: null,
      },
      workflowQueueBadgeCount: 1,
      listingsBadgeCount: 0,
    });

    await expect(loadUsedGearWorkflowNotificationSummary({
      currentUserName: 'Taylor Reviewer',
      includeAssignedToCurrentUser: false,
      includeUnassigned: true,
    })).resolves.toEqual({
      counts: {
        pendingReview: 0,
        processing: 1,
        testing: 0,
        photography: 0,
        preListingReview: 0,
        approvedForPublish: 0,
      },
      targets: {
        pendingReview: null,
        processing: {
          destinationTab: 'parking-lot',
          recordId: 'recUnassigned',
          sectionId: 'used-gear-parking-lot',
          groupId: null,
          path: '/parking-lot#used-gear-parking-lot',
        },
        testing: null,
        photography: null,
        preListingReview: null,
        approvedForPublish: null,
      },
      workflowQueueBadgeCount: 1,
      listingsBadgeCount: 0,
    });
  });
});