import { readFileSync, writeFileSync } from 'fs';

export function normalizeCode(code) {
  if (!code) return code;
  try {
    return decodeURIComponent(code);
  } catch {
    return code;
  }
}

export function normalizeToken(token) {
  if (!token) return token;
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export function saveRefreshToken(envPath, refreshToken) {
  const normalized = normalizeToken(refreshToken);
  let rawEnv = readFileSync(envPath, 'utf-8');

  if (rawEnv.includes('VITE_EBAY_REFRESH_TOKEN=')) {
    rawEnv = rawEnv.replace(/^VITE_EBAY_REFRESH_TOKEN=.*$/m, `VITE_EBAY_REFRESH_TOKEN=${normalized}`);
  } else {
    rawEnv = rawEnv.replace(/^VITE_EBAY_ENV=/m, `VITE_EBAY_REFRESH_TOKEN=${normalized}\nVITE_EBAY_ENV=`);
  }

  writeFileSync(envPath, rawEnv);
  console.log('✓ Refresh token saved to .env.local (VITE_EBAY_REFRESH_TOKEN)');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function extractXmlTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`));
  return match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? '';
}

function extractTradingErrors(xml) {
  return Array.from(xml.matchAll(/<LongMessage>([\s\S]*?)<\/LongMessage>/g))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join(' | ');
}

async function callTradingApi(accessToken, apiBase, callName, body) {
  const res = await fetch(`${apiBase}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1231',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-IAF-TOKEN': accessToken,
    },
    body,
  });

  const text = await res.text();
  const ack = extractXmlTag(text, 'Ack');
  if (!res.ok || (ack && ack !== 'Success' && ack !== 'Warning')) {
    const errorMessage = extractTradingErrors(text) || text.slice(0, 500);
    throw new Error(`${callName} ${res.status}: ${errorMessage}`);
  }

  return text;
}

export async function createDraftListing(accessToken, apiBase) {
  const sampleSku = 'RAVMCINTOSHMA8900001';

  console.log('\nStep 3: Creating inventory item…');
  const itemRes = await fetch(`${apiBase}/sell/inventory/v1/inventory_item/${encodeURIComponent(sampleSku)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify({
      product: {
        title: 'McIntosh MA8900 Integrated Amplifier — Resolution AV',
        description:
          '<p>The McIntosh MA8900 is a premium 200-watt-per-channel integrated amplifier combining solid-state power with vacuum tube inputs. ' +
          "Features include a built-in DAC, MM/MC phono stage, and McIntosh's iconic illuminated watt meters.</p>",
        imageUrls: [
          'https://images.crutchfieldonline.com/ImageHandler/trim/3000/1950/products/2018/45/793/g793MA8900/0.jpg',
        ],
        aspects: {
          Brand: ['McIntosh'],
          Model: ['MA8900'],
          Type: ['Integrated Amplifier'],
          'Power Output': ['200W per channel'],
          Color: ['Black/Silver'],
        },
        brand: 'McIntosh',
        mpn: 'MA8900',
      },
      condition: 'USED_EXCELLENT',
      conditionDescription: 'Excellent cosmetic condition. No visible scratches or wear. Original remote and manual included.',
      availability: {
        shipToLocationAvailability: { quantity: 1 },
      },
    }),
  });

  if (!itemRes.ok) {
    const err = await itemRes.json().catch(() => ({}));
    console.error(`✗ Create inventory item failed: HTTP ${itemRes.status}`);
    console.error(JSON.stringify(err, null, 2));
    return;
  }
  console.log(`✓ Inventory item created — SKU: ${sampleSku}`);

  console.log('\nStep 4: Creating draft offer (UNPUBLISHED)…');
  const offerRes = await fetch(`${apiBase}/sell/inventory/v1/offer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify({
      sku: sampleSku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      categoryId: '3276',
      listingDescription: '<p>McIntosh MA8900 200W Integrated Amplifier — Resolution AV, NYC luxury HiFi dealer.</p>',
      pricingSummary: {
        price: { value: '4999.00', currency: 'USD' },
      },
      quantityLimitPerBuyer: 1,
      includeCatalogProductDetails: false,
    }),
  });

  if (!offerRes.ok) {
    const err = await offerRes.json().catch(() => ({}));
    if (offerRes.status === 409 || err.errors?.some((error) => error.errorId === 25002)) {
      console.log('  ℹ Offer already exists for this SKU.');
      const listRes = await fetch(`${apiBase}/sell/inventory/v1/offer?sku=${encodeURIComponent(sampleSku)}&limit=1`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept-Language': 'en-US',
        },
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const existing = listData.offers?.[0];
        if (existing) {
          console.log(`✓ Existing draft offer found — Offer ID: ${existing.offerId}`);
          console.log(`  Status: ${existing.status}`);
        }
      }
      return;
    }
    console.error(`✗ Create offer failed: HTTP ${offerRes.status}`);
    console.error(JSON.stringify(err, null, 2));
    return;
  }

  const offerData = await offerRes.json();
  console.log(`✓ Draft offer created — Offer ID: ${offerData.offerId}`);
  console.log('  Status: UNPUBLISHED (draft — not visible on eBay.com)');
  console.log('');
  console.log('  ┌──────────────────────────────────────────────────');
  console.log(`  │ SKU      : ${sampleSku}`);
  console.log(`  │ Offer ID : ${offerData.offerId}`);
  console.log('  │ Price    : $4,999.00 USD');
  console.log('  │ Status   : UNPUBLISHED');
  console.log('  └──────────────────────────────────────────────────');
}

