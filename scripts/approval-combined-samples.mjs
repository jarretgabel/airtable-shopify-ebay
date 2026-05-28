import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { backfillCombinedListingSampleDriveImages } from './backfill-approval-combined-sample-drive-images.mjs';

const APPROVED_BASE_ID = 'apprsAm2FOohEmL2u';
const APPROVED_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'approval-combined-samples');
const BATCH_SIZE = 10;
const SAMPLE_MARKER = '[COMBINED_LISTINGS_SAMPLE_DATA]';
const SAMPLE_SKU_PREFIX = 'SAMPLE-LISTING-';
const SAMPLE_WORKFLOW_USERS = {
  owner: 'Wes Workflow',
  purchasing: 'Paula Purchasing',
  processing: 'Iris Intake',
  testing: 'Tina Testing',
  photography: 'Perry Photos',
  listing: 'Lana Listing',
};

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv = {
  ...readEnvFile(path.join(process.cwd(), '.env')),
  ...readEnvFile(path.join(process.cwd(), '.env.local')),
  ...process.env,
};

function getEnv(name) {
  const value = mergedEnv[name]?.trim();
  return value || '';
}

function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createRunDirectory(prefix) {
  ensureDirectory(RUNS_DIR);
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(RUNS_DIR, `${prefix}-${stamp}`);
  ensureDirectory(runDir);
  return runDir;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;

  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `${response.status} ${response.statusText}`);
  }

  return body;
}

async function fetchAllListingRecords(apiKey) {
  const records = [];
  let offset = '';

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) {
      params.set('offset', offset);
    }

    const url = `https://api.airtable.com/v0/${encodeURIComponent(APPROVED_BASE_ID)}/${encodeURIComponent(APPROVED_TABLE_ID)}?${params.toString()}`;
    const payload = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    records.push(...(payload.records || []));
    offset = payload.offset || '';
  } while (offset);

  return records;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isoAt(day, hour) {
  return new Date(Date.UTC(2026, 4, day, hour, 0, 0)).toISOString();
}

function buildWorkflowSampleFields(index, workflowStatus) {
  const acceptedAt = isoAt(index + 1, 14);
  const processingSignedAt = isoAt(index + 1, 16);
  const testingSignedAt = isoAt(index + 2, 10);
  const photographySignedAt = isoAt(index + 2, 12);
  const awaitingPreListingReviewAt = isoAt(index + 2, 12);
  const preListingReviewedAt = isoAt(index + 2, 15);
  const listedAt = isoAt(index + 3, 11);

  const baseFields = {
    'Workflow Owner': SAMPLE_WORKFLOW_USERS.owner,
    'Workflow Owner Assigned At': acceptedAt,
    'Accepted By': SAMPLE_WORKFLOW_USERS.purchasing,
    'Accepted At': acceptedAt,
    'Processing Signed By': SAMPLE_WORKFLOW_USERS.processing,
    'Processing Signed At': processingSignedAt,
    'Testing Signed By': SAMPLE_WORKFLOW_USERS.testing,
    'Testing Signed At': testingSignedAt,
    'Photography Signed By': SAMPLE_WORKFLOW_USERS.photography,
    'Photography Signed At': photographySignedAt,
    'Awaiting Pre-Listing Review At': awaitingPreListingReviewAt,
  };

  if (workflowStatus === 'Awaiting Pre-Listing Review') {
    return baseFields;
  }

  if (workflowStatus === 'Approved for Publish') {
    return {
      ...baseFields,
      'Pre-Listing Reviewed By': SAMPLE_WORKFLOW_USERS.listing,
      'Pre-Listing Reviewed At': preListingReviewedAt,
      'Approved For Publish At': preListingReviewedAt,
    };
  }

  if (
    workflowStatus === 'Listed, Shopify'
    || workflowStatus === 'Listed, eBay'
    || workflowStatus === 'Stale Listing, Shopify'
    || workflowStatus === 'Stale Listing, eBay'
    || workflowStatus === 'Sold - Ready to Ship'
    || workflowStatus === 'Shipped'
  ) {
    return {
      ...baseFields,
      'Pre-Listing Reviewed By': SAMPLE_WORKFLOW_USERS.listing,
      'Pre-Listing Reviewed At': preListingReviewedAt,
      'Approved For Publish At': preListingReviewedAt,
      'Listed At': listedAt,
    };
  }

  return { 'Workflow Owner': SAMPLE_WORKFLOW_USERS.owner };
}

