/**
 * eBay Production — OAuth + Create Draft Listing CLI Tool
 *
 * Usage:
 *   Step 1: nvm use 20 && node tests/test-create-ebay-listing.mjs --api=inventory
 *           → Prints the OAuth URL. Visit it in your browser.
 *
 *   Step 2: After eBay redirects to http://localhost:3000?code=XXX&state=ebay_oauth,
 *           copy the `code` value from the URL bar (everything after `code=` and before `&`).
 *
 *   Step 3: nvm use 20 && node tests/test-create-ebay-listing.mjs --api=inventory --code=YOUR_CODE_HERE
 *           → Exchanges code for tokens, saves refresh token to .env.local, creates listing.
 *
 *   Optional: Use --api=trading to create a live fixed-price listing via Trading API.
 *   Optional: Use --api=trading-verify to validate the Trading payload without creating a listing.
 */

import { readFileSync, writeFileSync } from 'fs';

// ── Load .env.local ────────────────────────────────────────────────────────────
const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;
const rawEnv = readFileSync(ENV_PATH, 'utf-8');
const env = Object.fromEntries(
  rawEnv
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const CLIENT_ID     = env['VITE_EBAY_CLIENT_ID'] ?? '';
const CLIENT_SECRET = env['VITE_EBAY_CLIENT_SECRET'] ?? '';
const RU_NAME       = env['VITE_EBAY_RU_NAME'] ?? '';
const IS_SANDBOX    = (env['VITE_EBAY_ENV'] ?? 'sandbox').toLowerCase() !== 'production';

const API_BASE  = IS_SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const AUTH_BASE = IS_SANDBOX ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
].join(' ');

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

console.log('eBay Production — Create Listing Script');
console.log('═══════════════════════════════════════════════');
console.log(`Env       : ${IS_SANDBOX ? 'SANDBOX' : 'PRODUCTION'}`);
console.log(`Client ID : ${CLIENT_ID}`);
console.log(`RuName    : ${RU_NAME || '(not set — set VITE_EBAY_RU_NAME)'}`);
console.log(`API Base  : ${API_BASE}`);
console.log('');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: VITE_EBAY_CLIENT_ID and VITE_EBAY_CLIENT_SECRET not set in .env.local');
  process.exit(1);
}

// ── Parse CLI args ─────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...rest] = a.slice(2).split('=');
      return [k, rest.join('=')];
    })
);

  const rawApiMode = args.api?.toLowerCase();
  const API_MODE = rawApiMode === 'trading' || rawApiMode === 'trading-verify' ? rawApiMode : 'inventory';
  const LOCATION_NAME = env['VITE_EBAY_LOCATION_NAME'] ?? 'Resolution AV Warehouse';
  const LOCATION_POSTAL_CODE = env['VITE_EBAY_LOCATION_POSTAL_CODE'] ?? '';
  const LOCATION_CITY = env['VITE_EBAY_LOCATION_CITY'] ?? '';
  const LOCATION_STATE = env['VITE_EBAY_LOCATION_STATE'] ?? '';
  const FULFILLMENT_POLICY_ID = env['VITE_EBAY_FULFILLMENT_POLICY_ID'] ?? '';
  const PAYMENT_POLICY_ID = env['VITE_EBAY_PAYMENT_POLICY_ID'] ?? '';
  const RETURN_POLICY_ID = env['VITE_EBAY_RETURN_POLICY_ID'] ?? '';

function normalizeCode(code) {
  if (!code) return code;
  try {
    return decodeURIComponent(code);
  } catch {
    return code;
  }
}

function normalizeToken(token) {
  if (!token) return token;
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
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
    .map(match => match[1].trim())
    .filter(Boolean)
    .join(' | ');
}

