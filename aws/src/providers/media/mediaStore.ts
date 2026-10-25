import type { S3Client } from '@aws-sdk/client-s3';

export interface MediaStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Short-lived URL for the browser to PUT one object straight to storage; the content type is part of the signature. */
  signedPutUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  /** First bytes of an object, for image-type checks; null when the object does not exist. */
  header(key: string, bytes?: number): Promise<Buffer | null>;
  /** Short-lived direct download URL for a stored object. */
  signedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  /** Stable URL stored on the record; resolves through the media redirect route. */
  publicUrl(key: string): string;
}

const SIGNED_URL_SECONDS = 300;

/** Keys are `table/record/field/attachment-filename`; anything else (or path tricks) is not served. */
export function isValidMediaKey(key: string): boolean {
  return /^[A-Za-z0-9._\-/]+$/.test(key) && !key.split('/').some((part) => part === '' || part === '..' || part === '.');
}

const WORKFLOW_MEDIA_PREFIX = 'used-gear-workflow/';

/** Storage key for a hosted workflow image URL (absolute or relative `/api/media/...`), or '' for anything else. */
export function extractWorkflowMediaKey(url: string): string {
  try {
    const path = new URL(url.trim(), 'https://media.invalid').pathname;
    const marker = '/api/media/';
    if (!path.startsWith(marker)) return '';
    const key = path.slice(marker.length).split('/').map(decodeURIComponent).join('/');
    return key.startsWith(WORKFLOW_MEDIA_PREFIX) && isValidMediaKey(key) ? key : '';
  } catch {
    return '';
  }
}

export function createS3MediaStore(options: { bucket: string; publicBaseUrl: string; client?: S3Client }): MediaStore {
  let client = options.client;
  const getClient = async (): Promise<S3Client> => {
    if (!client) {
      const { S3Client: Ctor } = await import('@aws-sdk/client-s3');
      client = new Ctor({});
    }
    return client;
  };

  return {
    async put(key, body, contentType) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await (await getClient()).send(new PutObjectCommand({ Bucket: options.bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async header(key, bytes = 64) {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      try {
        const result = await (await getClient()).send(new GetObjectCommand({ Bucket: options.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
        return result.Body ? Buffer.from(await result.Body.transformToByteArray()) : null;
      } catch (error) {
        const name = (error as { name?: string }).name;
        if (name === 'NoSuchKey' || name === 'NotFound') return null;
        throw error;
      }
    },
    async signedPutUrl(key, contentType, expiresInSeconds = 300) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      return getSignedUrl(await getClient(), new PutObjectCommand({ Bucket: options.bucket, Key: key, ContentType: contentType }), { expiresIn: expiresInSeconds });
    },
    async signedUrl(key, expiresInSeconds = SIGNED_URL_SECONDS) {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      return getSignedUrl(await getClient(), new GetObjectCommand({ Bucket: options.bucket, Key: key }), { expiresIn: expiresInSeconds });
    },
    publicUrl(key) {
      return `${options.publicBaseUrl.replace(/\/+$/, '')}/api/media/${key.split('/').map(encodeURIComponent).join('/')}`;
    },
  };
}

/** Null when no bucket is configured, so uploads keep using the Airtable-first path. */
export function getMediaStoreFromEnv(): MediaStore | null {
  const bucket = process.env.MEDIA_BUCKET?.trim();
  if (!bucket) return null;
  return createS3MediaStore({ bucket, publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL?.trim() ?? '' });
}
