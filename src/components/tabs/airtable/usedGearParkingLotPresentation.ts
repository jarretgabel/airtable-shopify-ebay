import { displayInventoryValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

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

export function getParkingLotStatusLabel(record: AirtableRecord): string {
  const rawStatus = displayInventoryValue(record.fields['Workflow Status']) || 'Unknown';

  if (rawStatus.startsWith('Accepted - ')) {
    return rawStatus.slice('Accepted - '.length);
  }

  return rawStatus;
}