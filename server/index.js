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
app.use(express.json({ limit: '1mb' })); // Protect against large body payload attacks

// Maximum Security HTTP Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.removeHeader('X-Powered-By');
  next();
});

// Security: Brute Force & Rate Limit Protection
const authLockoutMap = new Map(); // identifier -> { attempts, lockedUntil }
const apiRateLimitMap = new Map(); // ip -> { count, windowStart }

function checkBruteForceLockout(identifier) {
  const now = Date.now();
  const record = authLockoutMap.get(identifier);
  if (record && record.lockedUntil && record.lockedUntil > now) {
    const minsLeft = Math.ceil((record.lockedUntil - now) / 60000);
    return `Aksè bloke pou rezon sekirite: Twòp tantativ PIN ki echwe. Tanpri tann ${minsLeft} minit / Bloqué temporairement: trop de tentatives.`;
  }
  return null;
}

function recordAuthFailure(identifier) {
  const now = Date.now();
  const record = authLockoutMap.get(identifier) || { attempts: 0, lockedUntil: null };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = now + (15 * 60 * 1000); // 15 minutes lockout after 5 failed tries
    record.attempts = 0;
  }
  authLockoutMap.set(identifier, record);
}

function recordAuthSuccess(identifier) {
  authLockoutMap.delete(identifier);
}

// Global IP Rate Limiter (Protects against DDoS / Ticket flood)
app.use((req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const limitWindow = 60 * 1000; // 1 minute
  const maxRequests = 150; // 150 requests/minute per IP

  const ipRecord = apiRateLimitMap.get(clientIp) || { count: 0, windowStart: now };
  if (now - ipRecord.windowStart > limitWindow) {
    ipRecord.count = 1;
    ipRecord.windowStart = now;
  } else {
    ipRecord.count += 1;
  }
  apiRateLimitMap.set(clientIp, ipRecord);

  if (ipRecord.count > maxRequests) {
    return res.status(429).json({ error: "Twòp demann sou sèvè a (Rate Limit Exceeded). Tanpri tann kèk segond." });
  }
  next();
});

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
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const identifier = String(req.body.pin || req.body.username || clientIp).trim().toLowerCase();
  
  const lockError = checkBruteForceLockout(identifier);
  if (lockError) {
    return res.status(429).json({ error: lockError });
  }

  try {
    const { username, pin, password, deviceId } = req.body;
    const user = await db.authenticateUser({ username, pin, password, deviceId });
    recordAuthSuccess(identifier);
    res.json({ success: true, user });
  } catch (err) {
    recordAuthFailure(identifier);
    res.status(401).json({ error: err.message || "Erè koneksyon / Erreur d'authentification" });
  }
});

