import { deleteConfiguredRecord, getConfiguredRecord, getConfiguredRecords, updateConfiguredRecord } from '@/services/app-api/airtable';
import type { UsedGearWorkflowNotificationEvent } from '@/stores/auth/authTypes';
import {
  buildUsedGearConcurrentStageSignoffs,
  canEnterAwaitingPreListingReview,
  enrichUsedGearWorkflowRecord,
  getUsedGearWorkflowSignoffFieldNames,
  getUsedGearWorkflowStatus,
  USED_GEAR_WORKFLOW_NEXT_TEAM_FIELD,
  USED_GEAR_WORKFLOW_STATUS_FIELD,
  type UsedGearWorkflowStage,
} from '@/services/usedGearWorkflow';
import { getUsedGearWorkflowPostPublishSnapshot } from '@/services/usedGearWorkflowLifecycle';
import { assertUsedGearWorkflowReadyForPublish } from '@/services/usedGearWorkflowListingReadiness';
import type { AirtableRecord } from '@/types/airtable';

const USED_GEAR_PENDING_REVIEW_QUEUE_FIELDS = [
  'Arrival Date',
  'SKU',
  'Make',
  'Model',
  'Workflow Source',
  'Workflow Status',
  'Submission Group ID',
  'Pick Up ID',
  'Qualification Complete',
  'Qualification Notes',
  'Offer Amount',
  'Paid Amount',
  'Confirmed Grand Total',
  'Allocation Mode',
  'Allocation Notes',
  'Unqualified Reason',
  'Accepted By',
  'Accepted At',
  'Trash Status',
] as const;

const USED_GEAR_TRASH_QUEUE_FIELDS = [
  ...USED_GEAR_PENDING_REVIEW_QUEUE_FIELDS,
] as const;

const USED_GEAR_WORKFLOW_RECORD_FIELDS = [
  ...USED_GEAR_PENDING_REVIEW_QUEUE_FIELDS,
  'Processing Signed By',
  'Processing Signed At',
  'Testing Signed By',
  'Testing Signed At',
  'Photography Signed By',
  'Photography Signed At',
  'Pre-Listing Reviewed By',
  'Pre-Listing Reviewed At',
  'Component Type',
  'Inventory Notes',
  'Customer Cosmetic Notes',
  'Customer Functional Notes',
  'Customer Inclusion Notes',
  'Internal Cosmetic Notes',
  'Internal Functional Notes',
  'Internal Inclusion Notes',
  'Awaiting Pre-Listing Review At',
  'Approved For Publish At',
  'Listed At',
  'Stale Listing At',
  'Sold Ready To Ship At',
  'Shipped At',
  'Price',
  'Shopify Price',
  'eBay Price',
] as const;

const PENDING_REVIEW_STATUS = 'Pending Review';
const ACCEPTED_AWAITING_ARRIVAL_STATUS = 'Accepted - Awaiting Arrival';
const ACCEPTED_ARRIVED_AWAITING_SKU_STATUS = 'Accepted - Arrived, Awaiting SKU';
const ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS = 'Accepted - Arrived, Awaiting Missing Item';
const TESTING_AND_PHOTOGRAPHY_IN_PROGRESS_STATUS = 'Testing and Photography In Progress';
const AWAITING_PRE_LISTING_REVIEW_STATUS = 'Awaiting Pre-Listing Review';
const APPROVED_FOR_PUBLISH_STATUS = 'Approved for Publish';
const LISTED_SHOPIFY_STATUS = 'Listed, Shopify';
const LISTED_EBAY_STATUS = 'Listed, eBay';
const STALE_LISTING_SHOPIFY_STATUS = 'Stale Listing, Shopify';
const STALE_LISTING_EBAY_STATUS = 'Stale Listing, eBay';
const SOLD_READY_TO_SHIP_STATUS = 'Sold - Ready to Ship';
const SHIPPED_STATUS = 'Shipped';
const UNQUALIFIED_STATUS = 'Unqualified';
const ACTIVE_TRASH_STATUS = 'Active Trash';

