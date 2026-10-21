import app from '../server/index.js';

// Vercel serverless handler — wraps Express app with global error safety
export default async function handler(req, res) {
  // Ensure we always return JSON on unhandled errors
  res.setHeader('Content-Type', 'application/json');
  try {
    return new Promise((resolve, reject) => {
      app(req, res, (err) => {
        if (err) {
          console.error('[LOTO API] Unhandled error:', err);
          res.status(500).json({ error: err.message || 'Internal Server Error' });
        }
        resolve();
      });
    });
  } catch (err) {
    console.error('[LOTO API] Fatal error:', err);
    res.status(500).json({ error: err.message || 'Server startup error' });
  }
}
