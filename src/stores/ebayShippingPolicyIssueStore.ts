import { create } from 'zustand';
import type { EbayShippingPolicyWeightError } from '@contracts/ebayShippingPolicy';

interface EbayShippingPolicyIssue extends EbayShippingPolicyWeightError {
  recordId: string;
}

export const useEbayShippingPolicyIssueStore = create<{ issue: EbayShippingPolicyIssue | null }>(() => ({
  issue: null,
}));