const USED_GEAR_PROGRESS_STATUSES = new Set([
  ACCEPTED_AWAITING_ARRIVAL_STATUS,
  ACCEPTED_ARRIVED_AWAITING_SKU_STATUS,
  ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS,
  TESTING_AND_PHOTOGRAPHY_IN_PROGRESS_STATUS,
  AWAITING_PRE_LISTING_REVIEW_STATUS,
  APPROVED_FOR_PUBLISH_STATUS,
]);

const USED_GEAR_POST_PUBLISH_STATUSES = new Set([
  LISTED_SHOPIFY_STATUS,
  LISTED_EBAY_STATUS,
  STALE_LISTING_SHOPIFY_STATUS,
  STALE_LISTING_EBAY_STATUS,
  SOLD_READY_TO_SHIP_STATUS,
  SHIPPED_STATUS,
]);

const USED_GEAR_WORKFLOW_NOTIFICATION_FIELDS = [
  USED_GEAR_WORKFLOW_STATUS_FIELD,
  'Testing Signed By',
  'Testing Signed At',
  'Photography Signed By',
  'Photography Signed At',
] as const;

export type UsedGearWorkflowNotificationCounts = Record<UsedGearWorkflowNotificationEvent, number>;

export interface UsedGearWorkflowPostPublishSummary {
  activeListingCount: number;
  staleListingCount: number;
  soldReadyCount: number;
  shippedCount: number;
  totalCount: number;
}

function createEmptyWorkflowNotificationCounts(): UsedGearWorkflowNotificationCounts {
  return {
    pendingReview: 0,
    processing: 0,
    testing: 0,
    photography: 0,
    preListingReview: 0,
    approvedForPublish: 0,
  };
}

export function createEmptyUsedGearWorkflowPostPublishSummary(): UsedGearWorkflowPostPublishSummary {
  return {
    activeListingCount: 0,
    staleListingCount: 0,
    soldReadyCount: 0,
    shippedCount: 0,
    totalCount: 0,
  };
}

export interface UsedGearWorkflowGroup {
  id: string;
  key: string;
  label: string;
  description: string;
  records: AirtableRecord[];
}

export type UsedGearPendingReviewAcceptedStatus =
  | typeof ACCEPTED_AWAITING_ARRIVAL_STATUS
  | typeof ACCEPTED_ARRIVED_AWAITING_SKU_STATUS
  | typeof ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS;

export type UsedGearPendingReviewAllocationMode = 'Equal Split' | 'Manual Override';

export interface UsedGearPendingReviewGroupRecordInput {
  recordId: string;
  acceptedStatus: UsedGearPendingReviewAcceptedStatus;
  qualificationNotes: string;
  offerAmount?: number | null;
  paidAmount?: number | null;
}

export interface UsedGearPendingReviewGroupReviewInput {
  records: UsedGearPendingReviewGroupRecordInput[];
  submissionGroupId?: string | null;
  confirmedGrandTotal?: number | null;
  allocationMode: UsedGearPendingReviewAllocationMode;
  allocationNotes?: string;
}

function withWorkflow(record: AirtableRecord): AirtableRecord {
  return enrichUsedGearWorkflowRecord(record);
}

function getTrimmedFieldValue(record: AirtableRecord, fieldName: string): string {
  const value = record.fields[fieldName];
  return typeof value === 'string' ? value.trim() : '';
}

function getNumericFieldValue(fields: Record<string, unknown>, fieldName: string): number | null {
  const value = fields[fieldName];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeNullableCurrency(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function normalizeAllocationText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

export function hasUsedGearPendingReviewPricingPath(fields: Record<string, unknown>): boolean {
  return getNumericFieldValue(fields, 'Offer Amount') !== null
    || getNumericFieldValue(fields, 'Paid Amount') !== null
    || getNumericFieldValue(fields, 'Confirmed Grand Total') !== null;
}

export function distributeUsedGearPendingReviewTotal(total: number, count: number): number[] {
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Confirmed Grand Total must be greater than zero.');
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Allocation requires at least one intake row.');
  }

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  let remainder = totalCents - (baseCents * count);

  return Array.from({ length: count }, () => {
    const value = baseCents + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }
    return value / 100;
  });
}

