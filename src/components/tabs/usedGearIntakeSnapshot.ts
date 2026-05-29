import { displayInventoryValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

function getSnapshotIncludesValue(record: AirtableRecord): unknown {
  return record.fields['Customer Inclusion Notes'] || record.fields['Internal Inclusion Notes'];
}

export function buildUsedGearIntakeSnapshot(record: AirtableRecord) {
  return {
    fields: [
      { label: 'SKU', value: displayInventoryValue(record.fields.SKU) },
      { label: 'Make', value: displayInventoryValue(record.fields.Make) },
      { label: 'Model', value: displayInventoryValue(record.fields.Model) },
      { label: 'Component Type', value: displayInventoryValue(record.fields['Component Type']) },
      { label: 'Includes', value: displayInventoryValue(getSnapshotIncludesValue(record)) },
      { label: 'Seller Name', value: displayInventoryValue(record.fields['Acquired From']) },
      { label: 'Arrival Date', value: displayInventoryValue(record.fields['Arrival Date']) },
      { label: 'Seller Email', value: displayInventoryValue(record.fields['Seller Email']) },
      { label: 'Seller Phone', value: displayInventoryValue(record.fields['Seller Phone']) },
      { label: 'Seller Zip Code', value: displayInventoryValue(record.fields['Seller Zip Code']) },
      { label: 'Seller Location', value: displayInventoryValue(record.fields['Seller Location']) },
      { label: 'How Did You Hear', value: displayInventoryValue(record.fields['How Did You Hear']) },
      { label: 'Mailing List Opt In', value: displayInventoryValue(record.fields['Mailing List Opt In']) },
    ],
    cards: [
      {
        title: 'Pricing And Allocation',
        value: [
          `Offer Amount: ${displayInventoryValue(record.fields['Offer Amount'])}`,
          `Paid Amount: ${displayInventoryValue(record.fields['Paid Amount'])}`,
          `Confirmed Grand Total: ${displayInventoryValue(record.fields['Confirmed Grand Total'])}`,
          `Allocation Mode: ${displayInventoryValue(record.fields['Allocation Mode'])}`,
          `Allocation Notes: ${displayInventoryValue(record.fields['Allocation Notes'])}`,
        ].join('\n'),
      },
      {
        title: 'Customer Intake Notes',
        value: [
          `Cosmetic Notes: ${displayInventoryValue(record.fields['Customer Cosmetic Notes'])}`,
          `Functional Notes: ${displayInventoryValue(record.fields['Customer Functional Notes'])}`,
          `Inclusion Notes: ${displayInventoryValue(record.fields['Customer Inclusion Notes'])}`,
          `Photos Notes: ${displayInventoryValue(record.fields['Customer Submitted Photos Notes'])}`,
          `Original Owner: ${displayInventoryValue(record.fields['Original Owner'])}`,
          `Smoke Exposure: ${displayInventoryValue(record.fields['Smoke Exposure'])}`,
        ].join('\n'),
      },
      {
        title: 'Internal Notes',
        value: [
          `Inventory Notes: ${displayInventoryValue(record.fields['Inventory Notes'])}`,
          `Qualification Complete: ${displayInventoryValue(record.fields['Qualification Complete'])}`,
          `Qualification Notes: ${displayInventoryValue(record.fields['Qualification Notes'])}`,
          `Internal Cosmetic Notes: ${displayInventoryValue(record.fields['Internal Cosmetic Notes'])}`,
          `Internal Functional Notes: ${displayInventoryValue(record.fields['Internal Functional Notes'])}`,
          `Internal Inclusion Notes: ${displayInventoryValue(record.fields['Internal Inclusion Notes'])}`,
        ].join('\n'),
      },
    ],
  };
}