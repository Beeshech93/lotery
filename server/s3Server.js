import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, 'data', 's3_storage');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export function registerS3LocalRoutes(app) {
  // Handle S3 PUT Object
  app.put('/s3/:bucket/*', (req, res) => {
    try {
      const bucket = req.params.bucket;
      const key = req.params[0];
      const filePath = path.join(STORAGE_DIR, bucket, key);

      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(filePath, buffer);
        console.log(`[LOCAL S3] Stored object in bucket "${bucket}", key "${key}" (${buffer.length} bytes)`);

        res.setHeader('ETag', `"${Date.now()}"`);
        res.setHeader('Content-Type', 'application/xml');
        res.status(200).send();
      });
    } catch (err) {
      console.error('[LOCAL S3] PUT error:', err);
      res.status(500).send(`<Error><Message>${err.message}</Message></Error>`);
    }
  });

  // Handle S3 GET Object
  app.get('/s3/:bucket/*', (req, res) => {
    try {
      const bucket = req.params.bucket;
      const key = req.params[0];
      const filePath = path.join(STORAGE_DIR, bucket, key);

      if (!fs.existsSync(filePath)) {
        return res.status(404).send('<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>');
      }

      const content = fs.readFileSync(filePath);
      res.setHeader('ETag', `"${fs.statSync(filePath).mtimeMs}"`);
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(content);
    } catch (err) {
      console.error('[LOCAL S3] GET error:', err);
      res.status(500).send(`<Error><Message>${err.message}</Message></Error>`);
    }
  });

  // Handle HEAD Bucket / Object
  app.head('/s3/:bucket/*', (req, res) => {
    const bucket = req.params.bucket;
    const key = req.params[0];
    const filePath = path.join(STORAGE_DIR, bucket, key);
    if (fs.existsSync(filePath)) {
      res.status(200).end();
    } else {
      res.status(404).end();
    }
  });

  app.head('/s3/:bucket', (req, res) => {
    res.status(200).end();
  });
}