function groupKeyForRecord(record: AirtableRecord): { key: string; label: string; description: string } {
  const pickupId = getTrimmedFieldValue(record, 'Pick Up ID');
  if (pickupId) {
    return {
      key: `pickup:${pickupId}`,
      label: pickupId,
      description: 'Pickup group',
    };
  }

  const submissionGroupId = getTrimmedFieldValue(record, 'Submission Group ID');
  if (submissionGroupId) {
    return {
      key: `submission:${submissionGroupId}`,
      label: submissionGroupId,
      description: 'Submission group',
    };
  }

  return {
    key: `record:${record.id}`,
    label: getTrimmedFieldValue(record, 'SKU') || record.id,
    description: 'Single record',
  };
}

export async function loadPendingReviewQueue(): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_PENDING_REVIEW_QUEUE_FIELDS],
  });

  return records
    .map(withWorkflow)
    .filter((record) => getUsedGearWorkflowStatus(record.fields) === PENDING_REVIEW_STATUS);
}

export async function loadPendingReviewGroup(groupId: string): Promise<UsedGearWorkflowGroup> {
  const groups = groupUsedGearWorkflowRecords(await loadPendingReviewQueue());
  const group = groups.find((candidate) => candidate.id === groupId);

  if (!group) {
    throw new Error('Unable to load the selected pending-review group.');
  }

  return group;
}

export async function loadUsedGearWorkflowRecordBySku(sku: string): Promise<AirtableRecord> {
  const normalizedSku = sku.trim().toLowerCase();
  if (!normalizedSku) {
    throw new Error('SKU is required.');
  }

  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_RECORD_FIELDS],
  });

  const record = records
    .map(withWorkflow)
    .find((candidate) => getTrimmedFieldValue(candidate, 'SKU').toLowerCase() === normalizedSku);

  if (!record) {
    throw new Error(`No used-gear workflow row was found for SKU ${sku.trim()}.`);
  }

  return record;
}

export async function loadTrashQueue(): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_TRASH_QUEUE_FIELDS],
  });

  return records
    .map(withWorkflow)
    .filter((record) => {
      const status = getUsedGearWorkflowStatus(record.fields);
      const trashStatus = getTrimmedFieldValue(record, 'Trash Status');
      return status === UNQUALIFIED_STATUS && trashStatus === ACTIVE_TRASH_STATUS;
    });
}

export async function loadLotTwoQueue(): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_RECORD_FIELDS],
  });

  return records
    .map(withWorkflow)
    .filter((record) => {
      const status = getUsedGearWorkflowStatus(record.fields);
      return Boolean(
        status
        && (
          status === ACCEPTED_AWAITING_ARRIVAL_STATUS
          || status === ACCEPTED_ARRIVED_AWAITING_SKU_STATUS
          || status === ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS
        ),
      );
    });
}

export async function loadWorkflowProgressQueue(): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_RECORD_FIELDS],
  });

  return records
    .map(withWorkflow)
    .filter((record) => {
      const status = getUsedGearWorkflowStatus(record.fields);
      return Boolean(status && USED_GEAR_PROGRESS_STATUSES.has(status));
    });
}

export async function loadWorkflowPostPublishQueue(): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_RECORD_FIELDS],
  });

  return records
    .map(withWorkflow)
    .filter((record) => {
      const status = getUsedGearWorkflowStatus(record.fields);
      return Boolean(status && USED_GEAR_POST_PUBLISH_STATUSES.has(status));
    });
}

