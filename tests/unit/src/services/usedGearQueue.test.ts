import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteConfiguredRecord, getConfiguredRecord, getConfiguredRecords, updateConfiguredRecord } from '@/services/app-api/airtable';
import {
  acceptPendingReviewRecord,
  acceptPendingReviewGroup,
  assignWorkflowOwner,
  assignWorkflowOwnerBatch,
  clearWorkflowOwner,
  completePreListingReviewStage,
  completePhotographyStage,
  completeProcessingStage,
  completeTestingStage,
  distributeUsedGearPendingReviewTotal,
  groupUsedGearWorkflowRecords,
  hasUsedGearPendingReviewPricingPath,
  loadLotTwoQueue,
  loadUsedGearWorkflowRecordBySku,
  loadWorkflowPostPublishQueue,
  loadTrashQueue,
  loadUsedGearWorkflowNotificationCounts,
  loadUsedGearWorkflowNotificationSummary,
  loadUsedGearWorkflowRecord,
  loadUsedGearWorkflowRecordContext,
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
  markWorkflowShipped,
  markWorkflowSoldReadyToShip,
  permanentlyDeleteTrashRecord,
  requalifyTrashRecord,
  restoreTrashRecord,
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

  it('loads workflow progress records for accepted and concurrent statuses', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recAccepted',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', SKU: 'A-1' },
      },
      {
        id: 'recConcurrent',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Testing and Photography In Progress', SKU: 'B-1' },
      },
      {
        id: 'recIgnored',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Pending Review', SKU: 'C-1' },
      },
      {
        id: 'recApproved',
        createdTime: 'later',
        fields: { 'Workflow Status': 'Approved for Publish', SKU: 'D-1' },
      },
    ]);

    const records = await loadWorkflowProgressQueue();

    expect(records.map((record) => record.id)).toEqual(['recAccepted', 'recConcurrent', 'recApproved']);
  });

  it('loads only parking-lot-two arrival-stage records from the workflow source', async () => {
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
        fields: { 'Workflow Status': 'Testing and Photography In Progress', SKU: 'A-4' },
      },
    ]);

    const records = await loadLotTwoQueue();

    expect(records.map((record) => record.id)).toEqual([
      'recAwaitingArrival',
      'recAwaitingSku',
      'recAwaitingMissingItem',
    ]);
  });

  it('loads post-publish workflow rows for listed and shipping lifecycle statuses', async () => {
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
    mockGetConfiguredRecords.mockResolvedValue([]);

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

    const lastCall = mockGetConfiguredRecords.mock.calls[mockGetConfiguredRecords.mock.calls.length - 1];
    const fields = lastCall?.[1]?.fields;
    expect(fields).toBeDefined();
    expect(fields).not.toContain('Price');
    expect(fields).not.toContain('eBay Price');
  });

  it('summarizes post-publish workflow rows by lifecycle bucket', () => {
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
    ]);

    expect(summary).toEqual({
      activeListingCount: 1,
      staleListingCount: 1,
      staleListingUnassignedCount: 1,
      soldReadyCount: 1,
      soldReadyUnassignedCount: 1,
      shippedCount: 1,
      totalCount: 4,
    });
  });

  it('groups workflow rows by pickup first, then submission id', () => {
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
    expect(groups[0]?.key).toBe('pickup:PU-1');
    expect(groups[0]?.records).toHaveLength(2);
    expect(groups[1]?.key).toBe('submission:SUB-9');
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

  it('requires qualification notes before accepting a pending-review row into lot 2', async () => {
    await expect(acceptPendingReviewRecord('recPending', 'Taylor Reviewer', {
      acceptedStatus: 'Accepted - Awaiting Arrival',
      qualificationNotes: '   ',
    })).rejects.toThrow('Qualification Notes are required before routing a pending-review row into Lot 2.');
  });

  it('requires pricing before accepting a pending-review row into lot 2', async () => {
    mockGetConfiguredRecord.mockResolvedValue({
      id: 'recPending',
      createdTime: 'now',
      fields: {},
    });

    await expect(acceptPendingReviewRecord('recPending', 'Taylor Reviewer', {
      acceptedStatus: 'Accepted - Awaiting Arrival',
      qualificationNotes: 'Offer discussed with seller.',
    })).rejects.toThrow('Offer Amount, Paid Amount, or Confirmed Grand Total is required before routing a pending-review row into Lot 2.');
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

    const group = await loadPendingReviewGroup('submission:SUB-42');

    expect(group.id).toBe('submission:SUB-42');
    expect(group.records).toHaveLength(2);
  });

  it('loads a workflow row by exact sku lookup', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'recSku',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival', SKU: 'SKU-42' },
      },
    ]);

    const record = await loadUsedGearWorkflowRecordBySku('sku-42');

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

  it('writes workflow signoff fields through the workflow source', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Testing and Photography In Progress' },
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

  it('marks processing complete and advances into concurrent work', async () => {
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Testing and Photography In Progress' },
    });

    await completeProcessingStage('rec1', 'Taylor Reviewer');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Testing and Photography In Progress',
        'Processing Signed By': 'Taylor Reviewer',
      }),
      { typecast: true },
    );
  });

  it('advances concurrent work to awaiting pre-listing after the second signoff', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Testing and Photography In Progress',
          'Testing Signed By': 'Taylor',
          'Testing Signed At': '2026-05-07T10:00:00.000Z',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Awaiting Pre-Listing Review' },
    });

    await completePhotographyStage('rec1', 'Jordan Reviewer');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Awaiting Pre-Listing Review',
        'Awaiting Pre-Listing Review At': expect.any(String),
        'Photography Signed By': 'Jordan Reviewer',
      }),
      { typecast: true },
    );
  });

  it('loads a single workflow record through the workflow source', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Pending Review' },
      },
    ]);

    const record = await loadUsedGearWorkflowRecord('rec1');

    expect(record.id).toBe('rec1');
  });

  it('requests the approved workflow field inventory when loading a single workflow record', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: { 'Workflow Status': 'Pending Review' },
      },
    ]);

    await loadUsedGearWorkflowRecord('rec1');

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
          'Customer Submitted Photos Notes',
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

  it('loads grouped workflow context for a record with sibling rows', async () => {
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

    const context = await loadUsedGearWorkflowRecordContext('rec1');

    expect(context.record.id).toBe('rec1');
    expect(context.group?.id).toBe('submission:SUB-42');
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

  it('completes pre-listing review and advances to approved for publish', async () => {
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

  it('moves listed workflow rows into sold-ready-to-ship', async () => {
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

  it('saves stale recovery details for stale workflow rows', async () => {
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

  it('returns stale workflow rows to active listed status when relisted', async () => {
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

  it('marks sold-ready workflow rows shipped', async () => {
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

  it('marks a selected batch of listed workflow rows sold ready', async () => {
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

  it('marks a selected batch of sold-ready workflow rows shipped', async () => {
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

  it('blocks pre-listing approval when no listing price is captured', async () => {
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

  it('completes testing without advancing when photography is still pending', async () => {
    mockGetConfiguredRecords.mockResolvedValue([
      {
        id: 'rec1',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Testing and Photography In Progress',
        },
      },
    ]);
    mockUpdateConfiguredRecord.mockResolvedValue({
      id: 'rec1',
      createdTime: 'now',
      fields: { 'Workflow Status': 'Testing and Photography In Progress' },
    });

    await completeTestingStage('rec1', 'Taylor Reviewer');

    expect(mockUpdateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow',
      'rec1',
      expect.objectContaining({
        'Workflow Status': 'Testing and Photography In Progress',
        'Testing Signed By': 'Taylor Reviewer',
      }),
      { typecast: true },
    );
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
        fields: { 'Workflow Status': 'Testing and Photography In Progress' },
      },
      {
        id: 'recConcurrentB',
        createdTime: 'now',
        fields: {
          'Workflow Status': 'Testing and Photography In Progress',
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
      photography: 2,
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
        fields: { 'Workflow Status': 'Testing and Photography In Progress' },
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
        photography: 1,
        preListingReview: 1,
        approvedForPublish: 1,
      },
      targets: {
        pendingReview: {
          destinationTab: 'jotform',
          recordId: null,
          sectionId: 'used-gear-pending-review',
          groupId: 'pickup:pickup-100',
          path: '/parking-lot-1?workflowPendingReviewGroup=pickup%3Apickup-100#used-gear-pending-review',
        },
        processing: {
          destinationTab: 'parking-lot-2',
          recordId: 'recProcessing',
          sectionId: 'used-gear-lot-two',
          groupId: null,
          path: '/parking-lot-2#used-gear-lot-two',
        },
        testing: {
          destinationTab: 'testing-queue',
          recordId: 'recConcurrent',
          sectionId: 'used-gear-testing-queue',
          groupId: null,
          path: '/workflow/testing#used-gear-testing-queue',
        },
        photography: {
          destinationTab: 'photography-queue',
          recordId: 'recConcurrent',
          sectionId: 'used-gear-photography-queue',
          groupId: null,
          path: '/workflow/photography#used-gear-photography-queue',
        },
        preListingReview: {
          destinationTab: 'pre-listing-queue',
          recordId: 'recPreListing',
          sectionId: 'used-gear-pre-listing-queue',
          groupId: null,
          path: '/workflow/pre-listing#used-gear-pre-listing-queue',
        },
        approvedForPublish: {
          destinationTab: 'listings',
          recordId: 'recApproved',
          sectionId: null,
          groupId: null,
          path: null,
        },
      },
      workflowQueueBadgeCount: 5,
    });
  });
});