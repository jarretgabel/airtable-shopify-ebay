import { displayInventoryValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

function stripLotTwoStatusSuffixes(value: string): string {
  return value
    .replace(/\s+(awaiting sku|awaiting arrival|awaiting missing item)$/i, '')
    .trim();
}

export function getLotTwoItemTitle(record: AirtableRecord): string {
  const make = displayInventoryValue(record.fields.Make);
  const model = stripLotTwoStatusSuffixes(displayInventoryValue(record.fields.Model));

  return [make, model].filter(Boolean).join(' · ');
}

export function getLotTwoStatusLabel(record: AirtableRecord): string {
  const rawStatus = displayInventoryValue(record.fields['Workflow Status']) || 'Unknown';

  if (rawStatus.startsWith('Accepted - ')) {
    return rawStatus.slice('Accepted - '.length);
  }

  return rawStatus;
}