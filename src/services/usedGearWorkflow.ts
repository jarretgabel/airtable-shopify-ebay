import type { AirtableRecord } from '@/types/airtable';

export const USED_GEAR_WORKFLOW_STATUSES = [
  'Pending Review',
  'Unqualified',
  'Accepted - Awaiting Arrival',
  'Accepted - Arrived, Awaiting SKU',
  'Accepted - Arrived, Awaiting Missing Item',
  'Testing In Progress',
  'Photography In Progress',
  'Awaiting Pre-Listing Review',
  'Approved for Publish',
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
  'Sold - Ready to Ship',
  'Shipped',
] as const;

export type UsedGearWorkflowStatus = (typeof USED_GEAR_WORKFLOW_STATUSES)[number];

export const USED_GEAR_WORKFLOW_TEAMS = [
  'Purchasing',
  'Processing',
  'Testing',
  'Photography',
  'Listing',
  'Shipping',
] as const;

export type UsedGearWorkflowTeam = (typeof USED_GEAR_WORKFLOW_TEAMS)[number];
export type UsedGearIntakeDecision = 'Pending' | 'Accepted' | 'Unqualified';

export const USED_GEAR_WORKFLOW_STATUS_FIELD = 'Workflow Status';
export const USED_GEAR_WORKFLOW_INTAKE_DECISION_FIELD = 'Workflow Intake Decision';
export const USED_GEAR_WORKFLOW_NEXT_TEAM_FIELD = 'Workflow Next Team';

const USED_GEAR_WORKFLOW_SIGNOFF_FIELDS = {
  processing: {
    signedBy: 'Processing Signed By',
    signedAt: 'Processing Signed At',
  },
  testing: {
    signedBy: 'Testing Signed By',
    signedAt: 'Testing Signed At',
  },
  photography: {
    signedBy: 'Photography Signed By',
    signedAt: 'Photography Signed At',
  },
  'pre-listing': {
    signedBy: 'Pre-Listing Reviewed By',
    signedAt: 'Pre-Listing Reviewed At',
  },
} as const;

export type UsedGearWorkflowStage = keyof typeof USED_GEAR_WORKFLOW_SIGNOFF_FIELDS;

export interface UsedGearConcurrentStageSignoffs {
  testingSignedBy?: string | null;
  testingSignedAt?: string | null;
  photographySignedBy?: string | null;
  photographySignedAt?: string | null;
}

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function getTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function isUsedGearWorkflowStatus(value: string): value is UsedGearWorkflowStatus {
  return (USED_GEAR_WORKFLOW_STATUSES as readonly string[]).includes(value);
}

export function getUsedGearWorkflowStatus(fields: Record<string, unknown>): UsedGearWorkflowStatus | null {
  const rawStatus = getTrimmedString(fields[USED_GEAR_WORKFLOW_STATUS_FIELD]);
  return rawStatus && isUsedGearWorkflowStatus(rawStatus) ? rawStatus : null;
}

export function deriveUsedGearIntakeDecision(status: UsedGearWorkflowStatus): UsedGearIntakeDecision {
  if (status === 'Pending Review') return 'Pending';
  if (status === 'Unqualified') return 'Unqualified';
  return 'Accepted';
}

export function isAcceptedUsedGearWorkflowStatus(status: UsedGearWorkflowStatus): boolean {
  return deriveUsedGearIntakeDecision(status) === 'Accepted';
}

export function hasTestingSignoff(signoffs: UsedGearConcurrentStageSignoffs): boolean {
  return hasValue(signoffs.testingSignedBy) && hasValue(signoffs.testingSignedAt);
}

export function hasPhotographySignoff(signoffs: UsedGearConcurrentStageSignoffs): boolean {
  return hasValue(signoffs.photographySignedBy) && hasValue(signoffs.photographySignedAt);
}

export function canEnterAwaitingPreListingReview(signoffs: UsedGearConcurrentStageSignoffs): boolean {
  return hasTestingSignoff(signoffs) && hasPhotographySignoff(signoffs);
}

export function buildUsedGearConcurrentStageSignoffs(fields: Record<string, unknown>): UsedGearConcurrentStageSignoffs {
  return {
    testingSignedBy: getTrimmedString(fields['Testing Signed By']),
    testingSignedAt: getTrimmedString(fields['Testing Signed At']),
    photographySignedBy: getTrimmedString(fields['Photography Signed By']),
    photographySignedAt: getTrimmedString(fields['Photography Signed At']),
  };
}

export function getUsedGearWorkflowSignoffFieldNames(stage: UsedGearWorkflowStage) {
  return USED_GEAR_WORKFLOW_SIGNOFF_FIELDS[stage];
}

export function deriveUsedGearNextTeams(
  status: UsedGearWorkflowStatus,
  signoffs: UsedGearConcurrentStageSignoffs = {},
): UsedGearWorkflowTeam[] {
  void signoffs;

  switch (status) {
    case 'Pending Review':
      return ['Purchasing'];
    case 'Accepted - Awaiting Arrival':
    case 'Accepted - Arrived, Awaiting SKU':
    case 'Accepted - Arrived, Awaiting Missing Item':
      return ['Processing'];
    case 'Testing In Progress':
      return ['Testing'];
    case 'Photography In Progress':
      return ['Photography'];
    case 'Awaiting Pre-Listing Review':
    case 'Approved for Publish':
    case 'Stale Listing, Shopify':
    case 'Stale Listing, eBay':
      return ['Listing'];
    case 'Sold - Ready to Ship':
      return ['Shipping'];
    case 'Unqualified':
    case 'Listed, Shopify':
    case 'Listed, eBay':
    case 'Shipped':
      return [];
  }
}

export function enrichUsedGearWorkflowFields(fields: Record<string, unknown>): Record<string, unknown> {
  const status = getUsedGearWorkflowStatus(fields);
  if (!status) {
    return fields;
  }

  const signoffs = buildUsedGearConcurrentStageSignoffs(fields);
  const nextTeams = deriveUsedGearNextTeams(status, signoffs);

  return {
    ...fields,
    [USED_GEAR_WORKFLOW_INTAKE_DECISION_FIELD]: deriveUsedGearIntakeDecision(status),
    [USED_GEAR_WORKFLOW_NEXT_TEAM_FIELD]: nextTeams.join(', '),
  };
}

export function enrichUsedGearWorkflowRecord(record: AirtableRecord): AirtableRecord {
  return {
    ...record,
    fields: enrichUsedGearWorkflowFields(record.fields),
  };
}
