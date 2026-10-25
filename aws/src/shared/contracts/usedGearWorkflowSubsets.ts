/** Workflow Status values selected server-side by the used-gear-workflow `workflow-progress` and `parking-lot-arrival` subsets. */
export const USED_GEAR_ARRIVAL_STAGE_STATUS_VALUES = [
  'Accepted - Awaiting Arrival',
  'Accepted - Arrived, Awaiting SKU',
  'Accepted - Arrived, Awaiting Missing Item',
] as const;

export const USED_GEAR_PROGRESS_STATUS_VALUES = [
  ...USED_GEAR_ARRIVAL_STAGE_STATUS_VALUES,
  'Testing In Progress',
  'Photography In Progress',
] as const;

export const USED_GEAR_PENDING_REVIEW_STATUS_VALUES = ['Pending Review'] as const;

export const USED_GEAR_PARKING_LOT_STATUS_VALUES = [
  ...USED_GEAR_PENDING_REVIEW_STATUS_VALUES,
  ...USED_GEAR_ARRIVAL_STAGE_STATUS_VALUES,
] as const;

export const USED_GEAR_TRASH_REVIEW_STATUS_VALUES = ['Unqualified'] as const;
