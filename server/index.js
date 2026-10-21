import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db.js';
import { s3, S3_BUCKET, uploadObject, getPresignedViewUrl, checkS3Status } from './s3.js';
import { registerS3LocalRoutes } from './s3Server.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

registerS3LocalRoutes(app);

app.use(cors());
app.use(express.json());

// Wait for DB initialization (critical for Vercel serverless cold starts)
app.use(async (req, res, next) => {
  if (db.initPromise) {
    try {
      await db.initPromise;
    } catch (e) {}
  }
  next();
});

// Normalize path if Vercel strips /api in serverless routing
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && !req.url.startsWith('/s3')) {
    req.url = '/api' + req.url;
  }
  next();
});

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// Auth & Agent Management Endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, pin, password } = req.body;
    const user = await db.authenticateUser({ username, pin, password });
    res.json({ success: true, user });
  } catch (err) {
    res.status(401).json({ error: err.message || "Erè koneksyon / Erreur d'authentification" });
  }
});

app.get('/api/auth/agents', async (req, res) => {
  try {
    const agents = await db.getAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/agents', async (req, res) => {
  try {
    const newAgent = await db.createAgent(req.body);
    res.status(201).json(newAgent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/agents/:id/toggle', async (req, res) => {
  try {
    const result = await db.toggleAgentStatus(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Blocked Numbers & Risk Management Endpoints
app.get('/api/blocked-numbers', (req, res) => {
  try {
    res.json(db.getBlockedNumbers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/blocked-numbers', async (req, res) => {
  try {
    const { drawId, number, gameType, amount, reason } = req.body;
    const item = await db.addBlockedNumber({ drawId, number, gameType, amount, reason });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/blocked-numbers/:id', async (req, res) => {
  try {
    const result = await db.removeBlockedNumber(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/blocked-numbers/check', (req, res) => {
  try {
    const status = db.checkNumberBlocked(req.body);
    res.json(status);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get('/api/database/status', async (req, res) => {
  try {
    const status = await db.getDatabaseStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/storage/status', async (req, res) => {
  try {
    const status = await checkS3Status();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// S3 Upload & Pre-signed URL Endpoint (matches user's snippet)
app.post('/api/storage/upload', async (req, res) => {
  try {
    const { bucket = S3_BUCKET, key = "uploads/file.txt", body = "Hello World!", contentType = "text/plain", expiresIn = 3600 } = req.body;
    await uploadObject({ key, body, contentType });
    const url = await getPresignedViewUrl({ key, expiresIn: Number(expiresIn) });
    console.log(`[view] ${url}`);
    res.json({ success: true, bucket, key, url });
  } catch (err) {
    res.status(500).json({ error: err.name || "S3 Error", message: err.message });
  }
});

app.get('/api/storage/view', async (req, res) => {
  try {
    const { key = "uploads/file.txt", expiresIn = 3600 } = req.query;
    const url = await getPresignedViewUrl({ key, expiresIn: Number(expiresIn) });
    res.json({ bucket: S3_BUCKET, key, url });
  } catch (err) {
    res.status(500).json({ error: err.name || "S3 Error", message: err.message });
  }
});

// Config Endpoints
app.get('/api/config', (req, res) => {
  try {
    res.json(db.getConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const updated = await db.updateConfig(req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Draws Endpoints
app.get('/api/draws', (req, res) => {
  try {
    res.json(db.getDraws());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/draws/:id/override', async (req, res) => {
  try {
    const { status } = req.body; // 'open', 'closed', or null
    const updated = await db.toggleDrawOverride(req.params.id, status);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Tickets Endpoints
app.get('/api/tickets', (req, res) => {
  try {
    const { drawId, status, date } = req.query;
    res.json(db.getTickets({ drawId, status, date }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const ticket = await db.createTicket(req.body);
    res.status(201).json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tickets/:id', (req, res) => {
  try {
    const ticket = db.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Tikè pa jwenn / Ticket introuvable" });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/cancel', async (req, res) => {
  try {
    const cancelled = await db.cancelTicket(req.params.id);
    res.json({ success: true, message: "Tikè anile avèk siksè / Billet annulé avec succès", ticket: cancelled });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Ticket Verification (Scan Barcode / Ticket ID / Security Code)
app.post('/api/tickets/verify', (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Kòd tikè a obligatwa / Code ticket requis" });
    
    const ticket = db.getTicketById(query);
    if (!ticket) {
      return res.status(404).json({ error: "Tikè sa a pa jwenn nan sistèm nan / Ce billet n'existe pas" });
    }

    res.json({
      ticket,
      isWinner: ticket.status === 'won' || (ticket.status === 'paid' && ticket.winnings?.totalWon > 0),
      isPaid: ticket.status === 'paid',
      isCancelled: ticket.status === 'cancelled',
      winnings: ticket.winnings || { totalWon: 0, winningPlays: [] }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/payout', async (req, res) => {
  try {
    const { cashierName } = req.body;
    const paidTicket = await db.payoutTicket(req.params.id, cashierName);
    res.json({ success: true, message: "Pèyman anrejistre / Paiement enregistré avec succès", ticket: paidTicket });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Results Endpoints
app.get('/api/results', (req, res) => {
  try {
    res.json(db.getResults());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/results', async (req, res) => {
  try {
    const { drawId, drawDate, lot1, lot2, lot3, pick3, pick4 } = req.body;
    if (!drawId || !drawDate || !lot1 || !lot2 || !lot3) {
      return res.status(400).json({ error: "Tout chan yo obligatwa (Tiraj, Dat, 1er, 2e, 3e lo)" });
    }
    const result = await db.saveResult({ drawId, drawDate, lot1, lot2, lot3, pick3, pick4 });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Daily Report
app.get('/api/reports/daily', (req, res) => {
  try {
    const { date } = req.query;
    res.json(db.getDailyReport(date));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[LOTO SERVER] Server running on http://localhost:${PORT}`);
  });
}

export default app;