export async function createTradingListing(accessToken, mode, apiBase, cfg) {
  const {
    locationName,
    locationPostalCode,
    locationCity,
    locationState,
    fulfillmentPolicyId,
    paymentPolicyId,
    returnPolicyId,
  } = cfg;

  if (!locationPostalCode.trim()) {
    throw new Error('Trading API listing requires VITE_EBAY_LOCATION_POSTAL_CODE in .env.local');
  }

  const sku = `RAVTRADING${Date.now()}`;
  const locationLabel = [locationCity, locationState].filter(Boolean).join(', ') || locationName;
  const sellerProfiles =
    fulfillmentPolicyId && paymentPolicyId && returnPolicyId
      ? [
          '<SellerProfiles>',
          `<SellerShippingProfile><ShippingProfileID>${escapeXml(fulfillmentPolicyId)}</ShippingProfileID></SellerShippingProfile>`,
          `<SellerPaymentProfile><PaymentProfileID>${escapeXml(paymentPolicyId)}</PaymentProfileID></SellerPaymentProfile>`,
          `<SellerReturnProfile><ReturnProfileID>${escapeXml(returnPolicyId)}</ReturnProfileID></SellerReturnProfile>`,
          '</SellerProfiles>',
        ].join('')
      : '';

  const itemPayload = [
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
    `<PostalCode>${escapeXml(locationPostalCode)}</PostalCode>`,
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

  console.log('\nStep 3: Verifying Trading API listing payload…');
  await callTradingApi(
    accessToken,
    apiBase,
    'VerifyAddFixedPriceItem',
    `<?xml version="1.0" encoding="utf-8"?><VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</VerifyAddFixedPriceItemRequest>`,
  );
  console.log('✓ Trading payload verified');

  if (mode === 'trading-verify') {
    console.log('');
    console.log('  ┌──────────────────────────────────────────────────');
    console.log(`  │ SKU        : ${sku}`);
    console.log('  │ Status     : VERIFIED');
    console.log('  │ API        : Trading Verify Only');
    console.log('  └──────────────────────────────────────────────────');
    return;
  }

  console.log('\nStep 4: Creating Trading API fixed-price listing…');
  const addResponse = await callTradingApi(
    accessToken,
    apiBase,
    'AddFixedPriceItem',
    `<?xml version="1.0" encoding="utf-8"?><AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</AddFixedPriceItemRequest>`,
  );

  const listingId = extractXmlTag(addResponse, 'ItemID');
  console.log('✓ Trading listing created');
  console.log('');
  console.log('  ┌──────────────────────────────────────────────────');
  console.log(`  │ SKU        : ${sku}`);
  console.log(`  │ Listing ID : ${listingId || '(missing from response)'}`);
  console.log('  │ Status     : ACTIVE');
  console.log('  │ API        : Trading');
  console.log('  └──────────────────────────────────────────────────');
}
