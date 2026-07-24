export interface UsedGearIntakeFieldInput {
  arrivalDate?: string | null;
  pickUpNumber?: string | null;
  acquiredFrom?: string | null;
  cost?: string | number | null;
  customerCosmeticNotes?: string | null;
  customerFunctionalNotes?: string | null;
  customerInclusionNotes?: string | null;
  status?: string | null;
  make?: string | null;
  model?: string | null;
  componentType?: string | null;
  serialNumber?: string | null;
  voltage?: string | null;
  inventoryNotes?: string | null;
  cosmeticConditionNotes?: string | null;
  originalBox?: string | null;
  manual?: string | null;
  remote?: string | null;
  powerCable?: string | null;
  additionalItems?: string | null;
  weight?: string | null;
  shippingDims?: string | null;
  shippingMethod?: string | null;
  sellerEmail?: string | null;
  sellerPhone?: string | null;
  sellerZipCode?: string | null;
  sellerLocation?: string | null;
  howDidYouHear?: string | null;
  mailingListOptIn?: boolean | null;
  originalOwner?: string | null;
  smokeExposure?: string | null;
}

export interface UsedGearWorkflowFieldInput {
  workflowSource: string;
  workflowStatus: string;
  pickUpId?: string | null;
  qualificationNotes?: string | null;
  qualificationComplete?: boolean;
  acceptedBy?: string | null;
  acceptedAt?: string | null;
  jotFormSubmissionId?: string | null;
  trashStatus?: string | null;
  unqualifiedReason?: string | null;
}

export function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function arrayOrUndefined(value: string | null | undefined): string[] | undefined {
  const trimmed = trimToUndefined(value);
  return trimmed ? [trimmed] : undefined;
}

export function singleValueAsArrayOrUndefined(value: string | null | undefined): string[] | undefined {
  const trimmed = trimToUndefined(value);
  return trimmed ? [trimmed] : undefined;
}

export function compactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return true;
    }),
  );
}

function normalizeNumber(value: string | number | null | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const trimmed = trimToUndefined(typeof value === 'string' ? value : undefined);
  if (!trimmed) {
    return undefined;
  }

  const cleaned = trimmed.replace(/[$,\s]/g, '');
  if (!/^-?(?:\d+|\d+\.\d+|\.\d+)$/.test(cleaned)) {
    return undefined;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildUsedGearIntakeBaseFields(input: UsedGearIntakeFieldInput): Record<string, unknown> {
  return compactFields({
    'Arrival Date': trimToUndefined(input.arrivalDate),
    'Pick Up ID': trimToUndefined(input.pickUpNumber),
    'Acquired From': trimToUndefined(input.acquiredFrom),
    Cost: normalizeNumber(input.cost),
    'Customer Cosmetic Notes': trimToUndefined(input.customerCosmeticNotes),
    'Customer Functional Notes': trimToUndefined(input.customerFunctionalNotes),
    'Customer Inclusion Notes': trimToUndefined(input.customerInclusionNotes),
    Status: trimToUndefined(input.status),
    Make: trimToUndefined(input.make),
    Model: trimToUndefined(input.model),
    'Component Type': singleValueAsArrayOrUndefined(input.componentType),
    'Serial Number': trimToUndefined(input.serialNumber),
    Voltage: trimToUndefined(input.voltage),
    'Inventory Notes': trimToUndefined(input.inventoryNotes),
    'Testing Cosmetic Notes': trimToUndefined(input.cosmeticConditionNotes),
    'Original Box': arrayOrUndefined(input.originalBox),
    Manual: arrayOrUndefined(input.manual),
    Remote: arrayOrUndefined(input.remote),
    'Power Cable': arrayOrUndefined(input.powerCable),
    'Additional Items': trimToUndefined(input.additionalItems),
    Weight: trimToUndefined(input.weight),
    'Shipping Dims': trimToUndefined(input.shippingDims),
    'Shipping Method': arrayOrUndefined(input.shippingMethod),
    'Seller Email': trimToUndefined(input.sellerEmail),
    'Seller Phone': trimToUndefined(input.sellerPhone),
    'Seller Zip Code': trimToUndefined(input.sellerZipCode),
    'Seller Location': trimToUndefined(input.sellerLocation),
    'How Did You Hear': trimToUndefined(input.howDidYouHear),
    'Mailing List Opt In': input.mailingListOptIn ?? undefined,
    'Original Owner': trimToUndefined(input.originalOwner),
    'Smoke Exposure': trimToUndefined(input.smokeExposure),
  });
}

export function buildUsedGearWorkflowFields(input: UsedGearWorkflowFieldInput): Record<string, unknown> {
  return compactFields({
    'Workflow Source': trimToUndefined(input.workflowSource),
    'Workflow Status': trimToUndefined(input.workflowStatus),
    'Pick Up ID': trimToUndefined(input.pickUpId),
    'Qualification Notes': trimToUndefined(input.qualificationNotes),
    'Qualification Complete': input.qualificationComplete,
    'Accepted By': trimToUndefined(input.acceptedBy),
    'Accepted At': trimToUndefined(input.acceptedAt),
    'JotForm Submission ID': trimToUndefined(input.jotFormSubmissionId),
    'Trash Status': input.trashStatus,
    'Unqualified Reason': input.unqualifiedReason,
  });
}