app.get('/api/auth/agents', async (req, res) => {
  try {
    const { supervisorId, teamName, role } = req.query;
    const agents = await db.getAgents({ supervisorId, teamName, role });
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

app.post('/api/auth/agents/:id/pin', async (req, res) => {
  try {
    const { newPin, requesterRole } = req.body;
    if (requesterRole && requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Sèl Admin Santral ki gen dwa chanje kòd PIN / Seul l\'Admin peut modifier le PIN' });
    }
    const result = await db.updateUserPin(req.params.id, newPin);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/agents/:id/commission', async (req, res) => {
  try {
    const { commissionRate, moderatorCommissionRate, requesterRole } = req.body;
    if (requesterRole && requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Sèl Admin Santral ki gen dwa modifye pousantaj komisyon / Seul l\'Admin peut modifier les commissions' });
    }
    const result = await db.updateAgentCommission(req.params.id, { commissionRate, moderatorCommissionRate });
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
    const { drawId, number, gameType, amount, reason, requesterRole } = req.body;
    if (requesterRole && requesterRole !== 'admin') {
      return res.status(403).json({ error: "Aksè Refize: Sèl Administratè Santral ki ka bloke nimewo." });
    }
    const item = await db.addBlockedNumber({ drawId, number, gameType, amount, reason });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/blocked-numbers/:id', async (req, res) => {
  try {
    const requesterRole = req.body?.requesterRole || req.query.requesterRole;
    if (requesterRole && requesterRole !== 'admin') {
      return res.status(403).json({ error: "Aksè Refize: Sèl Administratè Santral ki ka debloke nimewo." });
    }
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
    const { requesterRole } = req.body;
    if (requesterRole && requesterRole !== 'admin') {
      return res.status(403).json({ error: "Aksè Refize: Sèl Administratè Santral ki gen dwa modifye konfigirasyon an." });
    }
    const updated = await db.updateConfig(req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Draws Endpoints
app.get('/api/draws', (req, res) => {
  try {
    const agentTz = req.query.agentTz || null;
    res.json(db.getDraws(agentTz));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/draws/:id/override', async (req, res) => {
  try {
    const { status, requesterRole } = req.body; // 'open', 'closed', or null
    if (requesterRole && requesterRole !== 'admin') {
      return res.status(403).json({ error: "Aksè Refize: Sèl Administratè Santral ki gen dwa chanje estati tiraj la." });
    }
    const updated = await db.toggleDrawOverride(req.params.id, status);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Tickets Endpoints
app.get('/api/tickets', async (req, res) => {
  try {
    const { drawId, status, date, supervisorId, teamName, sellerId, posId } = req.query;
    let sellerIds = null;
    if (sellerId || posId) {
      sellerIds = [sellerId, posId].filter(Boolean);
    } else if (supervisorId || teamName) {
      const agents = await db.getAgents({ supervisorId, teamName });
      sellerIds = agents.flatMap(a => [a.username, a.posId, a.name]);
    }
    res.json(await db.getTickets({ drawId, status, date, sellerId, sellerIds }));
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

app.get('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await db.getTicketByIdAsync(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Tikè pa jwenn / Ticket introuvable" });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/cancel', async (req, res) => {
  try {
    const { role } = req.body || {};
    const cancelled = await db.cancelTicket(req.params.id, role);
    res.json({ success: true, message: "Tikè anile avèk siksè / Billet annulé avec succès", ticket: cancelled });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Ticket Verification (Scan Barcode / Ticket ID / Security Code)
app.post('/api/tickets/verify', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Kòd tikè a obligatwa / Code ticket requis" });
    
    const ticket = await db.getTicketByIdAsync(query);
    if (!ticket) {
      return res.status(404).json({ error: "Tikè sa a pa jwenn nan sistèm nan / Ce billet n'existe pas" });
    }

    // Cryptographic signature check: detect fraudulent or tampered tickets
    const isAuthentic = db.verifyTicketSignature ? db.verifyTicketSignature(ticket) : true;
    if (!isAuthentic) {
      return res.status(403).json({
        error: "ALÈT SEKRITE: Fòsifikasyon detekte! Tikè sa a te modifye oswa li fòje (Siyati nimerik kase / Billet altéré).",
        tampered: true,
        ticket
      });
    }

    res.json({
      ticket,
      isAuthentic: true,
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
    const { drawId, drawDate, lot1, lot2, lot3, pick3, pick4, role } = req.body;
    if (!role || role !== 'admin') {
      return res.status(403).json({ 
        error: "Aksè Refize: Sèl Administratè Santral ki gen dwa pibliye rezilta tiraj / Accès refusé: Seul l'administrateur peut publier les résultats." 
      });
    }
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
app.get('/api/reports/daily', async (req, res) => {
  try {
    const { date, supervisorId, teamName, sellerId, posId } = req.query;
    let sellerIds = null;
    if (sellerId || posId) {
      sellerIds = [sellerId, posId].filter(Boolean);
    } else if (supervisorId || teamName) {
      const agents = await db.getAgents({ supervisorId, teamName });
      sellerIds = agents.flatMap(a => [a.username, a.posId, a.name]);
    }
    res.json(await db.getDailyReport(date, { sellerId, posId, sellerIds }));
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