// ── Helper: save refresh token back to .env.local ─────────────────────────────
function saveRefreshToken(refreshToken) {
  const normalized = normalizeToken(refreshToken);
  let updated = rawEnv;
  if (updated.includes('VITE_EBAY_REFRESH_TOKEN=')) {
    updated = updated.replace(/^VITE_EBAY_REFRESH_TOKEN=.*$/m, `VITE_EBAY_REFRESH_TOKEN=${normalized}`);
  } else {
    updated = updated.replace(
      /^VITE_EBAY_ENV=/m,
      `VITE_EBAY_REFRESH_TOKEN=${normalized}\nVITE_EBAY_ENV=`
    );
  }
  writeFileSync(ENV_PATH, updated);
  console.log('✓ Refresh token saved to .env.local (VITE_EBAY_REFRESH_TOKEN)');
}

// ── Helper: create draft inventory item + offer ───────────────────────────────
const SAMPLE_SKU = 'RAVMCINTOSHMA8900001';

async function createDraftListing(accessToken) {
  console.log('\nStep 3: Creating inventory item…');
  const itemRes = await fetch(`${API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(SAMPLE_SKU)}`, {
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
          'Features include a built-in DAC, MM/MC phono stage, and McIntosh\'s iconic illuminated watt meters.</p>',
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
  console.log(`✓ Inventory item created — SKU: ${SAMPLE_SKU}`);

  console.log('\nStep 4: Creating draft offer (UNPUBLISHED)…');
  const offerRes = await fetch(`${API_BASE}/sell/inventory/v1/offer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify({
      sku: SAMPLE_SKU,
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
    // Production may report an existing offer as 400/errorId 25002 instead of 409.
    if (offerRes.status === 409 || err.errors?.some(error => error.errorId === 25002)) {
      console.log('  ℹ Offer already exists for this SKU.');
      const listRes = await fetch(
        `${API_BASE}/sell/inventory/v1/offer?sku=${encodeURIComponent(SAMPLE_SKU)}&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Accept-Language': 'en-US',
          },
        }
      );
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
  console.log(`  │ SKU      : ${SAMPLE_SKU}`);
  console.log(`  │ Offer ID : ${offerData.offerId}`);
  console.log(`  │ Price    : $4,999.00 USD`);
  console.log(`  │ Status   : UNPUBLISHED`);
  console.log('  └──────────────────────────────────────────────────');
}

