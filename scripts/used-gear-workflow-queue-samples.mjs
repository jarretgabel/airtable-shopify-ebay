import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const APPROVED_BASE_ID = 'apprsAm2FOohEmL2u';
const APPROVED_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'used-gear-workflow-queue-samples');
const BATCH_SIZE = 10;
const SAMPLE_MARKER = '[WORKFLOW_QUEUE_SAMPLE_DATA]';
const SAMPLE_SKU_PREFIX = 'SAMPLE-WORKFLOW-QUEUE-';

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

async function fetchAllWorkflowRecords(apiKey) {
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

function buildCommonFields(index, config) {
  const sequence = String(index + 1).padStart(2, '0');
  const sku = `${SAMPLE_SKU_PREFIX}${sequence}`;
  const baseFields = {
    'Template Name': `${SAMPLE_MARKER} ${config.label}`,
    'Item Title': `${SAMPLE_MARKER} ${config.title}`,
    Description: `${SAMPLE_MARKER} ${config.description}`,
    SKU: sku,
    'SKU Legacy Backup': sku,
    Make: config.make,
    Model: config.model,
    'Component Type': config.componentType,
    'Workflow Source': config.workflowSource ?? 'Manual Entry',
    'Submission Group ID': config.submissionGroupId ?? `sample-workflow-group-${sequence}`,
    'Pick Up ID': config.pickUpId ?? `sample-workflow-pickup-${sequence}`,
    'Workflow Owner': config.workflowOwner ?? 'Sample Operator',
    'Workflow Owner Assigned At': config.workflowOwnerAssignedAt ?? config.acceptedAt ?? isoAt(index + 1, 14),
    'Qualification Complete': config.qualificationComplete,
    'Qualification Notes': `${SAMPLE_MARKER} ${config.qualificationNotes}`,
    'Offer Amount': config.offerAmount,
    'Paid Amount': config.paidAmount,
    'Confirmed Grand Total': config.confirmedGrandTotal,
    'Allocation Mode': 'Equal Split',
    'Allocation Notes': `${SAMPLE_MARKER} ${config.allocationNotes}`,
    'Workflow Status': config.workflowStatus,
  };

  return {
    ...baseFields,
    ...(config.extraFields ?? {}),
  };
}

function buildSampleRecords() {
  return [
    {
      label: 'Parking Lot 1 Pending Review',
      title: 'Parking Lot 1 Pending Review',
      description: 'Pending review sample row for Parking Lot 1 intake triage.',
      make: 'McIntosh',
      model: 'C28 Pending Intake',
      componentType: 'Preamp',
      workflowStatus: 'Pending Review',
      qualificationComplete: false,
      qualificationNotes: 'Waiting for purchasing review in Parking Lot 1.',
      offerAmount: 850,
      paidAmount: 0,
      confirmedGrandTotal: 850,
      allocationNotes: 'Parking Lot 1 queue coverage.',
      workflowSource: 'JotForm',
      pickUpId: '',
      extraFields: {
        'Submission Group ID': 'sample-workflow-submission-pl1-set-a',
      },
    },
    {
      label: 'Parking Lot 1 Submission Companion',
      title: 'Parking Lot 1 Submission Companion',
      description: 'Second pending review sample row sharing the same submission group for Parking Lot 1.',
      make: 'McIntosh',
      model: 'MR74 Pending Intake',
      componentType: 'Tuner',
      workflowStatus: 'Pending Review',
      qualificationComplete: false,
      qualificationNotes: 'Companion item from the same customer submission waiting for intake review.',
      offerAmount: 575,
      paidAmount: 0,
      confirmedGrandTotal: 575,
      allocationNotes: 'Parking Lot 1 grouped submission coverage.',
      workflowSource: 'JotForm',
      pickUpId: '',
      extraFields: {
        'Submission Group ID': 'sample-workflow-submission-pl1-set-a',
      },
    },
    {
      label: 'Trash Review Unqualified',
      title: 'Trash Review Unqualified',
      description: 'Unqualified sample row that should surface in Trash Review only.',
      make: 'Pioneer',
      model: 'SX-780 Rejected',
      componentType: 'Receiver',
      workflowStatus: 'Unqualified',
      qualificationComplete: true,
      qualificationNotes: 'Rejected during intake review.',
      offerAmount: 150,
      paidAmount: 0,
      confirmedGrandTotal: 150,
      allocationNotes: 'Trash queue coverage.',
      extraFields: {
        'Trash Status': 'Active Trash',
      },
    },
    {
      label: 'Parking Lot 2 Awaiting Arrival',
      title: 'Parking Lot 2 Awaiting Arrival',
      description: 'Accepted arrival-stage sample for Parking Lot 2.',
      make: 'Luxman',
      model: 'L-430 Awaiting Arrival',
      componentType: 'Amplifier',
      workflowStatus: 'Accepted - Awaiting Arrival',
      qualificationComplete: true,
      qualificationNotes: 'Accepted and waiting for physical intake.',
      offerAmount: 1200,
      paidAmount: 250,
      confirmedGrandTotal: 1200,
      allocationNotes: 'Lot 2 arrival coverage.',
      acceptedAt: isoAt(3, 15),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(3, 15),
        'Pick Up ID': 'sample-workflow-pickup-lot2-set-a',
      },
    },
    {
      label: 'Parking Lot 2 Arrival Set Companion',
      title: 'Parking Lot 2 Arrival Set Companion',
      description: 'Second accepted arrival-stage sample sharing the same pickup handoff set in Parking Lot 2.',
      make: 'Luxman',
      model: 'T-110 Arrival Companion',
      componentType: 'Tuner',
      workflowStatus: 'Accepted - Awaiting Arrival',
      qualificationComplete: true,
      qualificationNotes: 'Accepted as part of the same pickup set and waiting for coordinated arrival handling.',
      offerAmount: 650,
      paidAmount: 150,
      confirmedGrandTotal: 650,
      allocationNotes: 'Lot 2 grouped arrival coverage.',
      acceptedAt: isoAt(3, 16),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(3, 16),
        'Pick Up ID': 'sample-workflow-pickup-lot2-set-a',
      },
    },
    {
      label: 'Parking Lot 2 Awaiting SKU',
      title: 'Parking Lot 2 Awaiting SKU',
      description: 'Accepted sample row that arrived but still needs SKU assignment.',
      make: 'Accuphase',
      model: 'E-202 Awaiting SKU',
      componentType: 'Amplifier',
      workflowStatus: 'Accepted - Arrived, Awaiting SKU',
      qualificationComplete: true,
      qualificationNotes: 'Arrived and pending SKU assignment.',
      offerAmount: 1750,
      paidAmount: 700,
      confirmedGrandTotal: 1750,
      allocationNotes: 'Lot 2 SKU coverage.',
      acceptedAt: isoAt(4, 15),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(4, 15),
      },
    },
    {
      label: 'Parking Lot 2 Awaiting Missing Item',
      title: 'Parking Lot 2 Awaiting Missing Item',
      description: 'Accepted sample row blocked by missing accessory follow-up.',
      make: 'Technics',
      model: 'SL-1200 Missing Dust Cover',
      componentType: 'Turntable',
      workflowStatus: 'Accepted - Arrived, Awaiting Missing Item',
      qualificationComplete: true,
      qualificationNotes: 'Missing accessory must be resolved before testing.',
      offerAmount: 900,
      paidAmount: 450,
      confirmedGrandTotal: 900,
      allocationNotes: 'Lot 2 missing-item coverage.',
      acceptedAt: isoAt(5, 15),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(5, 15),
      },
    },
    {
      label: 'Testing Queue Pending Testing',
      title: 'Testing Queue Pending Testing',
      description: 'Concurrent-stage sample row with photography complete and testing still pending.',
      make: 'Sansui',
      model: 'AU-717 Testing Pending',
      componentType: 'Amplifier',
      workflowStatus: 'Testing and Photography In Progress',
      qualificationComplete: true,
      qualificationNotes: 'Waiting on testing signoff only.',
      offerAmount: 950,
      paidAmount: 525,
      confirmedGrandTotal: 950,
      allocationNotes: 'Testing queue unique pending-testing coverage.',
      acceptedAt: isoAt(6, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(6, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(6, 16),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(7, 11),
      },
    },
    {
      label: 'Photography Queue Pending Photography',
      title: 'Photography Queue Pending Photography',
      description: 'Concurrent-stage sample row with testing complete and photography still pending.',
      make: 'Nakamichi',
      model: 'BX-300 Photo Pending',
      componentType: 'Cassette Deck',
      workflowStatus: 'Testing and Photography In Progress',
      qualificationComplete: true,
      qualificationNotes: 'Waiting on photography signoff only.',
      offerAmount: 625,
      paidAmount: 310,
      confirmedGrandTotal: 625,
      allocationNotes: 'Photography queue unique pending-photo coverage.',
      acceptedAt: isoAt(7, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(7, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(7, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(8, 11),
      },
    },
    {
      label: 'Pre-Listing Queue Ready',
      title: 'Pre-Listing Queue Ready',
      description: 'Sample row that cleared both concurrent stages and is waiting for pre-listing review.',
      make: 'Audio Research',
      model: 'SP-9 Pre-Listing',
      componentType: 'Preamp',
      workflowStatus: 'Awaiting Pre-Listing Review',
      qualificationComplete: true,
      qualificationNotes: 'Ready for final listing QA.',
      offerAmount: 1400,
      paidAmount: 800,
      confirmedGrandTotal: 1400,
      allocationNotes: 'Pre-listing queue coverage.',
      acceptedAt: isoAt(8, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(8, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(8, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(9, 10),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(9, 12),
        'Awaiting Pre-Listing Review At': isoAt(9, 12),
      },
    },
    {
      label: 'Approved For Publish',
      title: 'Approved For Publish',
      description: 'Sample row for approved publish-ready workflow state.',
      make: 'Rega',
      model: 'Planar 8 Publish Ready',
      componentType: 'Turntable',
      workflowStatus: 'Approved for Publish',
      qualificationComplete: true,
      qualificationNotes: 'Publish handoff approved.',
      offerAmount: 1800,
      paidAmount: 1000,
      confirmedGrandTotal: 1800,
      allocationNotes: 'Approved-for-publish coverage.',
      acceptedAt: isoAt(9, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(9, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(9, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(10, 10),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(10, 12),
        'Awaiting Pre-Listing Review At': isoAt(10, 12),
        'Pre-Listing Reviewed By': 'Sample Reviewer',
        'Pre-Listing Reviewed At': isoAt(10, 15),
        'Approved For Publish At': isoAt(10, 15),
      },
    },
    {
      label: 'Listed Shopify',
      title: 'Listed Shopify',
      description: 'Sample row for live Shopify workflow state.',
      make: 'Thorens',
      model: 'TD-160 Shopify Live',
      componentType: 'Turntable',
      workflowStatus: 'Listed, Shopify',
      qualificationComplete: true,
      qualificationNotes: 'Published on Shopify.',
      offerAmount: 1100,
      paidAmount: 650,
      confirmedGrandTotal: 1100,
      allocationNotes: 'Listed Shopify coverage.',
      acceptedAt: isoAt(10, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(10, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(10, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(11, 10),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(11, 12),
        'Awaiting Pre-Listing Review At': isoAt(11, 12),
        'Pre-Listing Reviewed By': 'Sample Reviewer',
        'Pre-Listing Reviewed At': isoAt(11, 15),
        'Approved For Publish At': isoAt(11, 15),
        'Listed At': isoAt(12, 11),
      },
    },
    {
      label: 'Listed eBay',
      title: 'Listed eBay',
      description: 'Sample row for live eBay workflow state.',
      make: 'Marantz',
      model: '2230 eBay Live',
      componentType: 'Receiver',
      workflowStatus: 'Listed, eBay',
      qualificationComplete: true,
      qualificationNotes: 'Published on eBay.',
      offerAmount: 975,
      paidAmount: 540,
      confirmedGrandTotal: 975,
      allocationNotes: 'Listed eBay coverage.',
      acceptedAt: isoAt(11, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(11, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(11, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(12, 10),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(12, 12),
        'Awaiting Pre-Listing Review At': isoAt(12, 12),
        'Pre-Listing Reviewed By': 'Sample Reviewer',
        'Pre-Listing Reviewed At': isoAt(12, 15),
        'Approved For Publish At': isoAt(12, 15),
        'Listed At': isoAt(13, 11),
        'eBay Offer ID': 'v1|sample-workflow-offer-11|0',
        'eBay Listing ID': 'sample-workflow-listing-11',
      },
    },
    {
      label: 'Stale Listing Shopify',
      title: 'Stale Listing Shopify',
      description: 'Sample row for stale Shopify recovery workflow state.',
      make: 'Oracle',
      model: 'Alexandria Stale Shopify',
      componentType: 'Turntable',
      workflowStatus: 'Stale Listing, Shopify',
      qualificationComplete: true,
      qualificationNotes: 'Stale Shopify listing needs review.',
      offerAmount: 2100,
      paidAmount: 1200,
      confirmedGrandTotal: 2100,
      allocationNotes: 'Stale Shopify coverage.',
      acceptedAt: isoAt(12, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(12, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(12, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(13, 10),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(13, 12),
        'Awaiting Pre-Listing Review At': isoAt(13, 12),
        'Pre-Listing Reviewed By': 'Sample Reviewer',
        'Pre-Listing Reviewed At': isoAt(13, 15),
        'Approved For Publish At': isoAt(13, 15),
        'Listed At': isoAt(14, 10),
        'Stale Listing At': isoAt(20, 9),
        'Stale Recovery Status': 'Needs Review',
        'Stale Recovery Notes': `${SAMPLE_MARKER} Shopify stale listing sample.`,
        'Stale Recovery Updated At': isoAt(20, 9),
      },
    },
    {
      label: 'Stale Listing eBay',
      title: 'Stale Listing eBay',
      description: 'Sample row for stale eBay recovery workflow state.',
      make: 'JBL',
      model: 'L100 Stale eBay',
      componentType: 'Speakers',
      workflowStatus: 'Stale Listing, eBay',
      qualificationComplete: true,
      qualificationNotes: 'Stale eBay listing needs review.',
      offerAmount: 1950,
      paidAmount: 1040,
      confirmedGrandTotal: 1950,
      allocationNotes: 'Stale eBay coverage.',
      acceptedAt: isoAt(13, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(13, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(13, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(14, 10),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(14, 12),
        'Awaiting Pre-Listing Review At': isoAt(14, 12),
        'Pre-Listing Reviewed By': 'Sample Reviewer',
        'Pre-Listing Reviewed At': isoAt(14, 15),
        'Approved For Publish At': isoAt(14, 15),
        'Listed At': isoAt(15, 10),
        'Stale Listing At': isoAt(21, 9),
        'Stale Recovery Status': 'Price Refresh',
        'Stale Recovery Notes': `${SAMPLE_MARKER} eBay stale listing sample.`,
        'Stale Recovery Updated At': isoAt(21, 9),
        'eBay Offer ID': 'v1|sample-workflow-offer-13|0',
        'eBay Listing ID': 'sample-workflow-listing-13',
      },
    },
    {
      label: 'Sold Ready To Ship',
      title: 'Sold Ready To Ship',
      description: 'Sample row for sold-ready shipping handoff state.',
      make: 'Klipsch',
      model: 'Cornwall Sold Ready',
      componentType: 'Speakers',
      workflowStatus: 'Sold - Ready to Ship',
      qualificationComplete: true,
      qualificationNotes: 'Sold and waiting to ship.',
      offerAmount: 2400,
      paidAmount: 1200,
      confirmedGrandTotal: 2400,
      allocationNotes: 'Sold-ready coverage.',
      acceptedAt: isoAt(14, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(14, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(14, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(15, 10),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(15, 12),
        'Awaiting Pre-Listing Review At': isoAt(15, 12),
        'Pre-Listing Reviewed By': 'Sample Reviewer',
        'Pre-Listing Reviewed At': isoAt(15, 15),
        'Approved For Publish At': isoAt(15, 15),
        'Listed At': isoAt(16, 10),
        'Sold Ready To Ship At': isoAt(18, 9),
      },
    },
    {
      label: 'Shipped',
      title: 'Shipped',
      description: 'Sample row for completed shipped workflow state.',
      make: 'Tandberg',
      model: '3014A Shipped',
      componentType: 'Cassette Deck',
      workflowStatus: 'Shipped',
      qualificationComplete: true,
      qualificationNotes: 'Completed shipped state sample.',
      offerAmount: 1300,
      paidAmount: 740,
      confirmedGrandTotal: 1300,
      allocationNotes: 'Shipped coverage.',
      acceptedAt: isoAt(15, 14),
      extraFields: {
        'Accepted By': 'Sample Buyer',
        'Accepted At': isoAt(15, 14),
        'Processing Signed By': 'Sample Intake',
        'Processing Signed At': isoAt(15, 16),
        'Testing Signed By': 'Sample Tech',
        'Testing Signed At': isoAt(16, 10),
        'Photography Signed By': 'Sample Photo',
        'Photography Signed At': isoAt(16, 12),
        'Awaiting Pre-Listing Review At': isoAt(16, 12),
        'Pre-Listing Reviewed By': 'Sample Reviewer',
        'Pre-Listing Reviewed At': isoAt(16, 15),
        'Approved For Publish At': isoAt(16, 15),
        'Listed At': isoAt(17, 10),
        'Sold Ready To Ship At': isoAt(18, 9),
        'Shipped At': isoAt(19, 14),
      },
    },
  ].map((config, index) => ({ fields: buildCommonFields(index, config) }));
}

function isSampleRecord(record) {
  const templateName = getTrimmedString(record.fields['Template Name']);
  const itemTitle = getTrimmedString(record.fields['Item Title']);
  const qualificationNotes = getTrimmedString(record.fields['Qualification Notes']);
  const allocationNotes = getTrimmedString(record.fields['Allocation Notes']);
  const sku = getTrimmedString(record.fields.SKU);
  const skuLegacyBackup = getTrimmedString(record.fields['SKU Legacy Backup']);

  return templateName.includes(SAMPLE_MARKER)
    || itemTitle.includes(SAMPLE_MARKER)
    || qualificationNotes.includes(SAMPLE_MARKER)
    || allocationNotes.includes(SAMPLE_MARKER)
    || sku.startsWith(SAMPLE_SKU_PREFIX)
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
  const records = await fetchAllWorkflowRecords(apiKey);
  const sampleRecords = records.filter(isSampleRecord);

  console.log(`Found ${sampleRecords.length} workflow queue sample row(s) in ${APPROVED_BASE_ID}/${APPROVED_TABLE_ID}.`);
  sampleRecords.forEach((record) => {
    console.log(`- ${record.id} :: ${getTrimmedString(record.fields['Workflow Status']) || 'No Status'} :: ${getTrimmedString(record.fields['Item Title']) || 'Untitled'}`);
  });
}

async function runSeed(confirmToken, replaceExisting = false) {
  if (confirmToken !== 'CREATE_USED_GEAR_WORKFLOW_QUEUE_SAMPLES') {
    throw new Error('Seed mode requires --confirm CREATE_USED_GEAR_WORKFLOW_QUEUE_SAMPLES.');
  }

  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const existingRecords = await fetchAllWorkflowRecords(apiKey);
  const existingSampleRecords = existingRecords.filter(isSampleRecord);

  if (existingSampleRecords.length > 0 && !replaceExisting) {
    throw new Error(`Found ${existingSampleRecords.length} existing workflow queue sample row(s). Run cleanup first or use --replace true.`);
  }

  if (existingSampleRecords.length > 0) {
    await deleteRecords(apiKey, existingSampleRecords.map((record) => record.id));
  }

  const sampleRecords = buildSampleRecords();
  const createdRecords = await createRecords(apiKey, sampleRecords);
  const runDir = createRunDirectory('seed');

  writeJson(path.join(runDir, 'created-records.json'), createdRecords);
  writeJson(path.join(runDir, 'summary.json'), {
    seededAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    replacedExistingSampleCount: existingSampleRecords.length,
    createdCount: createdRecords.length,
    createdRecordIds: createdRecords.map((record) => record.id),
    createdStatuses: createdRecords.map((record) => record.fields['Workflow Status']),
    createdTitles: createdRecords.map((record) => record.fields['Item Title']),
  });

  console.log(`Created ${createdRecords.length} workflow queue sample row(s).`);
  console.log(`Artifacts saved in ${runDir}`);
}

async function runCleanup(confirmToken) {
  if (confirmToken !== 'DELETE_USED_GEAR_WORKFLOW_QUEUE_SAMPLES') {
    throw new Error('Cleanup mode requires --confirm DELETE_USED_GEAR_WORKFLOW_QUEUE_SAMPLES.');
  }

  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const records = await fetchAllWorkflowRecords(apiKey);
  const sampleRecords = records.filter(isSampleRecord);

  if (sampleRecords.length === 0) {
    console.log('No workflow queue sample rows found.');
    return;
  }

  await deleteRecords(apiKey, sampleRecords.map((record) => record.id));
  const runDir = createRunDirectory('cleanup');
  writeJson(path.join(runDir, 'deleted-records.json'), sampleRecords);

  console.log(`Deleted ${sampleRecords.length} workflow queue sample row(s).`);
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
  console.log('Used-gear workflow queue sample data helper');
  console.log('');
  console.log('Commands:');
  console.log('  list');
  console.log('    Show existing workflow queue sample rows in the linked Airtable table.');
  console.log('');
  console.log('  seed --confirm CREATE_USED_GEAR_WORKFLOW_QUEUE_SAMPLES [--replace true]');
  console.log('    Insert workflow queue sample rows covering Parking Lot 1, Parking Lot 2, Trash, testing, photography, pre-listing, and downstream states.');
  console.log('');
  console.log('  cleanup --confirm DELETE_USED_GEAR_WORKFLOW_QUEUE_SAMPLES');
  console.log('    Delete only rows created by this workflow queue sample helper.');
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