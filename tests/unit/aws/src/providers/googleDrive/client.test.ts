import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveWorkflowImagesToGoogleDrive } from '../../../../../../aws/src/providers/googleDrive/client.js';

test('archiveWorkflowImagesToGoogleDrive exchanges a refresh token for an access token before uploading', async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const originalRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const originalRootFolderId = process.env.GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID;
  const calls: Array<{ url: string; method: string; authHeader?: string; bodyText?: string }> = [];

  process.env.GOOGLE_DRIVE_CLIENT_ID = 'drive-client-id';
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'drive-client-secret';
  process.env.GOOGLE_DRIVE_REFRESH_TOKEN = 'drive-refresh-token';
  process.env.GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID = 'configured-root';

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const bodyText = typeof init?.body === 'string'
      ? init.body
      : init?.body instanceof URLSearchParams
        ? init.body.toString()
        : undefined;
    const authHeader = init?.headers instanceof Headers
      ? init.headers.get('Authorization') ?? undefined
      : Array.isArray(init?.headers)
        ? init?.headers.find(([name]) => name.toLowerCase() === 'authorization')?.[1]
        : typeof init?.headers === 'object' && init?.headers !== null
          ? (init.headers as Record<string, string>).Authorization
          : undefined;
    calls.push({ url, method, authHeader, bodyText });

    if (url === 'https://oauth2.googleapis.com/token' && method === 'POST') {
      assert.match(bodyText ?? '', /grant_type=refresh_token/);
      assert.match(bodyText ?? '', /client_id=drive-client-id/);
      assert.match(bodyText ?? '', /client_secret=drive-client-secret/);
      assert.match(bodyText ?? '', /refresh_token=drive-refresh-token/);
      return Response.json({ access_token: 'minted-drive-token', expires_in: 3600 });
    }

    if (url.includes('/drive/v3/files?') && method === 'GET') {
      return Response.json({ files: [] });
    }

    if (url === 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType&supportsAllDrives=true' && method === 'POST') {
      const body = JSON.parse(bodyText ?? '{}') as { name?: string };
      if (body.name === 'recWorkflow701') {
        return Response.json({ id: 'record-folder-701', name: 'recWorkflow701', mimeType: 'application/vnd.google-apps.folder' });
      }
    }

    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart') && method === 'POST') {
      return Response.json({ id: `file-${calls.length}`, name: 'archived-file' });
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  };

  try {
    await archiveWorkflowImagesToGoogleDrive({
      folderKey: 'recWorkflow701',
      stage: 'photos',
      original: {
        filename: 'rear.jpg',
        contentType: 'image/jpeg',
        file: Buffer.from('original').toString('base64'),
      },
      processed: {
        filename: 'rear_edited.jpg',
        contentType: 'image/jpeg',
        file: Buffer.from('processed').toString('base64'),
      },
    });

    assert.equal(calls[0]?.url, 'https://oauth2.googleapis.com/token');
    assert.equal(calls.some((call) => call.authHeader === 'Bearer minted-drive-token'), true);
    assert.equal(calls.some((call) => call.method === 'GET' && call.url.includes('configured-root')), true);
    assert.equal(calls.filter((call) => call.url.startsWith('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart') && call.method === 'POST').length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.GOOGLE_DRIVE_CLIENT_ID = originalClientId;
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = originalClientSecret;
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = originalRefreshToken;
    process.env.GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID = originalRootFolderId;
  }
});
