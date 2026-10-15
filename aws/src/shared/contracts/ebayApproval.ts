export interface EbayApprovalDraftPayloadBundle {
  inventoryItem: Record<string, unknown>;
  offer: Record<string, unknown>;
}

export const EBAY_APPROVAL_POLICY_FIELD_CANDIDATES = {
  fulfillment: [
    'eBay Offer Fulfillment Policy ID',
    'ebay_offer_fulfillment_policy_id',
    'e_bay_offer_fulfillment_policy_id',
    'ebay_offer_fulfillmentpolicyid',
    'e_bay_offer_fulfillmentpolicyid',
    'Fulfillment Policy ID',
    'fulfillment_policy_id',
  ],
  payment: [
    'eBay Offer Payment Policy ID',
    'ebay_offer_payment_policy_id',
    'e_bay_offer_payment_policy_id',
    'ebay_offer_paymentpolicyid',
    'e_bay_offer_paymentpolicyid',
    'Payment Policy ID',
    'payment_policy_id',
  ],
  returns: [
    'eBay Offer Return Policy ID',
    'ebay_offer_return_policy_id',
    'e_bay_offer_return_policy_id',
    'ebay_offer_returnpolicyid',
    'e_bay_offer_returnpolicyid',
    'Return Policy ID',
    'return_policy_id',
  ],
} as const;

export interface EbayApprovalLocationConfig {
  key: string;
  name: string;
  country: string;
  postalCode: string;
  city: string;
  stateOrProvince: string;
}

export interface EbayApprovalBusinessPolicyConfig {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

export interface EbayPublishSetup {
  locationConfig: EbayApprovalLocationConfig;
  policyConfig: EbayApprovalBusinessPolicyConfig;
}

export interface EbayApprovalPushResult {
  sku: string;
  offerId: string;
  listingId: string;
  wasExistingOffer: boolean;
}

export interface EbayApprovalPreviewResult {
  generatedBodyHtml: string;
  draftPayloadBundle: EbayApprovalDraftPayloadBundle;
  selectedCategoryIds?: string[];
  selectedCategoryNames?: string[];
  categoryFieldUpdates?: Record<string, string>;
}