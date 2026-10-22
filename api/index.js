// Vercel serverless handler — wraps Express app with global error safety
// Dynamic import to catch any module-level crash and always return JSON
let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = import('../server/index.js')
      .then(mod => mod.default || mod)
      .catch(err => {
        console.error('[LOTO API] FATAL: Failed to import server/index.js:', err);
        return null;
      });
  }
  return appPromise;
}

export default async function handler(req, res) {
  // Always return JSON content type
  res.setHeader('Content-Type', 'application/json');

  try {
    const app = await getApp();
    if (!app) {
      return res.status(500).json({ 
        error: 'Server module failed to load. Check Vercel build logs.',
        hint: 'Module import error'
      });
    }

    return new Promise((resolve) => {
      app(req, res, (err) => {
        if (err) {
          console.error('[LOTO API] Middleware error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Internal Server Error' });
          }
        }
        resolve();
      });
    });
  } catch (err) {
    console.error('[LOTO API] Fatal handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Server startup error' });
    }
  }
}
