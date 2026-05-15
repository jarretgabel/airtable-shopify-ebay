import {
  groupUsedGearWorkflowRecords,
  loadPendingReviewQueue,
  loadWorkflowProgressQueue,
} from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

export interface UsedGearWorkflowDashboardTargetGroup {
  id: string | null;
  label: string | null;
}

export interface UsedGearWorkflowDashboardTargets {
  pendingReviewOldestGroup: UsedGearWorkflowDashboardTargetGroup;
  progressOldestGroup: UsedGearWorkflowDashboardTargetGroup;
}

export function createEmptyUsedGearWorkflowDashboardTargets(): UsedGearWorkflowDashboardTargets {
  return {
    pendingReviewOldestGroup: {
      id: null,
      label: null,
    },
    progressOldestGroup: {
      id: null,
      label: null,
    },
  };
}

function getOldestGroup(records: AirtableRecord[]): UsedGearWorkflowDashboardTargetGroup {
  const groups = groupUsedGearWorkflowRecords(records);

  if (groups.length === 0) {
    return { id: null, label: null };
  }

  const oldestGroup = groups.reduce((selectedGroup, group) => {
    const selectedTimestamp = Math.min(...selectedGroup.records.map((record) => Date.parse(record.createdTime)));
    const groupTimestamp = Math.min(...group.records.map((record) => Date.parse(record.createdTime)));

    if (groupTimestamp < selectedTimestamp) {
      return group;
    }

    if (groupTimestamp > selectedTimestamp) {
      return selectedGroup;
    }

    return group.label.localeCompare(selectedGroup.label) < 0 ? group : selectedGroup;
  });

  return {
    id: oldestGroup.id,
    label: oldestGroup.label,
  };
}

export function buildUsedGearWorkflowDashboardTargets(
  pendingReviewRecords: AirtableRecord[],
  progressRecords: AirtableRecord[],
): UsedGearWorkflowDashboardTargets {
  return {
    pendingReviewOldestGroup: getOldestGroup(pendingReviewRecords),
    progressOldestGroup: getOldestGroup(progressRecords),
  };
}

export async function loadUsedGearWorkflowDashboardTargets(): Promise<UsedGearWorkflowDashboardTargets> {
  const [pendingReviewRecords, progressRecords] = await Promise.all([
    loadPendingReviewQueue(),
    loadWorkflowProgressQueue(),
  ]);

  return buildUsedGearWorkflowDashboardTargets(pendingReviewRecords, progressRecords);
}