async function callTradingApi(accessToken, callName, body) {
  const res = await fetch(`${API_BASE}/ws/api.dll`, {
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

async function createTradingListing(accessToken, mode = 'trading') {
  if (!LOCATION_POSTAL_CODE.trim()) {
    throw new Error('Trading API listing requires VITE_EBAY_LOCATION_POSTAL_CODE in .env.local');
  }

  const sku = `RAVTRADING${Date.now()}`;
  const locationLabel = [LOCATION_CITY, LOCATION_STATE].filter(Boolean).join(', ') || LOCATION_NAME;
  const sellerProfiles = FULFILLMENT_POLICY_ID && PAYMENT_POLICY_ID && RETURN_POLICY_ID
    ? [
        '<SellerProfiles>',
        `<SellerShippingProfile><ShippingProfileID>${escapeXml(FULFILLMENT_POLICY_ID)}</ShippingProfileID></SellerShippingProfile>`,
        `<SellerPaymentProfile><PaymentProfileID>${escapeXml(PAYMENT_POLICY_ID)}</PaymentProfileID></SellerPaymentProfile>`,
        `<SellerReturnProfile><ReturnProfileID>${escapeXml(RETURN_POLICY_ID)}</ReturnProfileID></SellerReturnProfile>`,
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
    `<PostalCode>${escapeXml(LOCATION_POSTAL_CODE)}</PostalCode>`,
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
    'VerifyAddFixedPriceItem',
    `<?xml version="1.0" encoding="utf-8"?><VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</VerifyAddFixedPriceItemRequest>`
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
    'AddFixedPriceItem',
    `<?xml version="1.0" encoding="utf-8"?><AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><WarningLevel>High</WarningLevel>${itemPayload}</AddFixedPriceItemRequest>`
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

// ── Main flow ─────────────────────────────────────────────────────────────────

if (args.code) {
  // ── Token exchange path ────────────────────────────────────────────────────
  const oauthCode = normalizeCode(args.code);
  console.log('Step 1: Exchanging authorization code for user token…');
  const tokenRes = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: oauthCode,
      redirect_uri: RU_NAME,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    console.error(`✗ Token exchange failed: HTTP ${tokenRes.status}`);
    console.error(JSON.stringify(err, null, 2));
    console.error('\nCommon causes:');
    console.error('  • The authorization code expired (codes are valid for ~5 minutes)');
    console.error('  • The RuName doesn\'t match the one used when you started the OAuth flow');
    console.error('  • The code was already used (each code is single-use)');
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  console.log(`✓ User token obtained — expires in ${tokenData.expires_in}s`);

  if (tokenData.refresh_token) {
    console.log('\nStep 2: Saving refresh token to .env.local…');
    saveRefreshToken(tokenData.refresh_token);
  }

  if (API_MODE === 'trading') {
    await createTradingListing(tokenData.access_token, API_MODE);
  } else if (API_MODE === 'trading-verify') {
    await createTradingListing(tokenData.access_token, API_MODE);
  } else {
    await createDraftListing(tokenData.access_token);
  }

} else if (env['VITE_EBAY_REFRESH_TOKEN']) {
  // ── Refresh token path ─────────────────────────────────────────────────────
  console.log('Step 1: Refreshing access token from stored refresh token…');
  const tokenRes = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: normalizeToken(env['VITE_EBAY_REFRESH_TOKEN']),
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    console.error(`✗ Token refresh failed: HTTP ${tokenRes.status}`);
    console.error(JSON.stringify(err, null, 2));
    console.log('\nRun without --code to get a fresh OAuth URL and re-authenticate.');
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  console.log(`✓ Access token refreshed — expires in ${tokenData.expires_in}s`);
  if (tokenData.refresh_token) saveRefreshToken(tokenData.refresh_token);

  if (API_MODE === 'trading') {
    await createTradingListing(tokenData.access_token, API_MODE);
  } else if (API_MODE === 'trading-verify') {
    await createTradingListing(tokenData.access_token, API_MODE);
  } else {
    await createDraftListing(tokenData.access_token);
  }

} else {
  // ── OAuth URL path (no code yet) ───────────────────────────────────────────
  if (!RU_NAME) {
    console.error('ERROR: VITE_EBAY_RU_NAME is not set in .env.local');
    console.error('  1. Go to developer.ebay.com/my/keys → your production app → User Tokens');
    console.error('  2. Register http://localhost:3000 as a redirect URL');
    console.error('  3. Copy the RuName and add it to .env.local as VITE_EBAY_RU_NAME');
    process.exit(1);
  }

  // Build auth URL with proper %20 encoding (not + which eBay rejects)
  const authUrl = AUTH_BASE + '/oauth2/authorize?' + [
    `client_id=${encodeURIComponent(CLIENT_ID)}`,
    `redirect_uri=${encodeURIComponent(RU_NAME)}`,
    `response_type=code`,
    `scope=${encodeURIComponent(SCOPES)}`,
    `state=ebay_oauth`,
  ].join('&');

  console.log('Step 1: Visit this URL in your browser to authorize the app:\n');
  console.log(`  ${authUrl}`);
  console.log('');
  console.log('  After granting access, eBay will redirect to:');
  console.log('  http://localhost:3000?code=XXXX&state=ebay_oauth');
  console.log('');
  console.log('Step 2: Copy the `code` value from the URL bar, then run:\n');
  console.log('  node tests/test-create-ebay-listing.mjs --code=PASTE_CODE_HERE');
  console.log('');
  console.log('Note: The app at localhost:3000 will ALSO auto-handle the code — you');
  console.log('      only need this script if the app\'s connect flow isn\'t working.');
}