function buildEbayBodyHtml(title, description, keyFeatures) {
  const rows = keyFeatures
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((row) => {
      const [key, value] = row.split(',');
      return `<tr><th scope="row">${key ?? ''}</th><td>${value ?? ''}</td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body><section><h1>${title}</h1><p>${description}</p><table><tbody>${rows}</tbody></table></section></body></html>`;
}

function buildShopifyBodyHtml(description, bullets) {
  return `<p>${description}</p><ul>${bullets.map((bullet) => `<li>${bullet}</li>`).join('')}</ul>`;
}

function makeSampleFields(index, config) {
  const sku = `${SAMPLE_SKU_PREFIX}${String(index + 1).padStart(2, '0')}`;
  const keyFeatures = config.keyFeatures.join('\n');
  const listingKeyFeatures = Object.prototype.hasOwnProperty.call(config, 'listingKeyFeatures')
    ? config.listingKeyFeatures
    : keyFeatures;
  const resolvedWorkflowStatus = getTrimmedString(config.workflowFields?.['Workflow Status'])
    || (config.shopifyApproved === 'TRUE' && config.ebayApproved === 'TRUE'
      ? 'Approved for Publish'
      : 'Awaiting Pre-Listing Review');
  const defaultWorkflowFields = {
    'Workflow Status': resolvedWorkflowStatus,
    ...buildWorkflowSampleFields(index, resolvedWorkflowStatus),
    ...(config.workflowFields ?? {}),
  };

  return {
    'Template Name': `${SAMPLE_MARKER} ${config.templateName}`,
    'Item Title': `${SAMPLE_MARKER} ${config.title}`,
    Description: `${SAMPLE_MARKER} ${config.description}`,
    // Drive-backed sample images are populated immediately after seed so placeholders never persist in Airtable.
    'Images (comma-separated)': '',
    'Images (comma-separated) 2': '',
    'Images Alt Text (comma separated)': config.altTexts.join(', '),
    'Key Features (Key, Value)': listingKeyFeatures,
    'SKU Legacy Backup': sku,
    'Item Zip Code': config.zipCode,
    Condition: config.condition,
    'Shopify Type': config.shopifyType,
    'Shopify Collections': config.shopifyCollections,
    'Shopify Tags': config.shopifyTags,
    'Shopify Body (HTML)': buildShopifyBodyHtml(config.description, config.shopifyBullets),
    'Shopify Price': config.shopifyPrice,
    'Shopify Variant-Requires-Shipping': config.shopifyRequiresShipping,
    'Shopify Variant-Taxable': config.shopifyTaxable,
    'Shopify Approved': config.shopifyApproved,
    'Ebay Categories': config.ebayCategories,
    'Ebay Listing Format': config.ebayListingFormat,
    'Ebay Duration': config.ebayDuration,
    'Ebay Quantity': config.ebayQuantity,
    'Ebay Allow Offers': config.ebayAllowOffers,
    'Ebay Domestic Shipping Fees': config.ebayDomesticShippingFees,
    'Ebay Package Type': config.ebayPackageType,
    'Ebay Domestic Service 1': config.ebayDomesticService,
    'Ebay International Shipping Fees': config.ebayInternationalShippingFees,
    'Ebay International Destinations': config.ebayInternationalDestinations,
    'Ebay Excluded Locations': config.ebayExcludedLocations,
    'Ebay Combined Shipping Discount Enabled': config.ebayCombinedShippingDiscountEnabled,
    'Ebay Combined Shipping Discount Profile': config.ebayCombinedShippingDiscountProfile,
    'Ebay Handling Time Days': config.ebayHandlingTimeDays,
    'Ebay Body (HTML)': buildEbayBodyHtml(config.title, config.description, keyFeatures),
    'Ebay Price': config.ebayPrice,
    'Ebay Approved': config.ebayApproved,
    ...(config.testingFields ?? {}),
    ...(config.listingTestingNotes === undefined ? {} : { 'Testing Notes': config.listingTestingNotes }),
    ...defaultWorkflowFields,
  };
}

function buildSampleRecords() {
  return [
    {
      templateName: 'Workflow Prefill Rich Testing Sample',
      title: 'Workflow Prefill Rich Testing Sample',
      description: 'Sample row with richer testing-form data so listing pages can validate testing-detail and testing-note prefills without manual editing.',
      keyFeatures: [
        'Component Type,Stereo Receiver',
        'Cosmetic Notes,Minor veneer wear at the rear-left corner and light marks on the top grille.',
        'Includes,Original wood case, reproduction manual, and power cord.',
      ],
      listingKeyFeatures: '',
      listingTestingNotes: '',
      primaryImages: ['https://placehold.co/1200x900?text=Workflow+Testing+1'],
      secondaryImages: ['https://placehold.co/1200x900?text=Workflow+Testing+2'],
      altTexts: ['Workflow testing hero', 'Workflow testing detail'],
      zipCode: 11205,
      condition: 'Used',
      shopifyType: 'Electronics > Audio > Receivers',
      shopifyCollections: ['Receivers', 'Vintage'],
      shopifyTags: ['Sample', 'Workflow Prefill', 'Testing'],
      shopifyBullets: ['Testing-form-driven details sample', 'Listing notes should resolve from workflow fields'],
      shopifyPrice: 2299,
      shopifyRequiresShipping: 'TRUE',
      shopifyTaxable: 'TRUE',
      shopifyApproved: 'FALSE',
      ebayCategories: ['Receivers'],
      ebayListingFormat: 'Buy It Now',
      ebayDuration: 'GTC',
      ebayQuantity: 1,
      ebayAllowOffers: 'TRUE',
      ebayDomesticShippingFees: 'Calculated',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Calculated',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: false,
      ebayCombinedShippingDiscountProfile: '',
      ebayHandlingTimeDays: 2,
      ebayPrice: 2299,
      ebayApproved: 'FALSE',
      testingFields: {
        Manual: ['Included'],
        'Original Box': ['No'],
        Voltage: '120V',
        Remote: ['Included'],
        'Power Cable': ['Included'],
        'Audiogon Rating': '8/10',
        'Testing Cosmetic Notes': 'Minor veneer wear at the rear-left corner and light marks on the top grille.',
      },
      workflowFields: {
        'Workflow Status': 'Approved for Publish',
        Make: 'Marantz',
        Model: '2270',
        'Component Type': 'Stereo Receiver',
        'Inventory Notes': 'Recently serviced vintage receiver with strong phono performance and a stable extended listening test result.',
        'Testing Notes': 'Passed extended bench and listening tests. Bias and DC offset are stable, tuner locks cleanly, and the phono stage is quiet.',
        'Internal Functional Notes': 'All inputs, outputs, tone controls, lights, and tuner presets were verified after control cleaning.',
        'Internal Inclusion Notes': 'Original wood case, reproduction manual, and power cord included.',
        'Internal Cosmetic Notes': 'Minor veneer wear at the rear-left corner with light marks on the top grille.',
      },
    },
    {
      templateName: 'Combined Draft Pending Review',
      title: 'Combined Draft Pending Review',
      description: 'Draft record with both channels still pending approval so the queue can exercise the base combined workflow.',
      keyFeatures: ['State,Pending Review', 'Focus,Base combined draft'],
      primaryImages: ['https://placehold.co/1200x900?text=Combined+Draft+1'],
      secondaryImages: ['https://placehold.co/1200x900?text=Combined+Draft+2'],
      altTexts: ['Combined draft hero', 'Combined draft detail'],
      zipCode: 11205,
      condition: 'Used',
      shopifyType: 'Electronics > Audio > Amplifiers > Preamplifiers',
      shopifyCollections: ['Sample Collection'],
      shopifyTags: ['Sample', 'Pending'],
      shopifyBullets: ['Pending Shopify approval', 'Pending eBay approval'],
      shopifyPrice: 1299.99,
      shopifyRequiresShipping: 'TRUE',
      shopifyTaxable: 'TRUE',
      shopifyApproved: 'FALSE',
      ebayCategories: ['Vintage Electronics'],
      ebayListingFormat: 'Buy It Now',
      ebayDuration: 'GTC',
      ebayQuantity: 1,
      ebayAllowOffers: 'FALSE',
      ebayDomesticShippingFees: 'Calculated',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Calculated',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: true,
      ebayCombinedShippingDiscountProfile: 'Untitled Calculated Discount Profile (HighEndAudioAuctions)',
      ebayHandlingTimeDays: 3,
      ebayPrice: 1299.99,
      ebayApproved: 'FALSE',
    },
    {
      templateName: 'Shopify Ready Only',
      title: 'Shopify Ready Only',
      description: 'Listing sample where Shopify is approved and eBay remains pending.',
      keyFeatures: ['Channel,Shopify', 'Approval,Shopify only'],
      primaryImages: ['https://placehold.co/1200x900?text=Shopify+Only+1'],
      secondaryImages: ['https://placehold.co/1200x900?text=Shopify+Only+2'],
      altTexts: ['Shopify only hero', 'Shopify only detail'],
      zipCode: 11205,
      condition: 'Open Box',
      shopifyType: 'Electronics > Audio > Audio Players & Recorders > Turntables & Record Players',
      shopifyCollections: ['Turntables'],
      shopifyTags: ['Sample', 'Shopify Ready'],
      shopifyBullets: ['Approved for Shopify', 'eBay still pending'],
      shopifyPrice: 1899.5,
      shopifyRequiresShipping: 'TRUE',
      shopifyTaxable: 'TRUE',
      shopifyApproved: 'TRUE',
      ebayCategories: ['Record Players/Home Turntables'],
      ebayListingFormat: 'Buy It Now',
      ebayDuration: 'GTC',
      ebayQuantity: 1,
      ebayAllowOffers: 'FALSE',
      ebayDomesticShippingFees: 'Calculated',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Calculated',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: false,
      ebayCombinedShippingDiscountProfile: '',
      ebayHandlingTimeDays: 3,
      ebayPrice: 1899.5,
      ebayApproved: 'FALSE',
    },
    {
      templateName: 'eBay Fixed Price Ready',
      title: 'eBay Fixed Price Ready',
      description: 'Fixed-price eBay record with eBay approved and Shopify still pending.',
      keyFeatures: ['Channel,eBay', 'Format,Fixed Price'],
      primaryImages: ['https://placehold.co/1200x900?text=eBay+Fixed+1'],
      secondaryImages: ['https://placehold.co/1200x900?text=eBay+Fixed+2'],
      altTexts: ['eBay fixed hero', 'eBay fixed detail'],
      zipCode: 11205,
      condition: 'Used',
      shopifyType: 'Electronics > Audio > Receivers',
      shopifyCollections: ['Receivers'],
      shopifyTags: ['Sample', 'eBay Ready'],
      shopifyBullets: ['eBay approved', 'Shopify pending'],
      shopifyPrice: 999.99,
      shopifyRequiresShipping: 'TRUE',
      shopifyTaxable: 'TRUE',
      shopifyApproved: 'FALSE',
      ebayCategories: ['Receivers'],
      ebayListingFormat: 'Buy It Now',
      ebayDuration: 'GTC',
      ebayQuantity: 1,
      ebayAllowOffers: 'TRUE',
      ebayDomesticShippingFees: 'Flat',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Flat',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: false,
      ebayCombinedShippingDiscountProfile: '',
      ebayHandlingTimeDays: 2,
      ebayPrice: 999.99,
      ebayApproved: 'TRUE',
    },
    {
      templateName: 'eBay Auction Flow',
      title: 'eBay Auction Flow',
      description: 'Auction-style eBay listing sample with a shorter duration and offer-disabled configuration.',
      keyFeatures: ['Channel,eBay', 'Format,Auction'],
      primaryImages: ['https://placehold.co/1200x900?text=eBay+Auction+1'],
      secondaryImages: ['https://placehold.co/1200x900?text=eBay+Auction+2'],
      altTexts: ['eBay auction hero', 'eBay auction detail'],
      zipCode: 11205,
      condition: 'Used',
      shopifyType: 'Electronics > Audio > CD Players',
      shopifyCollections: ['Digital'],
      shopifyTags: ['Sample', 'Auction'],
      shopifyBullets: ['Auction flow sample', 'Shopify pending'],
      shopifyPrice: 749.5,
      shopifyRequiresShipping: 'TRUE',
      shopifyTaxable: 'TRUE',
      shopifyApproved: 'FALSE',
      ebayCategories: ['CD Players & Recorders'],
      ebayListingFormat: 'Auction',
      ebayDuration: 'DAYS_7',
      ebayQuantity: 1,
      ebayAllowOffers: 'FALSE',
      ebayDomesticShippingFees: 'Calculated',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Calculated',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: true,
      ebayCombinedShippingDiscountProfile: 'Untitled Calculated Discount Profile (HighEndAudioAuctions)',
      ebayHandlingTimeDays: 3,
      ebayPrice: 749.5,
      ebayApproved: 'TRUE',
    },
    {
      templateName: 'Both Channels Approved',
      title: 'Both Channels Approved',
      description: 'Record where both Shopify and eBay are approved for publish testing.',
      keyFeatures: ['Channel,Both', 'Approval,Both approved'],
      primaryImages: ['https://placehold.co/1200x900?text=Both+Approved+1'],
      secondaryImages: ['https://placehold.co/1200x900?text=Both+Approved+2'],
      altTexts: ['Both approved hero', 'Both approved detail'],
      zipCode: 11205,
      condition: 'New',
      shopifyType: 'Electronics > Audio > Amplifiers > Power Amplifiers',
      shopifyCollections: ['Amplifiers'],
      shopifyTags: ['Sample', 'Both Ready'],
      shopifyBullets: ['Both channels approved', 'Rich media sample'],
      shopifyPrice: 2599,
      shopifyRequiresShipping: 'TRUE',
      shopifyTaxable: 'TRUE',
      shopifyApproved: 'TRUE',
      ebayCategories: ['Power Amplifiers'],
      ebayListingFormat: 'Buy It Now',
      ebayDuration: 'GTC',
      ebayQuantity: 1,
      ebayAllowOffers: 'TRUE',
      ebayDomesticShippingFees: 'Flat',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Flat',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: false,
      ebayCombinedShippingDiscountProfile: '',
      ebayHandlingTimeDays: 2,
      ebayPrice: 2599,
      ebayApproved: 'TRUE',
    },
    {
      templateName: 'Local Pickup / No Shipping',
      title: 'Local Pickup / No Shipping',
      description: 'Local pickup style sample with non-shipping Shopify variant settings.',
      keyFeatures: ['Shipping,Local Pickup', 'Taxable,FALSE'],
      primaryImages: ['https://placehold.co/1200x900?text=Local+Pickup+1'],
      secondaryImages: ['https://placehold.co/1200x900?text=Local+Pickup+2'],
      altTexts: ['Local pickup hero', 'Local pickup detail'],
      zipCode: 11205,
      condition: 'Used',
      shopifyType: 'Electronics > Audio > Speakers',
      shopifyCollections: ['Speakers'],
      shopifyTags: ['Sample', 'Local Pickup'],
      shopifyBullets: ['No shipping required', 'Pickup-focused config'],
      shopifyPrice: 849,
      shopifyRequiresShipping: 'FALSE',
      shopifyTaxable: 'FALSE',
      shopifyApproved: 'TRUE',
      ebayCategories: ['Home Speakers & Subwoofers'],
      ebayListingFormat: 'Buy It Now',
      ebayDuration: 'GTC',
      ebayQuantity: 1,
      ebayAllowOffers: 'FALSE',
      ebayDomesticShippingFees: 'Flat',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Flat',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: false,
      ebayCombinedShippingDiscountProfile: '',
      ebayHandlingTimeDays: 1,
      ebayPrice: 849,
      ebayApproved: 'FALSE',
    },
    {
      templateName: 'Media Heavy Rich HTML',
      title: 'Media Heavy Rich HTML',
      description: 'Sample with multiple images, long HTML bodies, and denser merchandising content.',
      keyFeatures: ['Media,Heavy', 'HTML,Rich'],
      primaryImages: ['https://placehold.co/1200x900?text=Rich+HTML+1', 'https://placehold.co/1200x900?text=Rich+HTML+2'],
      secondaryImages: ['https://placehold.co/1200x900?text=Rich+HTML+3'],
      altTexts: ['Rich html hero', 'Rich html alt 2', 'Rich html alt 3'],
      zipCode: 11205,
      condition: 'Used',
      shopifyType: 'Electronics > Audio > Equalizers',
      shopifyCollections: ['Accessories', 'Featured'],
      shopifyTags: ['Sample', 'HTML', 'Media'],
      shopifyBullets: ['Multiple images', 'Expanded HTML body', 'Testing payload previews'],
      shopifyPrice: 1495,
      shopifyRequiresShipping: 'TRUE',
      shopifyTaxable: 'TRUE',
      shopifyApproved: 'TRUE',
      ebayCategories: ['Equalizers'],
      ebayListingFormat: 'Buy It Now',
      ebayDuration: 'GTC',
      ebayQuantity: 1,
      ebayAllowOffers: 'TRUE',
      ebayDomesticShippingFees: 'Calculated',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Calculated',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: true,
      ebayCombinedShippingDiscountProfile: 'Untitled Calculated Discount Profile (HighEndAudioAuctions)',
      ebayHandlingTimeDays: 2,
      ebayPrice: 1495,
      ebayApproved: 'TRUE',
    },
    {
      templateName: 'Sparse Draft / Needs Merchandising',
      title: 'Sparse Draft / Needs Merchandising',
      description: 'Intentionally sparse draft for testing incomplete approval states and missing merchandising details.',
      keyFeatures: ['State,Sparse Draft', 'Review,Needs Merchandising'],
      primaryImages: ['https://placehold.co/1200x900?text=Sparse+Draft+1'],
      secondaryImages: [],
      altTexts: ['Sparse draft hero'],
      zipCode: 11205,
      condition: 'Used',
      shopifyType: 'Electronics > Audio',
      shopifyCollections: [],
      shopifyTags: ['Sample', 'Sparse'],
      shopifyBullets: ['Sparse draft', 'Needs merchandising'],
      shopifyPrice: 499,
      shopifyRequiresShipping: 'TRUE',
      shopifyTaxable: 'TRUE',
      shopifyApproved: 'FALSE',
      ebayCategories: ['Other Consumer Electronics'],
      ebayListingFormat: 'Buy It Now',
      ebayDuration: 'DAYS_7',
      ebayQuantity: 1,
      ebayAllowOffers: 'FALSE',
      ebayDomesticShippingFees: 'Flat',
      ebayPackageType: 'Package/Thick Envelope',
      ebayDomesticService: 'UPS Ground',
      ebayInternationalShippingFees: 'Flat',
      ebayInternationalDestinations: 'Worldwide',
      ebayExcludedLocations: 'None',
      ebayCombinedShippingDiscountEnabled: false,
      ebayCombinedShippingDiscountProfile: '',
      ebayHandlingTimeDays: 3,
      ebayPrice: 499,
      ebayApproved: 'FALSE',
    },
  ].map((config, index) => ({ fields: makeSampleFields(index, config) }));
}

function isSampleRecord(record) {
  const templateName = getTrimmedString(record.fields['Template Name']);
  const itemTitle = getTrimmedString(record.fields['Item Title']);
  const description = getTrimmedString(record.fields.Description);
  const skuLegacyBackup = getTrimmedString(record.fields['SKU Legacy Backup']);

  return templateName.includes(SAMPLE_MARKER)
    || itemTitle.includes(SAMPLE_MARKER)
    || description.includes(SAMPLE_MARKER)
    || skuLegacyBackup.startsWith(SAMPLE_SKU_PREFIX);
}

async function createRecords(apiKey, records) {
  const createdRecords = [];

  for (const batch of chunk(records, BATCH_SIZE)) {
    const url = `https://api.airtable.com/v0/${encodeURIComponent(APPROVED_BASE_ID)}/${encodeURIComponent(APPROVED_TABLE_ID)}`;
    const payload = await fetchJson(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        typecast: true,
        records: batch,
      }),
    });

    createdRecords.push(...(payload.records || []));
  }

  return createdRecords;
}

