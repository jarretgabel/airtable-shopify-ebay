export interface UsedGearWorkflowNoteTemplate {
  id: string;
  label: string;
  value: string;
}

export type UsedGearWorkflowNoteTemplateGroup = 'qualification' | 'unqualified-reason' | 'stale-recovery' | 'shipment-follow-through';

const QUALIFICATION_NOTE_TEMPLATES: UsedGearWorkflowNoteTemplate[] = [
  {
    id: 'sellable-clean-pass',
    label: 'Sellable Clean Pass',
    value: 'Sellable intake confirmed. Core unit is present, pricing path is documented, and the row should continue through Lot 2.',
  },
  {
    id: 'accepted-missing-accessory',
    label: 'Accepted With Follow-Up',
    value: 'Accepted into Lot 2 with a follow-up item still outstanding. Workflow can continue while the missing accessory or confirmation is tracked separately.',
  },
  {
    id: 'grouped-intake-ready',
    label: 'Grouped Intake Ready',
    value: 'Grouped intake review completed. Pricing and routing are aligned with the related submission rows, so this item can stay in the sellable workflow.',
  },
];

const UNQUALIFIED_REASON_TEMPLATES: UsedGearWorkflowNoteTemplate[] = [
  {
    id: 'damage-beyond-threshold',
    label: 'Damage Beyond Threshold',
    value: 'Rejected at intake because the item has visible damage or missing parts that make it unsuitable for the normal resale workflow.',
  },
  {
    id: 'repair-not-economical',
    label: 'Repair Not Economical',
    value: 'Rejected at intake because the reported functional issues or required repair effort exceed the expected resale value.',
  },
  {
    id: 'insufficient-intake-verification',
    label: 'Insufficient Verification',
    value: 'Rejected at intake because required identifying, pricing, or qualification details could not be verified well enough to continue into Lot 2.',
  },
];

const STALE_RECOVERY_NOTE_TEMPLATES: UsedGearWorkflowNoteTemplate[] = [
  {
    id: 'price-refresh-planned',
    label: 'Price Refresh Planned',
    value: 'Reviewed stale listing and queued a price refresh based on current market position before relisting.',
  },
  {
    id: 'content-refresh-planned',
    label: 'Content Refresh Planned',
    value: 'Reviewed stale listing and queued a content refresh covering title, description, and image order before relisting.',
  },
  {
    id: 'relist-submitted',
    label: 'Relist Submitted',
    value: 'Recovery checks completed and the refreshed listing has been submitted for relist verification.',
  },
];

const SHIPMENT_FOLLOW_THROUGH_NOTE_TEMPLATES: UsedGearWorkflowNoteTemplate[] = [
  {
    id: 'packing-handoff-ready',
    label: 'Packing Handoff Ready',
    value: 'Payment is confirmed and the item is ready for packing handoff. Required accessories and packing notes were reviewed before shipment prep.',
  },
  {
    id: 'carrier-booking-planned',
    label: 'Carrier Booking Planned',
    value: 'Shipment follow-through reviewed. Carrier booking and label creation are queued, with packaging requirements confirmed for this unit.',
  },
  {
    id: 'shipment-confirmed',
    label: 'Shipment Confirmed',
    value: 'Fulfillment follow-through completed. Shipment confirmation was recorded and the workflow row is ready for shipped-history retention.',
  },
];

const TEMPLATE_GROUPS: Record<UsedGearWorkflowNoteTemplateGroup, UsedGearWorkflowNoteTemplate[]> = {
  qualification: QUALIFICATION_NOTE_TEMPLATES,
  'unqualified-reason': UNQUALIFIED_REASON_TEMPLATES,
  'stale-recovery': STALE_RECOVERY_NOTE_TEMPLATES,
  'shipment-follow-through': SHIPMENT_FOLLOW_THROUGH_NOTE_TEMPLATES,
};

export function getUsedGearWorkflowNoteTemplates(group: UsedGearWorkflowNoteTemplateGroup): UsedGearWorkflowNoteTemplate[] {
  return TEMPLATE_GROUPS[group];
}

export function applyUsedGearWorkflowNoteTemplate(currentValue: string, templateValue: string): string {
  const trimmedCurrentValue = currentValue.trim();
  const trimmedTemplateValue = templateValue.trim();

  if (!trimmedTemplateValue) {
    return trimmedCurrentValue;
  }

  if (!trimmedCurrentValue) {
    return trimmedTemplateValue;
  }

  if (trimmedCurrentValue.includes(trimmedTemplateValue)) {
    return trimmedCurrentValue;
  }

  return `${trimmedCurrentValue}\n${trimmedTemplateValue}`;
}