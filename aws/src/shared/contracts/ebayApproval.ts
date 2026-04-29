export interface EbayApprovalDraftPayloadBundle {
  inventoryItem: Record<string, unknown>;
  offer: Record<string, unknown>;
}

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