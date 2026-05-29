import { displayInventoryValue, extractInventoryScalarValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

const PENDING_REVIEW_STATUS = 'Pending Review';
const ACCEPTED_AWAITING_ARRIVAL_STATUS = 'Accepted - Awaiting Arrival';
const ACCEPTED_ARRIVED_AWAITING_SKU_STATUS = 'Accepted - Arrived, Awaiting SKU';
const ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS = 'Accepted - Arrived, Awaiting Missing Item';

const PARKING_LOT_STATUS_LABELS: Record<string, string> = {
  [ACCEPTED_AWAITING_ARRIVAL_STATUS]: 'Awaiting Arrival',
  [ACCEPTED_ARRIVED_AWAITING_SKU_STATUS]: 'Awaiting SKU',
  [ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS]: 'Awaiting Missing Item',
};

function hasAcceptedParkingLotMarkers(record: AirtableRecord): boolean {
  const qualificationComplete = record.fields['Qualification Complete'];
  const acceptedAt = extractInventoryScalarValue(record.fields['Accepted At']);
  const acceptedBy = extractInventoryScalarValue(record.fields['Accepted By']);

  return qualificationComplete === true
    || qualificationComplete === 'true'
    || qualificationComplete === '1'
    || qualificationComplete === 1
    || acceptedAt.length > 0
    || acceptedBy.length > 0;
}

function stripParkingLotStatusSuffixes(value: string): string {
  return value
    .replace(/\s+(awaiting sku|awaiting arrival|awaiting missing item)$/i, '')
    .trim();
}

export function getParkingLotItemTitle(record: AirtableRecord): string {
  const make = displayInventoryValue(record.fields.Make);
  const model = stripParkingLotStatusSuffixes(displayInventoryValue(record.fields.Model));

  return [make, model].filter(Boolean).join(' · ');
}

export function getParkingLotEffectiveStatus(record: AirtableRecord): string {
  const workflowStatus = extractInventoryScalarValue(record.fields['Workflow Status']);

  if (workflowStatus && workflowStatus !== PENDING_REVIEW_STATUS) {
    return workflowStatus;
  }

  if (!hasAcceptedParkingLotMarkers(record)) {
    return workflowStatus || 'Unknown';
  }

  const arrivalDate = extractInventoryScalarValue(record.fields['Arrival Date']);
  const sku = extractInventoryScalarValue(record.fields.SKU);

  if (!arrivalDate) {
    return ACCEPTED_AWAITING_ARRIVAL_STATUS;
  }

  if (!sku) {
    return ACCEPTED_ARRIVED_AWAITING_SKU_STATUS;
  }

  return ACCEPTED_ARRIVED_AWAITING_MISSING_ITEM_STATUS;
}

export function getParkingLotStatusLabel(record: AirtableRecord): string {
  const workflowStatus = getParkingLotEffectiveStatus(record);
  return PARKING_LOT_STATUS_LABELS[workflowStatus] ?? workflowStatus ?? 'Unknown';
}