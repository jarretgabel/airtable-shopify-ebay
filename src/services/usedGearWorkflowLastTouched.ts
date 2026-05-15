import type { AirtableRecord } from '@/types/airtable';
import { getUsedGearWorkflowPostPublishSnapshot } from '@/services/usedGearWorkflowLifecycle';

export interface UsedGearWorkflowLastTouchedSummary {
  description: string;
  timestamp: string;
  actionLabel: string;
  actionTarget: 'review-record' | 'workflow-record' | 'listings-record';
}

interface LastTouchedCandidate {
  description: string;
  timestamp: string;
  actionLabel: string;
  actionTarget: UsedGearWorkflowLastTouchedSummary['actionTarget'];
}

function getTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getIsoTimestamp(value: unknown): string | null {
  const normalized = getTrimmedString(value);
  if (!normalized) {
    return null;
  }

  return Number.isFinite(Date.parse(normalized)) ? normalized : null;
}

function formatTimestamp(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return timestamp;
  }

  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function createCandidate(
  timestampValue: unknown,
  description: string,
  actionLabel: LastTouchedCandidate['actionLabel'],
  actionTarget: LastTouchedCandidate['actionTarget'],
): LastTouchedCandidate | null {
  const timestamp = getIsoTimestamp(timestampValue);
  if (!timestamp) {
    return null;
  }

  return { description, timestamp, actionLabel, actionTarget };
}

function chooseLatest(
  candidates: Array<LastTouchedCandidate | null>,
  fallbackDescription: string,
  fallbackActionLabel: string,
  fallbackActionTarget: UsedGearWorkflowLastTouchedSummary['actionTarget'],
  createdTime: string,
): UsedGearWorkflowLastTouchedSummary {
  const createdTimestamp = getIsoTimestamp(createdTime) ?? createdTime;
  const latest = candidates
    .filter((candidate): candidate is LastTouchedCandidate => candidate !== null)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))[0]
    ?? {
      description: fallbackDescription,
      timestamp: createdTimestamp,
      actionLabel: fallbackActionLabel,
      actionTarget: fallbackActionTarget,
    };

  return {
    description: latest.description,
    timestamp: formatTimestamp(latest.timestamp),
    actionLabel: latest.actionLabel,
    actionTarget: latest.actionTarget,
  };
}

export function buildPendingReviewLastTouchedSummary(record: AirtableRecord): UsedGearWorkflowLastTouchedSummary {
  const workflowOwner = getTrimmedString(record.fields['Workflow Owner']);

  return chooseLatest([
    createCandidate(
      record.fields['Workflow Owner Assigned At'],
      workflowOwner ? `Owner assigned to ${workflowOwner}` : 'Owner assignment updated',
      'Open Review',
      'review-record',
    ),
  ], 'Workflow row created', 'Open Review', 'review-record', record.createdTime);
}

export function buildWorkflowProgressLastTouchedSummary(record: AirtableRecord): UsedGearWorkflowLastTouchedSummary {
  const workflowOwner = getTrimmedString(record.fields['Workflow Owner']);
  const acceptedBy = getTrimmedString(record.fields['Accepted By']);
  const processingSignedBy = getTrimmedString(record.fields['Processing Signed By']);
  const testingSignedBy = getTrimmedString(record.fields['Testing Signed By']);
  const photographySignedBy = getTrimmedString(record.fields['Photography Signed By']);

  return chooseLatest([
    createCandidate(
      record.fields['Workflow Owner Assigned At'],
      workflowOwner ? `Owner assigned to ${workflowOwner}` : 'Owner assignment updated',
      'Open Stage Review',
      'workflow-record',
    ),
    createCandidate(
      record.fields['Awaiting Pre-Listing Review At'],
      'Moved to pre-listing review',
      'Open Listings Approval',
      'listings-record',
    ),
    createCandidate(
      record.fields['Photography Signed At'],
      photographySignedBy ? `Photography signed by ${photographySignedBy}` : 'Photography signed',
      'Open Stage Review',
      'workflow-record',
    ),
    createCandidate(
      record.fields['Testing Signed At'],
      testingSignedBy ? `Testing signed by ${testingSignedBy}` : 'Testing signed',
      'Open Stage Review',
      'workflow-record',
    ),
    createCandidate(
      record.fields['Processing Signed At'],
      processingSignedBy ? `Processing signed by ${processingSignedBy}` : 'Processing signed',
      'Open Stage Review',
      'workflow-record',
    ),
    createCandidate(
      record.fields['Accepted At'],
      acceptedBy ? `Intake accepted by ${acceptedBy}` : 'Intake accepted',
      'Open Stage Review',
      'workflow-record',
    ),
  ], 'Workflow row created', 'Open Stage Review', 'workflow-record', record.createdTime);
}

export function buildPostPublishLastTouchedSummary(record: AirtableRecord): UsedGearWorkflowLastTouchedSummary {
  const snapshot = getUsedGearWorkflowPostPublishSnapshot(record);
  const workflowOwner = getTrimmedString(record.fields['Workflow Owner']);
  const staleRecoveryStatus = getTrimmedString(record.fields['Stale Recovery Status']);

  return chooseLatest([
    createCandidate(
      record.fields['Workflow Owner Assigned At'],
      workflowOwner ? `Owner assigned to ${workflowOwner}` : 'Owner assignment updated',
      'Open Workflow Record',
      'workflow-record',
    ),
    createCandidate(
      snapshot?.staleRecoveryUpdatedAt,
      staleRecoveryStatus ? `Stale recovery updated: ${staleRecoveryStatus}` : 'Stale recovery updated',
      'Open Workflow Record',
      'workflow-record',
    ),
    createCandidate(
      snapshot?.shipmentFollowThroughUpdatedAt,
      'Shipment follow-through updated',
      'Open Workflow Record',
      'workflow-record',
    ),
    createCandidate(snapshot?.shippedAt, 'Marked shipped', 'Open Workflow Record', 'workflow-record'),
    createCandidate(snapshot?.soldReadyToShipAt, 'Marked sold ready', 'Open Workflow Record', 'workflow-record'),
    createCandidate(snapshot?.relistedAt, 'Marked relisted', 'Open Listings Approval', 'listings-record'),
    createCandidate(snapshot?.staleListingAt, 'Marked stale', 'Open Workflow Record', 'workflow-record'),
    createCandidate(snapshot?.listedAt, 'Marked listed', 'Open Listings Approval', 'listings-record'),
  ], 'Workflow row created', 'Open Workflow Record', 'workflow-record', record.createdTime);
}