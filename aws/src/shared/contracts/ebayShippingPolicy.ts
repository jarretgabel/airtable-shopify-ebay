export interface EbayShippingPolicyWeightError {
  policyId: string;
  message: string;
}

export function getEbayShippingPolicyWeightError(
  message: string,
  fallbackPolicyId = '',
): EbayShippingPolicyWeightError | null {
  const normalized = message.replace(/\s+/g, ' ');
  const isWeightLimitError = /\b(?:package|parcel|shipment) weight (?:is )?(?:over|exceeds?)\b/i.test(normalized)
    || /\bweight (?:is )?(?:over|exceeds?)\b.{0,80}\b(?:limit|maximum)\b/i.test(normalized)
    || /\bshipping policy\b.*\bcannot ship\b.*\bweight\b/i.test(normalized);
  if (!isWeightLimitError) return null;

  const policyId = normalized.match(/\b(?:fulfillment|shipping) policy\s+"([^"]+)"/i)?.[1]
    ?? fallbackPolicyId;
  return {
    policyId,
    message: `The eBay shipping policy${policyId ? ` "${policyId}"` : ''} cannot ship this package at its recorded weight. Choose a compatible shipping policy; keep the actual packed weight unchanged.`,
  };
}
