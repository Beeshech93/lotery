import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const endpoint = process.env.AWS_ENDPOINT_URL_S3 || process.env.AWS_ENDPOINT_URL || process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET || process.env.AWS_BUCKET || "assets";

const clientConfig = {
  forcePathStyle: true,
  region
};

if (endpoint) {
  clientConfig.endpoint = endpoint;
}

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  };
}

export const s3 = new S3Client(clientConfig);
export const S3_BUCKET = bucket;

/**
 * Upload an object to S3 / Object Storage
 */
export async function uploadObject({ key, body, contentType = "text/plain" }) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType
  });
  return await s3.send(command);
}

/**
 * Generate a pre-signed view URL for an object in S3
 */
export async function getPresignedViewUrl({ key, expiresIn = 3600 }) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key
  });
  return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Upload and generate presigned URL in one step
 */
export async function uploadAndSign({ key, body, contentType = "text/plain", expiresIn = 3600 }) {
  await uploadObject({ key, body, contentType });
  const url = await getPresignedViewUrl({ key, expiresIn });
  return { key, url, bucket: S3_BUCKET };
}

/**
 * Check S3 connection status
 */
export async function checkS3Status() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    return { connected: true, bucket: S3_BUCKET, region, endpoint: endpoint || 'AWS standard' };
  } catch (err) {
    return {
      connected: false,
      bucket: S3_BUCKET,
      region,
      endpoint: endpoint || 'AWS standard',
      error: err.name || err.message
    };
  }
}
