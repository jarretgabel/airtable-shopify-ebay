import { deleteConfiguredRecord, getConfiguredRecord, getConfiguredRecords, updateConfiguredRecord } from '@/services/app-api/airtable';
import type { UsedGearWorkflowNotificationEvent } from '@/stores/auth/authTypes';
import {
  enrichUsedGearWorkflowRecord,
  getUsedGearWorkflowSignoffFieldNames,
  getUsedGearWorkflowStatus,
  USED_GEAR_WORKFLOW_NEXT_TEAM_FIELD,
  USED_GEAR_WORKFLOW_STATUS_FIELD,
  type UsedGearWorkflowStage,
} from '@/services/usedGearWorkflow';
import {
  getUsedGearWorkflowPostPublishSnapshot,
  isUsedGearWorkflowStaleRecoveryStatus,
  type UsedGearWorkflowStaleRecoveryStatus,
} from '@/services/usedGearWorkflowLifecycle';
import { assertUsedGearWorkflowReadyForPublish } from '@/services/usedGearWorkflowListingReadiness';
import type { AirtableRecord } from '@/types/airtable';

const USED_GEAR_PENDING_REVIEW_QUEUE_FIELDS = [
  'Item Title',
  'Arrival Date',
  'SKU',
  'Make',
  'Model',
  'Workflow Source',
  'Workflow Status',
  'Submission Group ID',
  'Pick Up ID',
  'Workflow Owner',
  'Workflow Owner Assigned At',
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
  'Workflow Owner',
  'Workflow Owner Assigned At',
  // Intake
  'Pick Up #',
  'Acquired From',
  'Cost',
  'Component Type',
  'Serial Number',
  'Voltage',
  'Original Box',
  'Manual',
  'Remote',
  'Power Cable',
  'Additional Items',
  'Weight',
  'Shipping Dims',
  'Shipping Method',
  'Seller Email',
  'Seller Phone',
  'Seller Zip Code',
  'Seller Location',
  'How Did You Hear',
  'Mailing List Opt In',
  'Original Owner',
  'Smoke Exposure',
  'Inventory Notes',
  'Customer Cosmetic Notes',
  'Customer Functional Notes',
  'Customer Inclusion Notes',
  // Images (all stages — intake, testing, photos)
  'Workflow Image Metadata JSON',
  // Testing
  'Testing Notes',
  'Testing Time',
  'Tested',
  'Testing Cosmetic Notes',
  'Photography Cosmetic Notes',
  'Internal Cosmetic Notes',
  'Internal Functional Notes',
  'Internal Inclusion Notes',
  // Listing
  'Shopify Tags',
  'Ebay Categories',
  'Shopify Approved',
  'Ebay Approved',
  'Awaiting Pre-Listing Review At',
  'Approved For Publish At',
  'Listed At',
  'eBay Published At',
  'eBay Offer ID',
  'eBay Listing ID',
  'Stale Listing At',
  'Stale Recovery Status',
  'Stale Recovery Notes',
  'Stale Recovery Updated At',
  'Relisted At',
  'Sold Ready To Ship At',
  'Shipment Follow-Through Notes',
  'Shipment Follow-Through Updated At',
  'Shipped At',
  'Shopify Price',
  'Ebay Price',
] as const;

const USED_GEAR_WORKFLOW_OPTIONAL_READ_FIELDS = [
  'Shipment Follow-Through Notes',
  'Shipment Follow-Through Updated At',
] as const;

const USED_GEAR_WORKFLOW_OPTIONAL_READ_FIELD_SET = new Set<string>(USED_GEAR_WORKFLOW_OPTIONAL_READ_FIELDS);

const USED_GEAR_WORKFLOW_REQUIRED_RECORD_FIELDS = USED_GEAR_WORKFLOW_RECORD_FIELDS.filter(
  (fieldName) => !USED_GEAR_WORKFLOW_OPTIONAL_READ_FIELD_SET.has(fieldName),
);

