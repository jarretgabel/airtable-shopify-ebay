// Use VITE_ prefixed Google Drive env vars everywhere
const GOOGLE_DRIVE_CLIENT_ID = process.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
const GOOGLE_DRIVE_CLIENT_SECRET = process.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET;
const GOOGLE_DRIVE_REFRESH_TOKEN = process.env.VITE_GOOGLE_DRIVE_REFRESH_TOKEN;
const GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID = process.env.VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID;

// scripts/seed_photography_and_testing_images.ts

/*
  REQUIREMENTS:
  - Seed testing images into all workflow rows in Google Drive and Airtable that are in 'photography' or later.
  - Seed photography images into all workflow rows in Google Drive and Airtable that are in 'photography' or later.
*/

// One-time script to seed photography and testing images into all workflow rows in Airtable and Google Drive that are in 'photography' or later.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Debug print to verify env loading
console.log('Loaded VITE_APP_API_BASE_URL:', process.env.VITE_APP_API_BASE_URL);

// Ensure API base URL is set for Node.js scripts
if (!process.env.VITE_APP_API_BASE_URL) {
  throw new Error('VITE_APP_API_BASE_URL is not set. Please set it in your .env or .env.local file (e.g., VITE_APP_API_BASE_URL=http://localhost:3000)');
}


// IMPORTANT: Use this import for ts-node. Do NOT add .js extension unless running compiled JS.


import axios from 'axios';
import fs from 'fs';
import path from 'path';
import qs from 'qs';

import { archiveWorkflowImagesToGoogleDrive } from '../aws/src/providers/googleDrive/client';
import {
  parseWorkflowImageMetadata,
  mergeWorkflowImageMetadata,
  serializeWorkflowImageMetadata,
  type WorkflowImageMetadataRecord
} from '../src/services/workflowImageMetadata';
// Airtable REST API config (match sync_drive_images_to_airtable.ts)
const AIRTABLE_API_KEY = process.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || 'apprsAm2FOohEmL2u';
const AIRTABLE_TABLE_ID = process.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME || 'tbl0K0nFQL64jQMx8';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
const WORKFLOW_IMAGE_METADATA_FIELD = 'Workflow Image Metadata JSON';


// Example image URLs or local paths to seed
const PHOTOGRAPHY_IMAGE = 'https://example.com/seed_photography.jpg';
const TESTING_IMAGE = 'https://example.com/seed_testing.jpg';

// Simulate image processing (replace with real processing logic as needed)
async function processImage(originalUrl: string, options = { resize: true, watermark: true }) {
  // In a real app, this would call your image processing pipeline
  // For now, append a query param to simulate a processed version
  return originalUrl + '?processed=1';
}

// Canonical workflow statuses for used gear
const STATUS_FIELD = 'Workflow Status';
const VALID_STATUSES = [
  'Pending Review',
  'Unqualified',
  'Accepted - Awaiting Arrival',
  'Accepted - Arrived, Awaiting SKU',
  'Accepted - Arrived, Awaiting Missing Item',
  'Testing In Progress',
  'Photography In Progress',
  'Awaiting Pre-Listing Review',
  'Approved for Publish',
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
  'Sold - Ready to Ship',
  'Shipped',
];

