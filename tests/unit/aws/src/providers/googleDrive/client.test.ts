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
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

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

    if (url.includes('/permissions?supportsAllDrives=true') && method === 'POST') {
      return Response.json({ id: 'permission-1' });
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
        file: jpegBytes.toString('base64'),
      },
      processed: {
        filename: 'rear_edited.jpg',
        contentType: 'image/jpeg',
        file: jpegBytes.toString('base64'),
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

test('archiveWorkflowImagesToGoogleDrive rejects unsupported bytes before making Drive requests', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('Drive should not be called for unsupported image data');
  };

  try {
    await assert.rejects(
      archiveWorkflowImagesToGoogleDrive({
        folderKey: 'recWorkflow702',
        stage: 'testing',
        original: {
          filename: 'original.jpg',
          contentType: 'image/jpeg',
          file: Buffer.from('<html>not an image</html>').toString('base64'),
        },
        processed: {
          filename: 'processed.jpg',
          contentType: 'image/jpeg',
          file: Buffer.from('<html>not an image</html>').toString('base64'),
        },
      }),
      /not a supported image file/i,
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('downloadGoogleDriveFileHeader requests and reads only a small image signature prefix', async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const originalRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9, ...new Array(1024).fill(0)]);
  let requestRange = '';

  process.env.GOOGLE_DRIVE_CLIENT_ID = 'drive-client-id';
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'drive-client-secret';
  process.env.GOOGLE_DRIVE_REFRESH_TOKEN = 'drive-refresh-token';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'header-drive-token', expires_in: 3600 });
    }
    if (url.includes('/drive/v3/files/header-image?alt=media')) {
      const headers = new Headers(init?.headers);
      requestRange = headers.get('Range') ?? '';
      return new Response(jpegBytes, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const client = await import('../../../../../../aws/src/providers/googleDrive/client.js?image-header-test');
    const imageHeader = await client.downloadGoogleDriveFileHeader('header-image');
    assert.equal(requestRange, 'bytes=0-15');
    assert.equal(imageHeader.bytes.length, 16);
    assert.equal(imageHeader.bytes[0], 0xff);
    assert.equal(imageHeader.bytes[1], 0xd8);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.GOOGLE_DRIVE_CLIENT_ID = originalClientId;
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = originalClientSecret;
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = originalRefreshToken;
  }
});
