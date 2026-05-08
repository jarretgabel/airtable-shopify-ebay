import type { AirtableRecord } from '@/types/airtable';

export interface UsedGearWorkflowTimelineEntry {
  id: string;
  label: string;
  status: 'completed' | 'pending';
  timestamp: string | null;
  actor: string | null;
}

function getTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildEntry(
  id: string,
  label: string,
  timestampValue: unknown,
  actorValue?: unknown,
): UsedGearWorkflowTimelineEntry {
  const timestamp = getTrimmedString(timestampValue);
  const actor = getTrimmedString(actorValue);

  return {
    id,
    label,
    status: timestamp ? 'completed' : 'pending',
    timestamp,
    actor,
  };
}

export function buildUsedGearWorkflowTimeline(record: AirtableRecord): UsedGearWorkflowTimelineEntry[] {
  const fields = record.fields;

  return [
    buildEntry('accepted', 'Intake Accepted', fields['Accepted At'], fields['Accepted By']),
    buildEntry('processing', 'Processing Completed', fields['Processing Signed At'], fields['Processing Signed By']),
    buildEntry('testing', 'Testing Signed', fields['Testing Signed At'], fields['Testing Signed By']),
    buildEntry('photography', 'Photography Signed', fields['Photography Signed At'], fields['Photography Signed By']),
    buildEntry('awaiting-pre-listing', 'Awaiting Pre-Listing Review', fields['Awaiting Pre-Listing Review At']),
    buildEntry('pre-listing', 'Pre-Listing Review Completed', fields['Pre-Listing Reviewed At'], fields['Pre-Listing Reviewed By']),
    buildEntry('approved', 'Approved For Publish', fields['Approved For Publish At'], fields['Pre-Listing Reviewed By']),
    buildEntry('listed', 'Listed', fields['Listed At']),
    buildEntry('stale-listing', 'Marked Stale', fields['Stale Listing At']),
    buildEntry('relisted', 'Relisted', fields['Relisted At']),
    buildEntry('sold-ready', 'Sold Ready To Ship', fields['Sold Ready To Ship At']),
    buildEntry('shipped', 'Shipped', fields['Shipped At']),
  ];
}