export function summarizeUsedGearWorkflowPostPublishQueue(
  records: AirtableRecord[],
): UsedGearWorkflowPostPublishSummary {
  return records.reduce<UsedGearWorkflowPostPublishSummary>((summary, record) => {
    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
    if (!snapshot) {
      return summary;
    }

    summary.totalCount += 1;

    if (snapshot.bucket === 'active-listing') {
      summary.activeListingCount += 1;
      return summary;
    }

    if (snapshot.bucket === 'stale-listing') {
      summary.staleListingCount += 1;
      return summary;
    }

    if (snapshot.bucket === 'sold-ready') {
      summary.soldReadyCount += 1;
      return summary;
    }

    summary.shippedCount += 1;
    return summary;
  }, createEmptyUsedGearWorkflowPostPublishSummary());
}

export async function loadUsedGearWorkflowRecord(recordId: string): Promise<AirtableRecord> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_RECORD_FIELDS],
  });

  const record = records.find((candidate) => candidate.id === recordId);
  if (!record) {
    throw new Error('Unable to load the selected used-gear workflow record.');
  }

  return withWorkflow(record);
}

export async function loadUsedGearWorkflowNotificationCounts(): Promise<UsedGearWorkflowNotificationCounts> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_NOTIFICATION_FIELDS],
  });

  return records.reduce<UsedGearWorkflowNotificationCounts>((counts, record) => {
    const status = getUsedGearWorkflowStatus(record.fields);
    if (!status) {
      return counts;
    }

    if (status === PENDING_REVIEW_STATUS) {
      counts.pendingReview += 1;
      return counts;
    }

    if (
      status === ACCEPTED_AWAITING_ARRIVAL_STATUS
      || status === ACCEPTED_ARRIVED_AWAITING_SKU_STATUS
      || status === ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS
    ) {
      counts.processing += 1;
      return counts;
    }

    if (status === TESTING_AND_PHOTOGRAPHY_IN_PROGRESS_STATUS) {
      const signoffs = buildUsedGearConcurrentStageSignoffs(record.fields);
      if (!signoffs.testingSignedBy || !signoffs.testingSignedAt) {
        counts.testing += 1;
      }
      if (!signoffs.photographySignedBy || !signoffs.photographySignedAt) {
        counts.photography += 1;
      }
      return counts;
    }

    if (status === AWAITING_PRE_LISTING_REVIEW_STATUS) {
      counts.preListingReview += 1;
      return counts;
    }

    if (status === APPROVED_FOR_PUBLISH_STATUS) {
      counts.approvedForPublish += 1;
    }

    return counts;
  }, createEmptyWorkflowNotificationCounts());
}

