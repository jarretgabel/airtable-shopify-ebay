// Script to seed workflow images to Google Drive using the app's existing integration.
// Usage: node scripts/seed_workflow_images/index.js


import { archiveWorkflowImagesToGoogleDrive } from '../../aws/src/providers/googleDrive/client.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Airtable API config
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = 'apprsAm2FOohEmL2u';
const AIRTABLE_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const AIRTABLE_VIEW_ID = 'viwZdrQSBohX1m35D';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

const STATUS_FIELD = 'Workflow Status';
const LISTING_KEY_FIELD = 'Listing Key';
const ALLOWED_STEPS = ['pre-listing', 'listing', 'post publish', 'shipped'];
const STATUS_MAP = {
  'Awaiting Pre-Listing Review': 'pre-listing',
  'Approved for Publish': 'listing',
  'Listed, Shopify': 'post publish',
  'Listed, eBay': 'post publish',
  'Shipped': 'shipped',
};

// Helper to extract all image URLs for a record
function extractImages(fields) {
  // Intake: Shopify REST Image 1 Src, ...
  const intakeImages = [];
  for (let i = 1; i <= 5; i++) {
    const url = fields[`Shopify REST Image ${i} Src`];
    if (url && url.startsWith('http')) intakeImages.push(url);
  }
  // Testing: Shopify GraphQL Media 1 Original Source, ...
  const testingImages = [];
  for (let i = 1; i <= 5; i++) {
    const url = fields[`Shopify GraphQL Media ${i} Original Source`];
    if (url && url.startsWith('http')) testingImages.push(url);
  }
  // Photography: eBay Offer Energy Efficiency Image URL, eBay Offer Hazmat Pictogram 1, ...
  const photographyImages = [];
  const photoFields = [
    'eBay Offer Energy Efficiency Image URL',
    'eBay Offer Hazmat Pictogram 1',
    'eBay Offer Hazmat Pictogram 2',
    'eBay Offer Hazmat Pictogram 3',
    'eBay Offer Product Safety Pictogram 1',
    'eBay Offer Product Safety Pictogram 2',
    'eBay Offer Product Safety Pictogram 3',
  ];
  for (const field of photoFields) {
    const url = fields[field];
    if (url && url.startsWith('http')) photographyImages.push(url);
  }
  return { intakeImages, testingImages, photographyImages };
}

async function downloadImageAsBase64(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const contentType = response.headers['content-type'] || 'image/jpeg';
  const base64 = Buffer.from(response.data, 'binary').toString('base64');
  return { base64, contentType };
}


async function fetchWorkflowRecords() {
  let offset = undefined;
  const allRecords = [];
  do {
    const params = new URLSearchParams({
      view: AIRTABLE_VIEW_ID,
      ...(offset ? { offset } : {}),
      pageSize: '100',
    });
    const response = await axios.get(`${AIRTABLE_API_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });
    const { records, offset: nextOffset } = response.data;
    for (const rec of records) {
      const fields = rec.fields || {};
      const status = fields[STATUS_FIELD]?.trim();
      const step = STATUS_MAP[status] || status?.toLowerCase();
      if (!ALLOWED_STEPS.includes(step)) continue;
      const { intakeImages, testingImages, photographyImages } = extractImages(fields);
      allRecords.push({
        id: fields[LISTING_KEY_FIELD] || rec.id,
        workflowStep: step,
        intakeImages,
        testingImages,
        photographyImages,
      });
    }
    offset = nextOffset;
  } while (offset);
  return allRecords;
}

async function main() {
  const records = await fetchWorkflowRecords();
  for (const record of records) {
    for (const [stage, images] of Object.entries({
      intake: record.intakeImages,
      testing: record.testingImages,
      photos: record.photographyImages,
    })) {
      if (!images || images.length === 0) continue;
      for (const imageUrl of images) {
        const filename = path.basename(imageUrl.split('?')[0]);
        try {
          const { base64, contentType } = await downloadImageAsBase64(imageUrl);
          const isIntakeStage = stage === 'intake';
          const payload = {
            folderKey: record.id,
            stage,
            original: { filename, contentType, file: base64 },
            processed: { filename, contentType, file: base64 },
          };
          const result = await archiveWorkflowImagesToGoogleDrive(payload);
          console.log(
            `Uploaded ${filename} for ${record.id} (${stage}):`,
            isIntakeStage ? result.original.url : result.processed.url,
          );
        } catch (err) {
          console.error(`Failed to upload ${filename} for ${record.id}:`, err.message);
        }
      }
    }
  }
}

main().catch(console.error);
