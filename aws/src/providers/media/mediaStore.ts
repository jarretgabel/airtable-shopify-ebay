import type { S3Client } from '@aws-sdk/client-s3';

export interface MediaStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
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
