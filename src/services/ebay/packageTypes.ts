import { API } from './config';
import { getValidUserToken } from './token';

const FALLBACK_PACKAGE_TYPES = [
  'Package/Thick Envelope',
  'Large Envelope',
  'Letter',
  'Large Package',
  'Extra Large Package',
  'UPS Letter',
  'FedEx Envelope',
  'FedEx Pak',
  'FedEx Box',
] as const;

const packageTypesByMarketplace = new Map<string, string[]>();

function normalizeMarketplaceId(marketplaceId: string): string {
  return marketplaceId.trim().toUpperCase() || 'EBAY_US';
}

function getTradingSiteId(marketplaceId: string): string {
  switch (normalizeMarketplaceId(marketplaceId)) {
    case 'EBAY_CA':
      return '2';
    case 'EBAY_GB':
      return '3';
    case 'EBAY_AU':
      return '15';
    case 'EBAY_FR':
      return '71';
    case 'EBAY_DE':
      return '77';
    case 'EBAY_IT':
      return '101';
    case 'EBAY_US':
    default:
      return '0';
  }
}

function toHumanLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRequestBody(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<GeteBayDetailsRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
    '<WarningLevel>High</WarningLevel>',
    '<DetailName>ShippingPackageDetails</DetailName>',
    '</GeteBayDetailsRequest>',
  ].join('');
}

function getNodeText(node: Element, tagName: string): string {
  return (
    node.getElementsByTagNameNS('*', tagName)[0]?.textContent?.trim()
    ?? node.getElementsByTagName(tagName)[0]?.textContent?.trim()
    ?? ''
  );
}

function extractPackageTypes(doc: XMLDocument): string[] {
  const detailNodes = Array.from(doc.getElementsByTagNameNS('*', 'ShippingPackageDetails'));
  const fetchedValues = detailNodes
    .map((node) => {
      const description = getNodeText(node, 'Description');
      const name = getNodeText(node, 'ShippingPackage');
      return description || toHumanLabel(name);
    })
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...FALLBACK_PACKAGE_TYPES, ...fetchedValues]))
    .sort((left, right) => left.localeCompare(right));
}

export async function getEbayPackageTypes(marketplaceId = 'EBAY_US'): Promise<string[]> {
  const normalizedMarketplaceId = normalizeMarketplaceId(marketplaceId);
  const cached = packageTypesByMarketplace.get(normalizedMarketplaceId);
  if (cached) return cached;

  try {
    const token = await getValidUserToken();
    const response = await fetch(`${API}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-CALL-NAME': 'GeteBayDetails',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1231',
        'X-EBAY-API-SITEID': getTradingSiteId(normalizedMarketplaceId),
        'X-EBAY-API-IAF-TOKEN': token,
      },
      body: buildRequestBody(),
    });

    const xmlText = await response.text();
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    const parseError = doc.getElementsByTagName('parsererror')[0]?.textContent?.trim();
    if (parseError) throw new Error(parseError);

    const values = extractPackageTypes(doc);
    packageTypesByMarketplace.set(normalizedMarketplaceId, values);
    return values;
  } catch {
    const fallbackValues = [...FALLBACK_PACKAGE_TYPES];
    packageTypesByMarketplace.set(normalizedMarketplaceId, fallbackValues);
    return fallbackValues;
  }
}