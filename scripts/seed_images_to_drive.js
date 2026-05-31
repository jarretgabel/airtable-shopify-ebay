// Node.js script to seed intake, testing, and photography images to Google Drive for workflow records in listing, post-publish, and shipped steps.
// Fill in fetchWorkflowRecords() and set your Google Drive root folder and service account JSON path before running.

const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 1. Google Drive Auth Setup (Service Account)
const auth = new google.auth.GoogleAuth({
  keyFile: 'path/to/your-service-account.json', // TODO: Set your service account JSON path
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// 2. Fetch records from your data source
async function fetchWorkflowRecords() {
  // TODO: Replace with your actual data-fetching logic
  // Should return [{ id, workflowStep, intakeImages: [], testingImages: [], photographyImages: [] }, ...]
  return [];
}

// 3. Download image and upload to Google Drive
async function uploadImageToDrive(imageUrl, folderId, filename) {
  const response = await axios.get(imageUrl, { responseType: 'stream' });
  const fileMetadata = { name: filename, parents: [folderId] };
  const media = { mimeType: response.headers['content-type'], body: response.data };
  const file = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id, webViewLink',
  });
  return file.data.webViewLink;
}

// 4. Create folder for each record/step if needed
async function ensureFolder(name, parentId) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  if (res.data.files.length > 0) return res.data.files[0].id;
  const folder = await drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return folder.data.id;
}

// 5. Main logic
async function main() {
  const records = await fetchWorkflowRecords();
  const rootFolderId = 'YOUR_ROOT_FOLDER_ID'; // TODO: Set this to your Drive folder

  for (const record of records) {
    if (!['listing', 'post-publish', 'shipped'].includes(record.workflowStep)) continue;
    const recordFolderId = await ensureFolder(record.id, rootFolderId);

    for (const [type, images] of Object.entries({
      intake: record.intakeImages,
      testing: record.testingImages,
      photography: record.photographyImages,
    })) {
      const typeFolderId = await ensureFolder(type, recordFolderId);
      for (const imageUrl of images) {
        const filename = path.basename(imageUrl.split('?')[0]);
        try {
          const link = await uploadImageToDrive(imageUrl, typeFolderId, filename);
          console.log(`Uploaded ${filename} for ${record.id} (${type}): ${link}`);
        } catch (err) {
          console.error(`Failed to upload ${filename} for ${record.id}:`, err.message);
        }
      }
    }
  }
}

main().catch(console.error);
