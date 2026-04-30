type ApprovalTarget = 'shopify' | 'ebay';
type ApprovalAction = 'approve' | 'publish';

const approvalTargetLabel: Record<ApprovalTarget, string> = {
  shopify: 'Shopify',
  ebay: 'eBay',
};

function formatMissingFieldLabels(missingFieldLabels: string[]): string {
  return missingFieldLabels.join(', ');
}

export function buildRequiredFieldValidationNotice(
  target: ApprovalTarget,
  action: ApprovalAction,
  missingFieldLabels: string[],
): { message: string; title: string } {
  const targetLabel = approvalTargetLabel[target];

  return {
    title: `Required ${targetLabel} fields missing`,
    message: action === 'approve'
      ? `Complete required fields before approving: ${formatMissingFieldLabels(missingFieldLabels)}`
      : `Complete required ${targetLabel} fields before publishing: ${formatMissingFieldLabels(missingFieldLabels)}`,
  };
}

export function getApprovalRequiredFieldValidationNotice(
  approvalChannel: 'shopify' | 'ebay' | 'combined',
  validationState: {
    ebay: { hasMissingFields: boolean; missingFieldLabels: string[] };
    shopify: { hasMissingFields: boolean; missingFieldLabels: string[] };
  },
): { message: string; title: string } | null {
  if (approvalChannel === 'combined') {
    return null;
  }

  const channelState = validationState[approvalChannel];
  if (!channelState.hasMissingFields) {
    return null;
  }

  return buildRequiredFieldValidationNotice(approvalChannel, 'approve', channelState.missingFieldLabels);
}

export function getPublishRequiredFieldValidationNotice(
  target: 'shopify' | 'ebay' | 'both',
  validationState: {
    ebay: { hasMissingFields: boolean; missingFieldLabels: string[] };
    shopify: { hasMissingFields: boolean; missingFieldLabels: string[] };
  },
): { message: string; title: string } | null {
  const publishTargets: ApprovalTarget[] = target === 'both' ? ['shopify', 'ebay'] : [target];

  for (const publishTarget of publishTargets) {
    const targetState = validationState[publishTarget];
    if (targetState.hasMissingFields) {
      return buildRequiredFieldValidationNotice(publishTarget, 'publish', targetState.missingFieldLabels);
    }
  }

  return null;
}