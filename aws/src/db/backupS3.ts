import type { BackupStore } from './backup.js';

export async function createS3BackupStore(bucket: string): Promise<BackupStore> {
  const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({});
  return {
    async put(key, body) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ServerSideEncryption: 'AES256' }));
    },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await result.Body!.transformToByteArray());
    },
  };
}