async function deleteRecords(apiKey, recordIds) {
  for (const batch of chunk(recordIds, BATCH_SIZE)) {
    const params = new URLSearchParams();
    batch.forEach((recordId) => params.append('records[]', recordId));

    const url = `https://api.airtable.com/v0/${encodeURIComponent(APPROVED_BASE_ID)}/${encodeURIComponent(APPROVED_TABLE_ID)}?${params.toString()}`;
    await fetchJson(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }
}

async function runList() {
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const records = await fetchAllListingRecords(apiKey);
  const sampleRecords = records.filter(isSampleRecord);

  console.log(`Found ${sampleRecords.length} sample combined listing row(s) in ${APPROVED_BASE_ID}/${APPROVED_TABLE_ID}.`);
  sampleRecords.forEach((record) => {
    console.log(`- ${record.id} :: Shopify ${getTrimmedString(record.fields['Shopify Approved']) || 'FALSE'} :: eBay ${getTrimmedString(record.fields['Ebay Approved']) || 'FALSE'} :: ${getTrimmedString(record.fields['Item Title']) || 'Untitled'}`);
  });
}

async function runSeed(confirmToken, replaceExisting = false) {
  if (confirmToken !== 'CREATE_COMBINED_LISTINGS_SAMPLES') {
    throw new Error('Seed mode requires --confirm CREATE_COMBINED_LISTINGS_SAMPLES.');
  }

  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const existingRecords = await fetchAllListingRecords(apiKey);
  const existingSampleRecords = existingRecords.filter(isSampleRecord);

  if (existingSampleRecords.length > 0 && !replaceExisting) {
    throw new Error(`Found ${existingSampleRecords.length} existing sample listing row(s). Run cleanup first or use --replace true.`);
  }

  if (existingSampleRecords.length > 0) {
    await deleteRecords(apiKey, existingSampleRecords.map((record) => record.id));
  }

  const sampleRecords = buildSampleRecords();
  const createdRecords = await createRecords(apiKey, sampleRecords);
  const driveBackfill = await backfillCombinedListingSampleDriveImages({
    apiKey,
    records: createdRecords,
  });
  const runDir = createRunDirectory('seed');

  writeJson(path.join(runDir, 'created-records.json'), createdRecords);
  writeJson(path.join(runDir, 'summary.json'), {
    seededAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    replacedExistingSampleCount: existingSampleRecords.length,
    createdCount: createdRecords.length,
    createdRecordIds: createdRecords.map((record) => record.id),
    createdTitles: createdRecords.map((record) => record.fields['Item Title']),
    driveBackfillUpdatedCount: driveBackfill.updatedCount,
    driveBackfillRunDir: driveBackfill.runDir,
  });

  console.log(`Created ${createdRecords.length} sample combined listing row(s).`);
  console.log(`Backfilled ${driveBackfill.updatedCount} sample combined listing row(s) with Drive-backed images.`);
  console.log(`Artifacts saved in ${runDir}`);
}

async function runCleanup(confirmToken) {
  if (confirmToken !== 'DELETE_COMBINED_LISTINGS_SAMPLES') {
    throw new Error('Cleanup mode requires --confirm DELETE_COMBINED_LISTINGS_SAMPLES.');
  }

  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const records = await fetchAllListingRecords(apiKey);
  const sampleRecords = records.filter(isSampleRecord);

  if (sampleRecords.length === 0) {
    console.log('No sample combined listing rows found.');
    return;
  }

  await deleteRecords(apiKey, sampleRecords.map((record) => record.id));
  const runDir = createRunDirectory('cleanup');
  writeJson(path.join(runDir, 'deleted-records.json'), sampleRecords);

  console.log(`Deleted ${sampleRecords.length} sample combined listing row(s).`);
  console.log(`Artifacts saved in ${runDir}`);
}

function parseArgs(argv) {
  const args = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const nextToken = argv[index + 1];
      if (!nextToken || nextToken.startsWith('--')) {
        args[key] = 'true';
      } else {
        args[key] = nextToken;
        index += 1;
      }
      continue;
    }

    args._.push(token);
  }

  return args;
}

