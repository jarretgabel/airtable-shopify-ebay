import type { EbayBusinessPolicyConfig, EbayLocationConfig } from './types';
import { API } from './config';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getXmlText(doc: XMLDocument, tagName: string): string {
  return (
    doc.getElementsByTagNameNS('*', tagName)[0]?.textContent?.trim()
    ?? doc.getElementsByTagName(tagName)[0]?.textContent?.trim()
    ?? ''
  );
}

function getTradingErrors(doc: XMLDocument): string {
  const errors = Array.from(doc.getElementsByTagNameNS('*', 'Errors'));
  return errors
    .map((error) => {
      const longMessage = error.getElementsByTagNameNS('*', 'LongMessage')[0]?.textContent?.trim();
      const shortMessage = error.getElementsByTagNameNS('*', 'ShortMessage')[0]?.textContent?.trim();
      const code = error.getElementsByTagNameNS('*', 'ErrorCode')[0]?.textContent?.trim();
      const message = longMessage || shortMessage || 'Unknown Trading API error';
      return code ? `${code}: ${message}` : message;
    })
    .filter(Boolean)
    .join(' | ');
}

async function callTradingApi(token: string, callName: string, body: string): Promise<XMLDocument> {
  const res = await fetch(`${API}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1231',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-IAF-TOKEN': token,
    },
    body,
  });

  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0]?.textContent?.trim();
  if (parseError) throw new Error(`${callName} XML parse error: ${parseError}`);

  const ack = getXmlText(doc, 'Ack');
  if (!res.ok || (ack && ack !== 'Success' && ack !== 'Warning')) {
    const message = getTradingErrors(doc) || text.slice(0, 400);
    throw new Error(`${callName} ${res.status}: ${message}`);
  }

  return doc;
}

function buildTradingSamplePayload(
  sku: string,
  locationConfig: EbayLocationConfig,
  policyConfig: EbayBusinessPolicyConfig,
): string {
  const locationLabel =
    [locationConfig.city, locationConfig.stateOrProvince].filter(Boolean).join(', ') || locationConfig.name;

  const sellerProfiles =
    policyConfig.fulfillmentPolicyId && policyConfig.paymentPolicyId && policyConfig.returnPolicyId
      ? [
          '<SellerProfiles>',
          `<SellerShippingProfile><ShippingProfileID>${escapeXml(policyConfig.fulfillmentPolicyId)}</ShippingProfileID></SellerShippingProfile>`,
          `<SellerPaymentProfile><PaymentProfileID>${escapeXml(policyConfig.paymentPolicyId)}</PaymentProfileID></SellerPaymentProfile>`,
          `<SellerReturnProfile><ReturnProfileID>${escapeXml(policyConfig.returnPolicyId)}</ReturnProfileID></SellerReturnProfile>`,
          '</SellerProfiles>',
        ].join('')
      : '';

  return [
    '<Item>',
    `<Title>${escapeXml(`Resolution AV Demo Listing ${new Date().toISOString().slice(0, 10)}`)}</Title>`,
    `<Description>${escapeXml('Resolution AV Trading API sample listing for a McIntosh MA8900 integrated amplifier.')}</Description>`,
    `<SKU>${escapeXml(sku)}</SKU>`,
    '<PrimaryCategory><CategoryID>14990</CategoryID></PrimaryCategory>',
    '<StartPrice currencyID="USD">4999.00</StartPrice>',
    '<CategoryMappingAllowed>true</CategoryMappingAllowed>',
    '<ConditionID>3000</ConditionID>',
    '<Country>US</Country>',
    '<Currency>USD</Currency>',
    '<DispatchTimeMax>3</DispatchTimeMax>',
    '<ListingDuration>GTC</ListingDuration>',
    '<ListingType>FixedPriceItem</ListingType>',
    `<Location>${escapeXml(locationLabel || 'United States')}</Location>`,
    `<PostalCode>${escapeXml(locationConfig.postalCode)}</PostalCode>`,
    '<PictureDetails><PictureURL>https://images.crutchfieldonline.com/ImageHandler/trim/3000/1950/products/2018/45/793/g793MA8900/0.jpg</PictureURL></PictureDetails>',
    '<Quantity>1</Quantity>',
    '<ItemSpecifics>',
    '<NameValueList><Name>Brand</Name><Value>McIntosh</Value></NameValueList>',
    '<NameValueList><Name>Connectivity</Name><Value>Wired</Value></NameValueList>',
    '<NameValueList><Name>Model</Name><Value>MA8900</Value></NameValueList>',
    '<NameValueList><Name>Type</Name><Value>Integrated Amplifier</Value></NameValueList>',
    '</ItemSpecifics>',
    '<ReturnPolicy>',
    '<ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>',
    '<RefundOption>MoneyBack</RefundOption>',
    '<ReturnsWithinOption>Days_30</ReturnsWithinOption>',
    '<ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>',
    '</ReturnPolicy>',
    '<ShippingDetails>',
    '<ShippingType>Flat</ShippingType>',
    '<ShippingServiceOptions>',
    '<ShippingServicePriority>1</ShippingServicePriority>',
    '<ShippingService>ShippingMethodStandard</ShippingService>',
    '<ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost>',
    '</ShippingServiceOptions>',
    '</ShippingDetails>',
    sellerProfiles,
    '</Item>',
  ].join('');
}

function buildVerifyBody(itemPayload: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</VerifyAddFixedPriceItemRequest>`;
}

function buildAddBody(itemPayload: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</AddFixedPriceItemRequest>`;
}

export async function verifyTradingSampleListing(
  token: string,
  sku: string,
  locationConfig: EbayLocationConfig,
  policyConfig: EbayBusinessPolicyConfig,
): Promise<void> {
  const itemPayload = buildTradingSamplePayload(sku, locationConfig, policyConfig);
  await callTradingApi(token, 'VerifyAddFixedPriceItem', buildVerifyBody(itemPayload));
}

export async function addTradingSampleListing(
  token: string,
  sku: string,
  locationConfig: EbayLocationConfig,
  policyConfig: EbayBusinessPolicyConfig,
): Promise<string> {
  const itemPayload = buildTradingSamplePayload(sku, locationConfig, policyConfig);
  const addDoc = await callTradingApi(token, 'AddFixedPriceItem', buildAddBody(itemPayload));
  const listingId = getXmlText(addDoc, 'ItemID');

  if (!listingId) {
    throw new Error('AddFixedPriceItem succeeded but eBay did not return an ItemID.');
  }

  return listingId;
}