const PENDING_REVIEW_STATUS = 'Pending Review';
const ACCEPTED_AWAITING_ARRIVAL_STATUS = 'Accepted - Awaiting Arrival';
const ACCEPTED_ARRIVED_AWAITING_SKU_STATUS = 'Accepted - Arrived, Awaiting SKU';
const ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS = 'Accepted - Arrived, Awaiting Missing Item';
const TESTING_IN_PROGRESS_STATUS = 'Testing In Progress';
const PHOTOGRAPHY_IN_PROGRESS_STATUS = 'Photography In Progress';
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

const USED_GEAR_PARKING_LOT_STATUSES = new Set([
  PENDING_REVIEW_STATUS,
  ACCEPTED_AWAITING_ARRIVAL_STATUS,
  ACCEPTED_ARRIVED_AWAITING_SKU_STATUS,
  ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS,
]);

const USED_GEAR_ARRIVAL_STAGE_STATUSES = new Set([
  ACCEPTED_AWAITING_ARRIVAL_STATUS,
  ACCEPTED_ARRIVED_AWAITING_SKU_STATUS,
  ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS,
]);

const USED_GEAR_PROGRESS_STATUSES = new Set([
  ACCEPTED_AWAITING_ARRIVAL_STATUS,
  ACCEPTED_ARRIVED_AWAITING_SKU_STATUS,
  ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS,
  TESTING_IN_PROGRESS_STATUS,
  PHOTOGRAPHY_IN_PROGRESS_STATUS,
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
  'Submission Group ID',
  'Pick Up ID',
  'Workflow Owner',
  'Testing Signed By',
  'Testing Signed At',
  'Photography Signed By',
  'Photography Signed At',
] as const;

interface LoadUsedGearWorkflowNotificationSummaryOptions {
  currentUserName?: string | null;
  includeAssignedToCurrentUser?: boolean;
  includeUnassigned?: boolean;
}

export type UsedGearWorkflowNotificationCounts = Record<UsedGearWorkflowNotificationEvent, number>;

export interface UsedGearWorkflowNotificationTarget {
  destinationTab: 'inventory' | 'parking-lot' | 'jotform' | 'testing-queue' | 'photography-queue' | 'listings';
  recordId: string | null;
  sectionId: string | null;
  groupId?: string | null;
  path?: string | null;
}

export type UsedGearWorkflowNotificationTargets = Record<UsedGearWorkflowNotificationEvent, UsedGearWorkflowNotificationTarget | null>;

export interface UsedGearWorkflowNotificationSummary {
  counts: UsedGearWorkflowNotificationCounts;
  targets: UsedGearWorkflowNotificationTargets;
  workflowQueueBadgeCount: number;
  listingsBadgeCount: number;
}

export interface UsedGearWorkflowPostPublishSummary {
  activeListingCount: number;
  staleListingCount: number;
  staleListingMineCount: number;
  soldReadyCount: number;
  soldReadyMineCount: number;
  shippedCount: number;
  staleListingUnassignedCount: number;
  soldReadyUnassignedCount: number;
  totalCount: number;
}

export interface SaveUsedGearWorkflowStaleRecoveryInput {
  staleRecoveryStatus: UsedGearWorkflowStaleRecoveryStatus | null;
  staleRecoveryNotes: string | null;
}

export interface SaveUsedGearWorkflowShipmentFollowThroughInput {
  shipmentFollowThroughNotes: string | null;
}

export interface SavePendingReviewRecordReviewInput {
  qualificationNotes: string;
  arrivalDate: string;
  sku: string;
}

function normalizeOwnerName(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Workflow owner requires a non-empty user name.');
  }
  return normalized;
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

function createEmptyWorkflowNotificationTargets(): UsedGearWorkflowNotificationTargets {
  return {
    pendingReview: null,
    processing: null,
    testing: null,
    photography: null,
    preListingReview: null,
    approvedForPublish: null,
  };
}

export function createEmptyUsedGearWorkflowNotificationSummary(): UsedGearWorkflowNotificationSummary {
  return {
    counts: createEmptyWorkflowNotificationCounts(),
    targets: createEmptyWorkflowNotificationTargets(),
    workflowQueueBadgeCount: 0,
    listingsBadgeCount: 0,
  };
}

function normalizeWorkflowNotificationOwner(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function shouldIncludeWorkflowNotificationRecord(
  record: AirtableRecord,
  options?: LoadUsedGearWorkflowNotificationSummaryOptions,
): boolean {
  const currentUserName = options?.currentUserName?.trim() ?? '';
  if (!currentUserName) {
    return true;
  }

  const workflowOwner = normalizeWorkflowNotificationOwner(record.fields['Workflow Owner']);
  if (!workflowOwner) {
    return options?.includeUnassigned !== false;
  }

  if (workflowOwner === currentUserName) {
    return options?.includeAssignedToCurrentUser !== false;
  }

  return false;
}

export function createEmptyUsedGearWorkflowPostPublishSummary(): UsedGearWorkflowPostPublishSummary {
  return {
    activeListingCount: 0,
    staleListingCount: 0,
    staleListingMineCount: 0,
    soldReadyCount: 0,
    soldReadyMineCount: 0,
    shippedCount: 0,
    staleListingUnassignedCount: 0,
    soldReadyUnassignedCount: 0,
    totalCount: 0,
  };
}

function getNotificationGroupId(record: AirtableRecord): string | null {
  const group = groupKeyForRecord(record);
  return group.description === 'Single record' ? null : group.key;
}

function buildNotificationTarget(
  record: AirtableRecord,
  destinationTab: UsedGearWorkflowNotificationTarget['destinationTab'],
  sectionId: string,
  groupParamName?: 'workflowPendingReviewGroup' | 'workflowProgressGroup' | 'workflowParkingLotGroup' | 'workflowTestingQueueGroup' | 'workflowPhotographyQueueGroup' | 'workflowPreListingQueueGroup',
  alwaysBuildSectionPath = false,
): UsedGearWorkflowNotificationTarget {
  const groupId = getNotificationGroupId(record);
  const basePath = destinationTab === 'inventory'
    ? '/workflow-hub'
    : destinationTab === 'parking-lot'
      ? '/parking-lot'
      : destinationTab === 'jotform'
        ? '/jotform'
        : destinationTab === 'testing-queue'
          ? '/testing'
          : destinationTab === 'photography-queue'
            ? '/photography'
            : null;

  return {
    destinationTab,
    recordId: groupId ? null : record.id,
    sectionId,
    groupId,
    path: basePath
      ? groupId && groupParamName
        ? `${basePath}?${groupParamName}=${encodeURIComponent(groupId)}#${sectionId}`
        : alwaysBuildSectionPath
          ? `${basePath}#${sectionId}`
          : null
      : null,
  };
}

export interface UsedGearWorkflowGroup {
  id: string;
  key: string;
  label: string;
  description: string;
  records: AirtableRecord[];
}

export interface UsedGearOperationalRecordContext {
  record: AirtableRecord;
  group: UsedGearWorkflowGroup | null;
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

export interface SaveParkingLotArrivalReviewInput {
  arrivalDate: string;
  sku: string;
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

function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableCurrency(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function mergeConfiguredRecordFields(
  baseRecords: AirtableRecord[],
  supplementalRecords: AirtableRecord[],
): AirtableRecord[] {
  const supplementalFieldsById = new Map(
    supplementalRecords.map((record) => [record.id, record.fields]),
  );

  return baseRecords.map((record) => {
    const supplementalFields = supplementalFieldsById.get(record.id);
    if (!supplementalFields) {
      return record;
    }

    return {
      ...record,
      fields: {
        ...record.fields,
        ...supplementalFields,
      },
    };
  });
}

async function loadUsedGearOperationalRecords(options?: { includeOptionalReadFields?: boolean }): Promise<AirtableRecord[]> {
  const requiredRecords = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_REQUIRED_RECORD_FIELDS],
  });

  if (!options?.includeOptionalReadFields) {
    return requiredRecords;
  }

  try {
    const optionalRecords = await getConfiguredRecords('used-gear-workflow', {
      fields: [...USED_GEAR_WORKFLOW_OPTIONAL_READ_FIELDS],
    });

    return mergeConfiguredRecordFields(requiredRecords, optionalRecords);
  } catch {
    return requiredRecords;
  }
}

function normalizeAllocationText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function normalizeTextAreaValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

async function updateWorkflowOwnerFields(
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    fields,
    { typecast: true },
  );

  return withWorkflow(record);
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
      key: pickupId,
      label: pickupId,
      description: 'Pickup group',
    };
  }

  const submissionGroupId = getTrimmedFieldValue(record, 'Submission Group ID');
  if (submissionGroupId) {
    return {
      key: submissionGroupId,
      label: submissionGroupId,
      description: 'Submission group',
    };
  }

  return {
    key: record.id,
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

export function isParkingLotArrivalStageStatus(status: string | null | undefined): boolean {
  return Boolean(status && USED_GEAR_ARRIVAL_STAGE_STATUSES.has(status));
}

export function isParkingLotStatus(status: string | null | undefined): boolean {
  return Boolean(status && USED_GEAR_PARKING_LOT_STATUSES.has(status));
}

export async function loadParkingLotQueue(): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_PENDING_REVIEW_QUEUE_FIELDS],
  });

  return records
    .map(withWorkflow)
    .filter((record) => isParkingLotStatus(getUsedGearWorkflowStatus(record.fields)));
}

