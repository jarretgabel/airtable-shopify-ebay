export type ApprovalFlowNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface ApprovalFlowNotice {
  tone: ApprovalFlowNoticeTone
  title: string
  message: string
}

export function buildNewShopifyListingCreatedNotice(): ApprovalFlowNotice {
  return {
    tone: 'success',
    title: 'New Shopify listing created',
    message: 'A new Airtable row is ready. Fill the required Shopify fields, save, then approve.',
  }
}

export function buildCreateShopifyListingFailedNotice(message: string): ApprovalFlowNotice {
  return {
    tone: 'error',
    title: 'Unable to create Shopify listing',
    message,
  }
}

export function buildShopifyPublishIdWritebackFailedNotice(): ApprovalFlowNotice {
  return {
    tone: 'warning',
    title: 'Shopify publish succeeded, ID writeback failed',
    message: 'The Shopify listing was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.',
  }
}

export function buildSaveUpdatesFirstNotice(): ApprovalFlowNotice {
  return {
    tone: 'warning',
    title: 'Save updates first',
    message: 'Save page data before publishing to Shopify or eBay.',
  }
}

export function buildMissingFieldsBeforePublishNotice(channel: 'shopify' | 'ebay', labels: string[]): ApprovalFlowNotice {
  const channelLabel = channel === 'shopify' ? 'Shopify' : 'eBay'
  return {
    tone: 'warning',
    title: channel === 'shopify' ? 'Required Shopify fields missing' : 'Required eBay fields missing',
    message: `Complete required ${channelLabel} fields before publishing: ${labels.join(', ')}`,
  }
}

export function buildMissingFieldsBeforeApproveNotice(channel: 'shopify' | 'ebay', labels: string[]): ApprovalFlowNotice {
  return {
    tone: 'warning',
    title: channel === 'shopify' ? 'Required Shopify fields missing' : 'Required eBay fields missing',
    message: `Complete required fields before approving: ${labels.join(', ')}`,
  }
}

export function buildPageDataResetNotice(): ApprovalFlowNotice {
  return {
    tone: 'info',
    title: 'Page data reset',
    message: 'Form values were restored to current Airtable values.',
  }
}

export function buildListingUpdatedNotice(): ApprovalFlowNotice {
  return {
    tone: 'success',
    title: 'Listing updated',
    message: 'Listing changes were saved to Airtable.',
  }
}

export function buildListingSaveFailedNotice(): ApprovalFlowNotice {
  return {
    tone: 'error',
    title: 'Save failed',
    message: 'Could not save listing changes to Airtable. Review the error section and try again.',
  }
}

export function buildApprovalFailedNotice(): ApprovalFlowNotice {
  return {
    tone: 'error',
    title: 'Approval failed',
    message: 'Could not mark this listing as approved in Airtable.',
  }
}