function printHelp() {
  console.log('Combined listings sample data helper');
  console.log('');
  console.log('Commands:');
  console.log('  list');
  console.log('    Show existing sample rows in the linked combined listings table.');
  console.log('');
  console.log('  seed --confirm CREATE_COMBINED_LISTINGS_SAMPLES [--replace true]');
  console.log('    Insert combined listings approval sample rows into the linked Airtable table and backfill Drive-backed image URLs.');
  console.log('');
  console.log('  cleanup --confirm DELETE_COMBINED_LISTINGS_SAMPLES');
  console.log('    Delete only rows created by this sample-data helper.');
  console.log('');
  console.log('Environment:');
  console.log('  VITE_AIRTABLE_API_KEY is required.');
  console.log('');
  console.log('Safety notes:');
  console.log(`  - Scope is hard-locked to base ${APPROVED_BASE_ID}, table ${APPROVED_TABLE_ID}.`);
  console.log(`  - Created rows are marked with ${SAMPLE_MARKER} and ${SAMPLE_SKU_PREFIX} for cleanup.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'help';

  switch (command) {
    case 'list':
      await runList();
      return;
    case 'seed':
      await runSeed(args.confirm || '', args.replace === 'true');
      return;
    case 'cleanup':
      await runCleanup(args.confirm || '');
      return;
    case 'help':
    default:
      printHelp();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});