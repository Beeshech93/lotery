import "dotenv/config";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ 
  forcePathStyle: true,
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "loto509_access_key",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "loto509_secret_key"
  }
});

const bucket = "assets";
const key = "uploads/file.txt";

await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "Hello World!" }));

const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
console.log(`[view] ${url}`);