export function groupUsedGearWorkflowRecords(records: AirtableRecord[]): UsedGearWorkflowGroup[] {
  const groups = new Map<string, UsedGearWorkflowGroup>();

  records.forEach((record) => {
    const { key, label, description } = groupKeyForRecord(record);
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.records.push(record);
      return;
    }

    groups.set(key, {
      id: key,
      key,
      label,
      description,
      records: [record],
    });
  });

  return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export async function acceptPendingReviewRecord(
  recordId: string,
  userName: string,
  options: {
    acceptedStatus: UsedGearPendingReviewAcceptedStatus;
    qualificationNotes: string;
  },
): Promise<AirtableRecord> {
  const normalizedUserName = userName.trim();
  if (!normalizedUserName) {
    throw new Error('Accepted By requires the current user name.');
  }

  const normalizedQualificationNotes = options.qualificationNotes.trim();
  if (!normalizedQualificationNotes) {
    throw new Error('Qualification Notes are required before routing a pending-review row into Lot 2.');
  }

  const currentRecord = await getConfiguredRecord('used-gear-workflow', recordId);
  if (!hasUsedGearPendingReviewPricingPath(currentRecord.fields)) {
    throw new Error('Offer Amount, Paid Amount, or Confirmed Grand Total is required before routing a pending-review row into Lot 2.');
  }

  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: options.acceptedStatus,
      'Qualification Complete': true,
      'Qualification Notes': normalizedQualificationNotes,
      'Accepted By': normalizedUserName,
      'Accepted At': new Date().toISOString(),
      'Trash Status': null,
      'Unqualified Reason': null,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function savePendingReviewGroupReview(
  input: UsedGearPendingReviewGroupReviewInput,
): Promise<AirtableRecord[]> {
  if (input.records.length === 0) {
    throw new Error('Pending-review group review requires at least one intake row.');
  }

  const normalizedSubmissionGroupId = input.submissionGroupId?.trim() ?? '';
  if (input.records.length > 1 && !normalizedSubmissionGroupId) {
    throw new Error('Submission Group ID is required before saving a multi-item intake review.');
  }

  const normalizedAllocationNotes = normalizeAllocationText(input.allocationNotes);
  const normalizedGrandTotal = normalizeNullableCurrency(input.confirmedGrandTotal);
  const allocatedOfferAmounts = input.allocationMode === 'Equal Split' && normalizedGrandTotal !== null
    ? distributeUsedGearPendingReviewTotal(normalizedGrandTotal, input.records.length)
    : null;

  const updatedRecords: AirtableRecord[] = [];

  for (const [index, record] of input.records.entries()) {
    const normalizedQualificationNotes = record.qualificationNotes.trim();
    const offerAmount = allocatedOfferAmounts
      ? allocatedOfferAmounts[index]
      : normalizeNullableCurrency(record.offerAmount);
    const paidAmount = normalizeNullableCurrency(record.paidAmount);

    const updatedRecord = await updateConfiguredRecord(
      'used-gear-workflow',
      record.recordId,
      {
        'Submission Group ID': normalizedSubmissionGroupId || null,
        'Qualification Notes': normalizedQualificationNotes || null,
        'Offer Amount': offerAmount,
        'Paid Amount': paidAmount,
        'Confirmed Grand Total': normalizedGrandTotal,
        'Allocation Mode': normalizedGrandTotal !== null ? input.allocationMode : null,
        'Allocation Notes': normalizedGrandTotal !== null ? normalizedAllocationNotes : null,
      },
      { typecast: true },
    );

    updatedRecords.push(withWorkflow(updatedRecord));
  }

  return updatedRecords;
}

export async function acceptPendingReviewGroup(
  input: UsedGearPendingReviewGroupReviewInput,
  userName: string,
): Promise<AirtableRecord[]> {
  const normalizedSubmissionGroupId = input.submissionGroupId?.trim() ?? '';
  if (input.records.length > 1 && !normalizedSubmissionGroupId) {
    throw new Error('Submission Group ID is required before routing a multi-item intake review into Lot 2.');
  }

  const acceptedRecords: AirtableRecord[] = [];

  for (const record of input.records) {
    acceptedRecords.push(await acceptPendingReviewRecord(record.recordId, userName, {
      acceptedStatus: record.acceptedStatus,
      qualificationNotes: record.qualificationNotes,
    }));
  }

  return acceptedRecords;
}

export async function markPendingReviewUnqualified(recordId: string, reason: string): Promise<AirtableRecord> {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new Error('Unqualified reason is required.');
  }

  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: UNQUALIFIED_STATUS,
      'Qualification Complete': false,
      'Unqualified Reason': normalizedReason,
      'Trash Status': ACTIVE_TRASH_STATUS,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function restoreTrashRecord(recordId: string): Promise<AirtableRecord> {
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: PENDING_REVIEW_STATUS,
      'Qualification Complete': false,
      'Trash Status': 'Restored',
      'Unqualified Reason': null,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function requalifyTrashRecord(
  recordId: string,
  userName: string,
  options: {
    acceptedStatus: UsedGearPendingReviewAcceptedStatus;
    qualificationNotes: string;
  },
): Promise<AirtableRecord> {
  const record = await acceptPendingReviewRecord(recordId, userName, options);

  const restoredRecord = await updateConfiguredRecord(
    'used-gear-workflow',
    record.id,
    {
      'Trash Status': 'Restored',
    },
    { typecast: true },
  );

  return withWorkflow(restoredRecord);
}

export async function permanentlyDeleteTrashRecord(recordId: string): Promise<void> {
  await deleteConfiguredRecord('used-gear-workflow', recordId);
}

export async function saveUsedGearWorkflowStageSignoff(
  recordId: string,
  stage: UsedGearWorkflowStage,
  userName: string,
  signedAt = new Date().toISOString(),
): Promise<AirtableRecord> {
  const normalizedUserName = userName.trim();
  if (!normalizedUserName) {
    throw new Error('Stage signoff requires the current user name.');
  }

  const fieldNames = getUsedGearWorkflowSignoffFieldNames(stage);
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [fieldNames.signedBy]: normalizedUserName,
      [fieldNames.signedAt]: signedAt,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function completeProcessingStage(recordId: string, userName: string): Promise<AirtableRecord> {
  const normalizedUserName = userName.trim();
  if (!normalizedUserName) {
    throw new Error('Processing completion requires the current user name.');
  }

  const fieldNames = getUsedGearWorkflowSignoffFieldNames('processing');
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [fieldNames.signedBy]: normalizedUserName,
      [fieldNames.signedAt]: new Date().toISOString(),
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: TESTING_AND_PHOTOGRAPHY_IN_PROGRESS_STATUS,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

async function completeConcurrentStage(
  recordId: string,
  stage: 'testing' | 'photography',
  userName: string,
): Promise<AirtableRecord> {
  const normalizedUserName = userName.trim();
  if (!normalizedUserName) {
    throw new Error('Stage completion requires the current user name.');
  }

  const currentRecord = await loadUsedGearWorkflowRecord(recordId);
  const currentStatus = getUsedGearWorkflowStatus(currentRecord.fields);
  if (currentStatus !== TESTING_AND_PHOTOGRAPHY_IN_PROGRESS_STATUS) {
    throw new Error('Concurrent stage completion is only available while testing and photography are in progress.');
  }

  const fieldNames = getUsedGearWorkflowSignoffFieldNames(stage);
  const signedAt = new Date().toISOString();
  const nextSignoffs = buildUsedGearConcurrentStageSignoffs({
    ...currentRecord.fields,
    [fieldNames.signedBy]: normalizedUserName,
    [fieldNames.signedAt]: signedAt,
  });

  const nextStatus = canEnterAwaitingPreListingReview(nextSignoffs)
    ? AWAITING_PRE_LISTING_REVIEW_STATUS
    : TESTING_AND_PHOTOGRAPHY_IN_PROGRESS_STATUS;

  const nextFields: Record<string, unknown> = {
    [fieldNames.signedBy]: normalizedUserName,
    [fieldNames.signedAt]: signedAt,
    [USED_GEAR_WORKFLOW_STATUS_FIELD]: nextStatus,
  };

  if (nextStatus === AWAITING_PRE_LISTING_REVIEW_STATUS) {
    nextFields['Awaiting Pre-Listing Review At'] = signedAt;
  }

  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    nextFields,
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function completeTestingStage(recordId: string, userName: string): Promise<AirtableRecord> {
  return completeConcurrentStage(recordId, 'testing', userName);
}

export async function completePhotographyStage(recordId: string, userName: string): Promise<AirtableRecord> {
  return completeConcurrentStage(recordId, 'photography', userName);
}

export async function completePreListingReviewStage(recordId: string, userName: string): Promise<AirtableRecord> {
  const normalizedUserName = userName.trim();
  if (!normalizedUserName) {
    throw new Error('Pre-listing review requires the current user name.');
  }

  const currentRecord = await loadUsedGearWorkflowRecord(recordId);
  const currentStatus = getUsedGearWorkflowStatus(currentRecord.fields);
  if (currentStatus !== AWAITING_PRE_LISTING_REVIEW_STATUS) {
    throw new Error('Pre-listing review can only be completed when the row is awaiting pre-listing review.');
  }

  assertUsedGearWorkflowReadyForPublish(currentRecord);

  const fieldNames = getUsedGearWorkflowSignoffFieldNames('pre-listing');
  const reviewedAt = new Date().toISOString();
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [fieldNames.signedBy]: normalizedUserName,
      [fieldNames.signedAt]: reviewedAt,
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: APPROVED_FOR_PUBLISH_STATUS,
      'Approved For Publish At': reviewedAt,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export function getUsedGearWorkflowPrimaryAction(record: AirtableRecord): string {
  const status = getUsedGearWorkflowStatus(record.fields);
  switch (status) {
    case ACCEPTED_AWAITING_ARRIVAL_STATUS:
    case ACCEPTED_ARRIVED_AWAITING_SKU_STATUS:
    case ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS:
      return 'Processing';
    case TESTING_AND_PHOTOGRAPHY_IN_PROGRESS_STATUS:
      return getTrimmedFieldValue(record, USED_GEAR_WORKFLOW_NEXT_TEAM_FIELD) || 'Testing, Photography';
    case AWAITING_PRE_LISTING_REVIEW_STATUS:
      return 'Pre-Listing Review';
    case APPROVED_FOR_PUBLISH_STATUS:
      return 'Approved for Publish';
    case LISTED_SHOPIFY_STATUS:
    case LISTED_EBAY_STATUS:
    case STALE_LISTING_SHOPIFY_STATUS:
    case STALE_LISTING_EBAY_STATUS:
      return 'Live Listing';
    case SOLD_READY_TO_SHIP_STATUS:
      return 'Ship Item';
    case SHIPPED_STATUS:
      return 'Shipped';
    default:
      return getTrimmedFieldValue(record, USED_GEAR_WORKFLOW_NEXT_TEAM_FIELD) || 'Review';
  }
}

export async function markWorkflowListingStale(recordId: string): Promise<AirtableRecord> {
  const currentRecord = await loadUsedGearWorkflowRecord(recordId);
  const snapshot = getUsedGearWorkflowPostPublishSnapshot(currentRecord);
  if (!snapshot || (snapshot.status !== LISTED_SHOPIFY_STATUS && snapshot.status !== LISTED_EBAY_STATUS && snapshot.status !== STALE_LISTING_SHOPIFY_STATUS && snapshot.status !== STALE_LISTING_EBAY_STATUS)) {
    throw new Error('Only active listed workflow rows can be moved into the stale listing queue.');
  }

  const staleAt = new Date().toISOString();
  const nextStatus = snapshot.channel === 'ebay' ? STALE_LISTING_EBAY_STATUS : STALE_LISTING_SHOPIFY_STATUS;
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: nextStatus,
      'Stale Listing At': getTrimmedFieldValue(currentRecord, 'Stale Listing At') || staleAt,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function markWorkflowSoldReadyToShip(recordId: string): Promise<AirtableRecord> {
  const currentRecord = await loadUsedGearWorkflowRecord(recordId);
  const snapshot = getUsedGearWorkflowPostPublishSnapshot(currentRecord);
  if (!snapshot || (snapshot.bucket !== 'active-listing' && snapshot.bucket !== 'stale-listing')) {
    throw new Error('Only listed workflow rows can move into sold-ready-to-ship.');
  }

  const soldReadyAt = new Date().toISOString();
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: SOLD_READY_TO_SHIP_STATUS,
      'Sold Ready To Ship At': getTrimmedFieldValue(currentRecord, 'Sold Ready To Ship At') || soldReadyAt,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function markWorkflowShipped(recordId: string): Promise<AirtableRecord> {
  const currentRecord = await loadUsedGearWorkflowRecord(recordId);
  const currentStatus = getUsedGearWorkflowStatus(currentRecord.fields);
  if (currentStatus !== SOLD_READY_TO_SHIP_STATUS) {
    throw new Error('Only sold-ready-to-ship workflow rows can be marked shipped.');
  }

  const shippedAt = new Date().toISOString();
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: SHIPPED_STATUS,
      'Shipped At': getTrimmedFieldValue(currentRecord, 'Shipped At') || shippedAt,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}