export async function loadWorkflowHubDirectory(): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_PENDING_REVIEW_QUEUE_FIELDS],
  });

  return records.map(withWorkflow);
}

export async function loadPendingReviewGroup(groupId: string): Promise<UsedGearWorkflowGroup> {
  const groups = groupUsedGearWorkflowRecords(await loadPendingReviewQueue());
  const group = groups.find((candidate) => candidate.id === groupId);

  if (!group) {
    throw new Error('Unable to load the selected pending-review group.');
  }

  return group;
}

export async function loadUsedGearOperationalRecordBySku(sku: string): Promise<AirtableRecord> {
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
    throw new Error(`No used-gear operational row was found for SKU ${sku.trim()}.`);
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

export async function loadTrashGroup(groupId: string): Promise<UsedGearWorkflowGroup> {
  const groups = groupUsedGearWorkflowRecords(await loadTrashQueue());
  const group = groups.find((candidate) => candidate.id === groupId && candidate.records.length > 1);

  if (!group) {
    throw new Error('Unable to load the selected Trash Review group.');
  }

  return group;
}

export async function loadParkingLotArrivalQueue(): Promise<AirtableRecord[]> {
  const records = await loadUsedGearOperationalRecords();

  return records
    .map(withWorkflow)
    .filter((record) => {
      const status = getUsedGearWorkflowStatus(record.fields);
      return isParkingLotArrivalStageStatus(status);
    });
}

export async function loadParkingLotArrivalGroup(groupId: string): Promise<UsedGearWorkflowGroup> {
  const groups = groupUsedGearWorkflowRecords(await loadParkingLotArrivalQueue());
  const group = groups.find((candidate) => candidate.id === groupId);

  if (!group) {
    throw new Error('Unable to load the selected Parking Lot group.');
  }

  return group;
}

export async function saveParkingLotArrivalReviewRecord(
  recordId: string,
  { arrivalDate, sku }: SaveParkingLotArrivalReviewInput,
): Promise<AirtableRecord> {
  const normalizedArrivalDate = arrivalDate.trim();
  const normalizedSku = sku.trim();

  if (normalizedSku && !normalizedArrivalDate) {
    throw new Error('Arrival Date is required before saving a SKU in Parking Lot.');
  }

  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      'Arrival Date': trimToNull(normalizedArrivalDate),
      SKU: trimToNull(normalizedSku),
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function savePendingReviewRecordReview(
  recordId: string,
  { qualificationNotes, arrivalDate, sku }: SavePendingReviewRecordReviewInput,
): Promise<AirtableRecord> {
  const normalizedArrivalDate = arrivalDate.trim();
  const normalizedSku = sku.trim();

  if (normalizedSku && !normalizedArrivalDate) {
    throw new Error('Arrival Date is required before saving a SKU in Parking Lot.');
  }

  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      'Qualification Notes': trimToNull(qualificationNotes),
      'Arrival Date': trimToNull(normalizedArrivalDate),
      SKU: trimToNull(normalizedSku),
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function loadWorkflowProgressQueue(): Promise<AirtableRecord[]> {
  const records = await loadUsedGearOperationalRecords();

  return records
    .map(withWorkflow)
    .filter((record) => {
      const status = getUsedGearWorkflowStatus(record.fields);
      return Boolean(status && USED_GEAR_PROGRESS_STATUSES.has(status));
    });
}

export async function loadWorkflowPostPublishQueue(): Promise<AirtableRecord[]> {
  const records = await loadUsedGearOperationalRecords();

  return records
    .map(withWorkflow)
    .filter((record) => {
      const status = getUsedGearWorkflowStatus(record.fields);
      return Boolean(status && USED_GEAR_POST_PUBLISH_STATUSES.has(status));
    });
}

export function summarizeUsedGearWorkflowPostPublishQueue(
  records: AirtableRecord[],
  currentUserName?: string,
): UsedGearWorkflowPostPublishSummary {
  const normalizedCurrentUserName = currentUserName?.trim().toLowerCase() ?? '';

  return records.reduce<UsedGearWorkflowPostPublishSummary>((summary, record) => {
    const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
    const workflowOwner = getTrimmedFieldValue(record, 'Workflow Owner');
    const workflowOwnerMatchesCurrentUser = Boolean(
      normalizedCurrentUserName.length > 0
      && workflowOwner.trim().toLowerCase() === normalizedCurrentUserName,
    );
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
      if (workflowOwnerMatchesCurrentUser) {
        summary.staleListingMineCount += 1;
      }
      if (!workflowOwner) {
        summary.staleListingUnassignedCount += 1;
      }
      return summary;
    }

    if (snapshot.bucket === 'sold-ready') {
      summary.soldReadyCount += 1;
      if (workflowOwnerMatchesCurrentUser) {
        summary.soldReadyMineCount += 1;
      }
      if (!workflowOwner) {
        summary.soldReadyUnassignedCount += 1;
      }
      return summary;
    }

    summary.shippedCount += 1;
    return summary;
  }, createEmptyUsedGearWorkflowPostPublishSummary());
}

export async function loadUsedGearOperationalRecord(recordId: string): Promise<AirtableRecord> {
  const records = await loadUsedGearOperationalRecords({ includeOptionalReadFields: true });

  const record = records.find((candidate) => candidate.id === recordId);
  if (!record) {
    throw new Error('Unable to load the selected used-gear operational record.');
  }

  return withWorkflow(record);
}

export async function loadUsedGearOperationalRecordContext(recordId: string): Promise<UsedGearOperationalRecordContext> {
  const records = (await loadUsedGearOperationalRecords({ includeOptionalReadFields: true })).map(withWorkflow);

  const record = records.find((candidate) => candidate.id === recordId);
  if (!record) {
    throw new Error('Unable to load the selected used-gear operational record.');
  }

  const group = groupUsedGearWorkflowRecords(records).find((candidate) => candidate.id === groupKeyForRecord(record).key) ?? null;

  return {
    record,
    group: group && group.records.length > 1 ? group : null,
  };
}

export async function loadUsedGearWorkflowNotificationSummary(
  options?: LoadUsedGearWorkflowNotificationSummaryOptions,
): Promise<UsedGearWorkflowNotificationSummary> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [...USED_GEAR_WORKFLOW_NOTIFICATION_FIELDS],
  });

  const sortedRecords = [...records].sort((left, right) => left.createdTime.localeCompare(right.createdTime));
  const summary = createEmptyUsedGearWorkflowNotificationSummary();
  const inventoryActionableRecordIds = new Set<string>();
  const approvedForPublishRecordIds = new Set<string>();

  sortedRecords.forEach((record) => {
    if (!shouldIncludeWorkflowNotificationRecord(record, options)) {
      return;
    }

    const status = getUsedGearWorkflowStatus(record.fields);
    if (!status) {
      return;
    }

    if (status === PENDING_REVIEW_STATUS) {
      summary.counts.pendingReview += 1;
      inventoryActionableRecordIds.add(record.id);
      summary.targets.pendingReview ??= buildNotificationTarget(record, 'parking-lot', 'used-gear-pending-review', 'workflowPendingReviewGroup', true);
      return;
    }

    if (isParkingLotArrivalStageStatus(status)) {
      summary.counts.processing += 1;
      inventoryActionableRecordIds.add(record.id);
      summary.targets.processing ??= buildNotificationTarget(record, 'parking-lot', 'used-gear-parking-lot', 'workflowParkingLotGroup', true);
      return;
    }

    if (status === TESTING_IN_PROGRESS_STATUS) {
      summary.counts.testing += 1;
      inventoryActionableRecordIds.add(record.id);
      summary.targets.testing ??= buildNotificationTarget(record, 'testing-queue', 'used-gear-testing-queue', 'workflowTestingQueueGroup', true);
      return;
    }

    if (status === PHOTOGRAPHY_IN_PROGRESS_STATUS) {
      summary.counts.photography += 1;
      inventoryActionableRecordIds.add(record.id);
      summary.targets.photography ??= buildNotificationTarget(record, 'photography-queue', 'used-gear-photography-queue', 'workflowPhotographyQueueGroup', true);
      return;
    }

    if (status === AWAITING_PRE_LISTING_REVIEW_STATUS) {
      summary.counts.preListingReview += 1;
      summary.targets.preListingReview ??= {
        destinationTab: 'listings',
        recordId: record.id,
        sectionId: null,
        groupId: null,
        path: null,
      };
      return;
    }

    if (status === APPROVED_FOR_PUBLISH_STATUS) {
      summary.counts.approvedForPublish += 1;
      approvedForPublishRecordIds.add(record.id);
      summary.targets.approvedForPublish ??= {
        destinationTab: 'listings',
        recordId: record.id,
        sectionId: null,
        groupId: null,
        path: null,
      };
    }

    return;
  });

  summary.workflowQueueBadgeCount = inventoryActionableRecordIds.size;
  summary.listingsBadgeCount = approvedForPublishRecordIds.size;
  return summary;
}