async function main() {

  // 1. Query Airtable for all records in 'photography' or later
  // Use REST API: fetch all records, filter in JS
  const allRecords = [];
  let offset = undefined;
  let pageCount = 0;
  console.log('Fetching records from Airtable...');
  do {
    const params = {
      pageSize: 100,
      ...(offset ? { offset } : {}),
    };
    const res = await axios.get(AIRTABLE_API_URL, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params,
    });
    allRecords.push(...res.data.records);
    pageCount++;
    console.log(`Fetched page ${pageCount}, records so far: ${allRecords.length}`);
    offset = res.data.offset;
  } while (offset);

  console.log(`Total records fetched: ${allRecords.length}`);

  // Print all unique workflow statuses for validation
  const statusSet = new Set<string>();
  for (const record of allRecords) {
    const status = (record.fields[STATUS_FIELD] || '').toString();
    if (status) statusSet.add(status);
  }
  console.log('Unique Workflow Status values found:');
  for (const status of statusSet) {
    console.log('  -', status);
  }

  // Filter records by valid statuses for seeding
  const filteredRecords = allRecords.filter(record => {
    const status = (record.fields[STATUS_FIELD] || '').toString();
    return VALID_STATUSES.includes(status);
  });
  console.log(`Records matching valid workflow statuses (${VALID_STATUSES.join(', ')}): ${filteredRecords.length}`);

  let processed = 0;
  // Define workflow status order
  const statusOrder = [
    'Pending Review',
    'Unqualified',
    'Accepted - Awaiting Arrival',
    'Accepted - Arrived, Awaiting SKU',
    'Accepted - Arrived, Awaiting Missing Item',
    'Testing In Progress',
    'Photography In Progress',
    'Awaiting Pre-Listing Review',
    'Approved for Publish',
    'Listed, Shopify',
    'Listed, eBay',
    'Stale Listing, Shopify',
    'Stale Listing, eBay',
    'Sold - Ready to Ship',
    'Shipped',
  ];
  function statusIndex(status) {
    return statusOrder.indexOf(status);
  }
  for (const record of filteredRecords) {
    const recordId = record.id;
    const recordName = record.fields['Name'] || record.fields['SKU'] || recordId;
    const status = (record.fields[STATUS_FIELD] || '').toString();
    try {
      const nowIso = new Date().toISOString();
      console.log(`[${processed + 1}/${filteredRecords.length}] Processing record: ${recordName} (${recordId}) [${status}]`);

      // Only seed testing images if status is 'Testing In Progress' or later
      let testingArchive = null;
      let testingMetadata = [];
      if (statusIndex(status) >= statusIndex('Testing In Progress')) {
        testingArchive = await archiveWorkflowImagesToGoogleDrive({
          folderKey: record.id,
          stage: 'testing',
          original: {
            filename: 'testing_original.jpg',
            contentType: 'image/jpeg',
            file: TESTING_IMAGE,
          },
          processed: {
            filename: 'testing_processed.jpg',
            contentType: 'image/jpeg',
            file: await processImage(TESTING_IMAGE),
          },
        });
        console.log(`  Uploaded testing images to Drive:`, testingArchive);
        testingMetadata = [
          {
            url: testingArchive.original.url,
            attachmentId: testingArchive.original.id,
            filename: 'testing_original.jpg',
            alt: 'Seeded Testing Image (Original)',
            sortOrder: 0,
            sourceStage: 'testing',
            includedInListing: true,
            createdAt: nowIso,
            updatedAt: nowIso
          },
          {
            url: testingArchive.processed.url,
            attachmentId: testingArchive.processed.id,
            filename: 'testing_processed.jpg',
            alt: 'Seeded Testing Image (Processed)',
            sortOrder: 0,
            sourceStage: 'testing',
            includedInListing: true,
            createdAt: nowIso,
            updatedAt: nowIso
          }
        ];
      }

      // Only seed photography images if status is 'Photography In Progress' or later
      let photographyArchive = null;
      let photographyMetadata = [];
      if (statusIndex(status) >= statusIndex('Photography In Progress')) {
        photographyArchive = await archiveWorkflowImagesToGoogleDrive({
          folderKey: record.id,
          stage: 'photos',
          original: {
            filename: 'photography_original.jpg',
            contentType: 'image/jpeg',
            file: PHOTOGRAPHY_IMAGE,
          },
          processed: {
            filename: 'photography_processed.jpg',
            contentType: 'image/jpeg',
            file: await processImage(PHOTOGRAPHY_IMAGE),
          },
        });
        console.log(`  Uploaded photography images to Drive:`, photographyArchive);
        photographyMetadata = [
          {
            url: photographyArchive.original.url,
            attachmentId: photographyArchive.original.id,
            filename: 'photography_original.jpg',
            alt: 'Seeded Photography Image (Original)',
            sortOrder: 0,
            sourceStage: 'photos',
            includedInListing: true,
            createdAt: nowIso,
            updatedAt: nowIso
          },
          {
            url: photographyArchive.processed.url,
            attachmentId: photographyArchive.processed.id,
            filename: 'photography_processed.jpg',
            alt: 'Seeded Photography Image (Processed)',
            sortOrder: 0,
            sourceStage: 'photos',
            includedInListing: true,
            createdAt: nowIso,
            updatedAt: nowIso
          }
        ];
      }

      // Build new metadata records for originals and processed
      const newMetadata: WorkflowImageMetadataRecord[] = [
        ...photographyMetadata,
        ...testingMetadata,
      ];

      // Parse existing metadata
      const existingMetadata = parseWorkflowImageMetadata(record.fields[WORKFLOW_IMAGE_METADATA_FIELD]);

      // Deduplicate: filter out any new images already present (by url or attachmentId)
      const existingUrls = new Set(existingMetadata.map(img => img.url));
      const existingIds = new Set(existingMetadata.map(img => img.attachmentId).filter(Boolean));
      const trulyNewMetadata = newMetadata.filter(img =>
        !existingUrls.has(img.url) && (!img.attachmentId || !existingIds.has(img.attachmentId))
      );

      // Merge and sort
      const mergedMetadata = mergeWorkflowImageMetadata({
        attachments: [],
        existingMetadata: existingMetadata.concat(trulyNewMetadata),
        sourceStage: 'photos',
        nowIso
      });

      // Serialize and update the Workflow Image Metadata JSON field via Airtable REST API
      if (trulyNewMetadata.length > 0) {
        await axios.patch(`${AIRTABLE_API_URL}/${recordId}`, {
          fields: { [WORKFLOW_IMAGE_METADATA_FIELD]: serializeWorkflowImageMetadata(mergedMetadata) },
        }, {
          headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        });
        console.log(`  Updated Airtable record ${recordName}`);
      } else {
        console.log(`  No new images to update for ${recordName}`);
      }
      processed++;
    } catch (err) {
      console.error(`Error seeding images for record ${recordName}:`, err);
      // Continue to next record
    }
  }
  console.log(`Seeding complete. Processed ${processed} records.`);

  console.log('Seeding complete.');
}

main().catch(err => {
  console.error('Error seeding images:', err);
  process.exit(1);
});