export async function loadUsedGearWorkflowNotificationCounts(): Promise<UsedGearWorkflowNotificationCounts> {
  return (await loadUsedGearWorkflowNotificationSummary()).counts;
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
    throw new Error('Qualification Notes are required before routing a pending-review row into Parking Lot.');
  }

  const currentRecord = await getConfiguredRecord('used-gear-workflow', recordId);
  if (!hasUsedGearPendingReviewPricingPath(currentRecord.fields)) {
    throw new Error('Offer Amount, Paid Amount, or Confirmed Grand Total is required before routing a pending-review row into Parking Lot.');
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
    throw new Error('Submission Group ID is required before routing a multi-item intake review into Parking Lot.');
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

export async function markPendingReviewGroupUnqualified(recordIds: string[], reason: string): Promise<AirtableRecord[]> {
  if (recordIds.length === 0) {
    throw new Error('Pending-review group unqualification requires at least one intake row.');
  }

  const updatedRecords: AirtableRecord[] = [];

  for (const recordId of recordIds) {
    updatedRecords.push(await markPendingReviewUnqualified(recordId, reason));
  }

  return updatedRecords;
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

export async function assignWorkflowOwner(recordId: string, ownerName: string): Promise<AirtableRecord> {
  const normalizedOwnerName = normalizeOwnerName(ownerName);

  return updateWorkflowOwnerFields(recordId, {
    'Workflow Owner': normalizedOwnerName,
    'Workflow Owner Assigned At': new Date().toISOString(),
  });
}

export async function clearWorkflowOwner(recordId: string): Promise<AirtableRecord> {
  return updateWorkflowOwnerFields(recordId, {
    'Workflow Owner': null,
    'Workflow Owner Assigned At': null,
  });
}

export async function assignWorkflowOwnerBatch(recordIds: string[], ownerName: string): Promise<AirtableRecord[]> {
  if (recordIds.length === 0) {
    throw new Error('Assigning workflow ownership requires at least one row.');
  }

  const normalizedOwnerName = normalizeOwnerName(ownerName);
  const updatedRecords: AirtableRecord[] = [];

  for (const recordId of recordIds) {
    updatedRecords.push(await assignWorkflowOwner(recordId, normalizedOwnerName));
  }

  return updatedRecords;
}

export async function clearWorkflowOwnerBatch(recordIds: string[]): Promise<AirtableRecord[]> {
  if (recordIds.length === 0) {
    throw new Error('Clearing workflow ownership requires at least one row.');
  }

  const updatedRecords: AirtableRecord[] = [];

  for (const recordId of recordIds) {
    updatedRecords.push(await clearWorkflowOwner(recordId));
  }

  return updatedRecords;
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
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: TESTING_IN_PROGRESS_STATUS,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function completePreListingReviewStage(recordId: string, userName: string): Promise<AirtableRecord> {
  const normalizedUserName = userName.trim();
  if (!normalizedUserName) {
    throw new Error('Listing review requires the current user name.');
  }

  const currentRecord = await loadUsedGearOperationalRecord(recordId);
  const currentStatus = getUsedGearWorkflowStatus(currentRecord.fields);
  if (currentStatus !== AWAITING_PRE_LISTING_REVIEW_STATUS) {
    throw new Error('Listing review can only be completed when the row is awaiting listing review.');
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
    case TESTING_IN_PROGRESS_STATUS:
      return 'Testing';
    case PHOTOGRAPHY_IN_PROGRESS_STATUS:
      return 'Photography';
    case AWAITING_PRE_LISTING_REVIEW_STATUS:
      return 'Listing Review';
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
  const currentRecord = await loadUsedGearOperationalRecord(recordId);
  const snapshot = getUsedGearWorkflowPostPublishSnapshot(currentRecord);
  if (!snapshot || (snapshot.status !== LISTED_SHOPIFY_STATUS && snapshot.status !== LISTED_EBAY_STATUS && snapshot.status !== STALE_LISTING_SHOPIFY_STATUS && snapshot.status !== STALE_LISTING_EBAY_STATUS)) {
    throw new Error('Only active listed operational rows can be moved into the stale listing queue.');
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

export async function saveWorkflowStaleRecovery(
  recordId: string,
  { staleRecoveryStatus, staleRecoveryNotes }: SaveUsedGearWorkflowStaleRecoveryInput,
): Promise<AirtableRecord> {
  const currentRecord = await loadUsedGearOperationalRecord(recordId);
  const snapshot = getUsedGearWorkflowPostPublishSnapshot(currentRecord);
  if (!snapshot || (snapshot.status !== STALE_LISTING_SHOPIFY_STATUS && snapshot.status !== STALE_LISTING_EBAY_STATUS)) {
    throw new Error('Only stale operational rows can save stale recovery details.');
  }

  if (staleRecoveryStatus && !isUsedGearWorkflowStaleRecoveryStatus(staleRecoveryStatus)) {
    throw new Error('Stale Recovery Status is not one of the approved recovery options.');
  }

  const recoveryUpdatedAt = new Date().toISOString();
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      'Stale Recovery Status': staleRecoveryStatus,
      'Stale Recovery Notes': normalizeTextAreaValue(staleRecoveryNotes),
      'Stale Recovery Updated At': recoveryUpdatedAt,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function markWorkflowRelisted(recordId: string): Promise<AirtableRecord> {
  const currentRecord = await loadUsedGearOperationalRecord(recordId);
  const snapshot = getUsedGearWorkflowPostPublishSnapshot(currentRecord);
  if (!snapshot || (snapshot.status !== STALE_LISTING_SHOPIFY_STATUS && snapshot.status !== STALE_LISTING_EBAY_STATUS)) {
    throw new Error('Only stale operational rows can be marked relisted.');
  }

  const relistedAt = new Date().toISOString();
  const nextStatus = snapshot.channel === 'ebay' ? LISTED_EBAY_STATUS : LISTED_SHOPIFY_STATUS;
  const existingRecoveryStatus = getTrimmedFieldValue(currentRecord, 'Stale Recovery Status');
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: nextStatus,
      'Relisted At': getTrimmedFieldValue(currentRecord, 'Relisted At') || relistedAt,
      'Stale Recovery Updated At': relistedAt,
      'Stale Recovery Status': existingRecoveryStatus || 'Ready To Relist',
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function markWorkflowSoldReadyToShip(recordId: string): Promise<AirtableRecord> {
  const currentRecord = await loadUsedGearOperationalRecord(recordId);
  const snapshot = getUsedGearWorkflowPostPublishSnapshot(currentRecord);
  if (!snapshot || (snapshot.bucket !== 'active-listing' && snapshot.bucket !== 'stale-listing')) {
    throw new Error('Only listed operational rows can move into sold-ready-to-ship.');
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

export async function saveWorkflowShipmentFollowThrough(
  recordId: string,
  { shipmentFollowThroughNotes }: SaveUsedGearWorkflowShipmentFollowThroughInput,
): Promise<AirtableRecord> {
  const currentRecord = await loadUsedGearOperationalRecord(recordId);
  const currentStatus = getUsedGearWorkflowStatus(currentRecord.fields);
  if (currentStatus !== SOLD_READY_TO_SHIP_STATUS && currentStatus !== SHIPPED_STATUS) {
    throw new Error('Only sold-ready or shipped operational rows can save shipment follow-through notes.');
  }

  const shipmentFollowThroughUpdatedAt = new Date().toISOString();
  const record = await updateConfiguredRecord(
    'used-gear-workflow',
    recordId,
    {
      'Shipment Follow-Through Notes': normalizeTextAreaValue(shipmentFollowThroughNotes),
      'Shipment Follow-Through Updated At': shipmentFollowThroughUpdatedAt,
    },
    { typecast: true },
  );

  return withWorkflow(record);
}

export async function markWorkflowRowsSoldReadyToShip(recordIds: string[]): Promise<AirtableRecord[]> {
  if (recordIds.length === 0) {
    throw new Error('At least one operational row must be selected to mark sold ready.');
  }

  const updatedRecords: AirtableRecord[] = [];

  for (const recordId of recordIds) {
    updatedRecords.push(await markWorkflowSoldReadyToShip(recordId));
  }

  return updatedRecords;
}

export async function markWorkflowShipped(recordId: string): Promise<AirtableRecord> {
  const currentRecord = await loadUsedGearOperationalRecord(recordId);
  const currentStatus = getUsedGearWorkflowStatus(currentRecord.fields);
  if (currentStatus !== SOLD_READY_TO_SHIP_STATUS) {
    throw new Error('Only sold-ready-to-ship operational rows can be marked shipped.');
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

export async function markWorkflowRowsShipped(recordIds: string[]): Promise<AirtableRecord[]> {
  if (recordIds.length === 0) {
    throw new Error('At least one operational row must be selected to mark shipped.');
  }

  const updatedRecords: AirtableRecord[] = [];

  for (const recordId of recordIds) {
    updatedRecords.push(await markWorkflowShipped(recordId));
  }

  return updatedRecords;
}
