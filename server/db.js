import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
try {
  dotenv.config({ path: path.join(__dirname, '.env') });
} catch (e) {}

const TICKET_HMAC_SECRET = process.env.TICKET_SIGN_SECRET || process.env.JWT_SECRET || 'loto509-tamper-proof-cryptographic-salt-2026-sec';

export function generateTicketSignature(ticket) {
  const payload = `${ticket.id}|${ticket.barcode}|${ticket.securityCode}|${ticket.drawId}|${ticket.drawDate}|${Number(ticket.totalAmount)}|${ticket.createdAt}`;
  return crypto.createHmac('sha256', TICKET_HMAC_SECRET).update(payload).digest('hex');
}

export function verifyTicketSignature(ticket) {
  if (!ticket || !ticket.signature) {
    // Legacy ticket created prior to cryptographic signing
    return true;
  }
  const expected = generateTicketSignature(ticket);
  try {
    const bufA = Buffer.from(ticket.signature, 'hex');
    const bufB = Buffer.from(expected, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

const DATA_FILE = path.join(__dirname, 'data', 'store.json');

// Country → Timezone mapping for agent timezone fusion
const COUNTRY_TIMEZONES = {
  HT: { tz: 'America/Port-au-Prince', label: 'Haiti', flag: '🇭🇹' },
  DO: { tz: 'America/Santo_Domingo', label: 'Rep. Dominicana', flag: '🇩🇴' },
  BR: { tz: 'America/Sao_Paulo', label: 'Brasil', flag: '🇧🇷' },
  MX: { tz: 'America/Mexico_City', label: 'México', flag: '🇲🇽' },
  US: { tz: 'America/New_York', label: 'Estados Unidos', flag: '🇺🇸' }
};

export function getLocalDrawDate(timeZone = 'America/New_York', date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return fmt.format(date);
  } catch (e) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

const DEFAULT_USERS = [
  { id: 'usr_admin', username: 'admin', pin: '5090', password: 'admin509', name: 'Administrateur Central LOTO509', role: 'admin', posId: 'POS-ADMIN-00', branchName: 'Direksyon Jeneral LOTO509', country: 'HT', teamName: 'Direksyon Santral', supervisorId: null, enabled: true, commissionRate: 8.0, moderatorCommissionRate: 2.0 },
  { id: 'usr_mod_01', username: 'mod1', pin: '4040', password: 'mod509', name: 'Alain Dessalines (Lidè Ekip Nò)', role: 'moderator', posId: 'POS-MOD-01', branchName: 'Ekip Nò & Dèlma', country: 'HT', teamName: 'Ekip Nò', supervisorId: 'usr_admin', enabled: true, commissionRate: 8.0, moderatorCommissionRate: 2.0 },
  { id: 'usr_agent_01', username: 'agent1', pin: '1234', password: '1234', name: 'Jean-Baptiste Pierre (Petyonvil)', role: 'agent', posId: 'POS-SUNMI-01', branchName: 'Santral Petyonvil / Pétion-Ville', country: 'HT', teamName: 'Ekip Santral', supervisorId: 'usr_admin', enabled: true, commissionRate: 8.0, moderatorCommissionRate: 2.0 },
  { id: 'usr_agent_02', username: 'agent2', pin: '5678', password: '5678', name: 'Marie-Claire Joseph (Dèlma)', role: 'agent', posId: 'POS-SUNMI-02', branchName: 'Sikisal Dèlma 33 / Delmas', country: 'HT', teamName: 'Ekip Nò', supervisorId: 'usr_mod_01', enabled: true, commissionRate: 8.0, moderatorCommissionRate: 2.0 }
];

// Ensure local data folder exists as backup/cache
try {
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
} catch (e) {
  // Read-only filesystem in Vercel serverless
}

const DEFAULT_CONFIG = {
  companyName: "LOTO509",
  companySubtitle: "New York • Florida • Georgia",
  posId: "POS-SUNMI-01",
  branchName: "Santral Petyonvil / Pétion-Ville",
  phone: "+1 (305) 555-0199 / +509 3712-3456",
  currency: "MXN",
  currencySymbol: "MX$",
  cancellationWindowMinutes: 5,
  maxBetPerNumber: 5000,
  minBet: 5,
  multipliers: {
    bolette_lot1: 50,  // 1er lot = 50x
    bolette_lot2: 20,  // 2e lot = 20x
    bolette_lot3: 10,  // 3e lot = 10x
    mariage: 1000,     // Maryaj = 1000x
    loto3: 500,        // Loto 3 Chif = 500x
    loto4: 5000        // Loto 4 Chif = 5000x
  },
  disclaimerHt: "Tikè sa a valab pandan 90 jou sèlman. Pa gen ranbousman si tikè a pèdi oubyen chire.",
  disclaimerFr: "Ce billet est valable pendant 90 jours seulement. Aucun remboursement en cas de perte ou détérioration."
};

const DEFAULT_DRAWS = [
  {
    id: "ny_midday",
    state: "NY",
    nameFr: "New York Midi",
    nameHt: "Nouyòk Midi",
    timePeriod: "midday",
    cutoffTime: "14:15",
    drawTime: "14:30",
    timeZone: "America/New_York",
    enabled: true,
    manualOverride: null
  },
  {
    id: "ny_evening",
    state: "NY",
    nameFr: "New York Soir",
    nameHt: "Nouyòk Swè",
    timePeriod: "evening",
    cutoffTime: "22:15",
    drawTime: "22:30",
    timeZone: "America/New_York",
    enabled: true,
    manualOverride: null
  },
  {
    id: "fl_midday",
    state: "FL",
    nameFr: "Floride Midi",
    nameHt: "Florid Midi",
    timePeriod: "midday",
    cutoffTime: "13:15",
    drawTime: "13:30",
    timeZone: "America/New_York",
    enabled: true,
    manualOverride: null
  },
  {
    id: "fl_evening",
    state: "FL",
    nameFr: "Floride Soir",
    nameHt: "Florid Swè",
    timePeriod: "evening",
    cutoffTime: "21:15",
    drawTime: "21:45",
    timeZone: "America/New_York",
    enabled: true,
    manualOverride: null
  },
  {
    id: "ga_midday",
    state: "GA",
    nameFr: "Géorgie Midi",
    nameHt: "Jòdja Midi",
    timePeriod: "midday",
    cutoffTime: "12:15",
    drawTime: "12:29",
    timeZone: "America/New_York",
    enabled: true,
    manualOverride: null
  },
  {
    id: "ga_evening",
    state: "GA",
    nameFr: "Géorgie Soir",
    nameHt: "Jòdja Swè",
    timePeriod: "evening",
    cutoffTime: "18:45",
    drawTime: "19:00",
    timeZone: "America/New_York",
    enabled: true,
    manualOverride: null
  }
];

class Store {
  constructor() {
    this.pgPool = null;
    this.pgConnected = false;
    this.data = {
      config: DEFAULT_CONFIG,
      draws: DEFAULT_DRAWS,
      tickets: [],
      results: [],
      blockedNumbers: []
    };

    // Load initial local cache if available
    this.loadFromLocal();

    // Initialize PostgreSQL connection
    this.initPromise = this.initPostgres();
  }

  loadFromLocal() {
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.config) this.data.config = { ...DEFAULT_CONFIG, ...parsed.config };
        if (parsed.draws && parsed.draws.length > 0) this.data.draws = parsed.draws;
        if (parsed.tickets) this.data.tickets = parsed.tickets;
        if (parsed.results) this.data.results = parsed.results;
        if (parsed.blockedNumbers) this.data.blockedNumbers = Array.isArray(parsed.blockedNumbers) ? parsed.blockedNumbers : [];
      } catch (err) {
        console.warn('[STORE] Error loading local store.json:', err.message);
      }
    }
  }

  saveToLocal() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      // Local backup write failed or read-only filesystem
    }
  }

  async initPostgres() {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
    if (!connectionString) {
      console.warn('[POSTGRES] No DATABASE_URL found. Running with local fallback store.');
      return;
    }

    try {
      if (global._pgPool) {
        this.pgPool = global._pgPool;
      } else {
        this.pgPool = new pg.Pool({
          connectionString,
          ssl: { rejectUnauthorized: false },
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000
        });
        global._pgPool = this.pgPool;
      }

      const client = await this.pgPool.connect();
      console.log('[POSTGRES] Connected to Neon PostgreSQL successfully!');
      this.pgConnected = true;

      // Ensure tables exist before syncing
      await this.ensureSchema(client);

      // Load data from PostgreSQL to populate memory cache
      await this.syncFromPostgres(client);
      client.release();
    } catch (err) {
      console.error('[POSTGRES] Connection error:', err.message);
      this.pgConnected = false;
    }
  }

  async ensureSchema(client) {
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS loto_config (
          id VARCHAR(50) PRIMARY KEY,
          company_name VARCHAR(255) NOT NULL,
          company_subtitle VARCHAR(255),
          pos_id VARCHAR(100),
          branch_name VARCHAR(255),
          phone VARCHAR(100),
          currency VARCHAR(10) DEFAULT 'MXN',
          currency_symbol VARCHAR(10) DEFAULT 'MX$',
          cancellation_window_minutes INT DEFAULT 5,
          max_bet_per_number NUMERIC DEFAULT 5000,
          min_bet NUMERIC DEFAULT 5,
          multipliers JSONB NOT NULL,
          disclaimer_ht TEXT,
          disclaimer_fr TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS loto_draws (
          id VARCHAR(50) PRIMARY KEY,
          state VARCHAR(10) NOT NULL,
          name_fr VARCHAR(100) NOT NULL,
          name_ht VARCHAR(100) NOT NULL,
          time_period VARCHAR(20) NOT NULL,
          cutoff_time VARCHAR(10) NOT NULL,
          draw_time VARCHAR(10) NOT NULL,
          timezone VARCHAR(50) DEFAULT 'America/New_York',
          enabled BOOLEAN DEFAULT true,
          manual_override VARCHAR(20),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS loto_tickets (
          id VARCHAR(50) PRIMARY KEY,
          barcode VARCHAR(50) NOT NULL,
          security_code VARCHAR(50) NOT NULL,
          draw_id VARCHAR(50) NOT NULL,
          draw_name_fr VARCHAR(100),
          draw_name_ht VARCHAR(100),
          draw_date VARCHAR(20) NOT NULL,
          draw_time VARCHAR(20),
          total_amount NUMERIC NOT NULL,
          currency VARCHAR(10) DEFAULT 'MXN',
          currency_symbol VARCHAR(10) DEFAULT 'MX$',
          status VARCHAR(20) DEFAULT 'active',
          plays JSONB NOT NULL,
          winnings JSONB,
          branch_name VARCHAR(255),
          pos_id VARCHAR(100),
          seller_id VARCHAR(100),
          cancelled_at TIMESTAMP WITH TIME ZONE,
          paid_at TIMESTAMP WITH TIME ZONE,
          paid_by VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS loto_results (
          id VARCHAR(100) PRIMARY KEY,
          draw_id VARCHAR(50) NOT NULL,
          draw_date VARCHAR(20) NOT NULL,
          lot1 VARCHAR(10) NOT NULL,
          lot2 VARCHAR(10) NOT NULL,
          lot3 VARCHAR(10) NOT NULL,
          pick3 VARCHAR(10),
          pick4 VARCHAR(10),
          entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          verified BOOLEAN DEFAULT true
        );

        CREATE TABLE IF NOT EXISTS loto_blocked_numbers (
          id VARCHAR(100) PRIMARY KEY,
          draw_id VARCHAR(50) NOT NULL,
          number_key VARCHAR(50) NOT NULL,
          game_type VARCHAR(50) DEFAULT 'bolette',
          amount NUMERIC NOT NULL DEFAULT 0,
          reason TEXT DEFAULT '',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        ALTER TABLE loto_blocked_numbers ADD COLUMN IF NOT EXISTS id VARCHAR(100);
        ALTER TABLE loto_blocked_numbers ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bolette';
        ALTER TABLE loto_blocked_numbers ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';
        ALTER TABLE loto_blocked_numbers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_draw_num ON loto_blocked_numbers(draw_id, number_key);

        CREATE TABLE IF NOT EXISTS loto_users (
          id VARCHAR(50) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          pin VARCHAR(20) NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'agent',
          pos_id VARCHAR(100),
          branch_name VARCHAR(255),
          country VARCHAR(5) DEFAULT 'HT',
          team_name VARCHAR(100),
          supervisor_id VARCHAR(50),
          enabled BOOLEAN DEFAULT true,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        ALTER TABLE loto_users ADD COLUMN IF NOT EXISTS country VARCHAR(5) DEFAULT 'HT';
        ALTER TABLE loto_users ADD COLUMN IF NOT EXISTS team_name VARCHAR(100);
        ALTER TABLE loto_users ADD COLUMN IF NOT EXISTS supervisor_id VARCHAR(50);
        ALTER TABLE loto_tickets ADD COLUMN IF NOT EXISTS seller_name VARCHAR(255);

        CREATE INDEX IF NOT EXISTS idx_tickets_draw ON loto_tickets(draw_id, draw_date);
        CREATE INDEX IF NOT EXISTS idx_tickets_barcode ON loto_tickets(barcode);
        CREATE INDEX IF NOT EXISTS idx_tickets_security ON loto_tickets(security_code);
        CREATE INDEX IF NOT EXISTS idx_results_draw ON loto_results(draw_id, draw_date);
      `);

      // Seed config if empty
      const cfgCount = await client.query('SELECT COUNT(*) FROM loto_config');
      if (parseInt(cfgCount.rows[0].count) === 0) {
        const c = this.data.config;
        await client.query(`
          INSERT INTO loto_config (
            id, company_name, company_subtitle, pos_id, branch_name, phone,
            currency, currency_symbol, cancellation_window_minutes, max_bet_per_number,
            min_bet, multipliers, disclaimer_ht, disclaimer_fr
          ) VALUES ('main', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO NOTHING
        `, [
          c.companyName, c.companySubtitle, c.posId, c.branchName, c.phone,
          c.currency, c.currencySymbol, c.cancellationWindowMinutes, c.maxBetPerNumber,
          c.minBet, JSON.stringify(c.multipliers), c.disclaimerHt, c.disclaimerFr
        ]);
      }

      // Seed draws if empty
      const drawsCount = await client.query('SELECT COUNT(*) FROM loto_draws');
      if (parseInt(drawsCount.rows[0].count) === 0) {
        for (const d of this.data.draws) {
          await client.query(`
            INSERT INTO loto_draws (
              id, state, name_fr, name_ht, time_period, cutoff_time, draw_time, timezone, enabled, manual_override
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
          `, [d.id, d.state, d.nameFr, d.nameHt, d.timePeriod, d.cutoffTime, d.drawTime, d.timeZone || 'America/New_York', d.enabled, d.manualOverride]);
        }
      }

      // Seed or ensure default users (Admin, Moderator, Agents)
      for (const u of DEFAULT_USERS) {
        await client.query(`
          INSERT INTO loto_users (id, username, pin, password, name, role, pos_id, branch_name, country, team_name, supervisor_id, enabled)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
          ON CONFLICT (username) DO UPDATE SET
            team_name = COALESCE(loto_users.team_name, EXCLUDED.team_name),
            supervisor_id = COALESCE(loto_users.supervisor_id, EXCLUDED.supervisor_id),
            role = COALESCE(loto_users.role, EXCLUDED.role)
        `, [u.id, u.username, u.pin, u.password, u.name, u.role, u.posId, u.branchName, u.country, u.teamName, u.supervisorId]);
      }
    } catch (err) {
      console.warn('[POSTGRES] ensureSchema notice:', err.message);
    }
  }

  async syncFromPostgres(client) {
    try {
      // 1. Config
      const cfgRes = await client.query('SELECT * FROM loto_config WHERE id = $1', ['main']);
      if (cfgRes.rows.length > 0) {
        const row = cfgRes.rows[0];
        this.data.config = {
          companyName: row.company_name,
          companySubtitle: row.company_subtitle,
          posId: row.pos_id,
          branchName: row.branch_name,
          phone: row.phone,
          currency: row.currency || 'MXN',
          currencySymbol: row.currency_symbol || 'MX$',
          cancellationWindowMinutes: row.cancellation_window_minutes || 5,
          maxBetPerNumber: Number(row.max_bet_per_number) || 5000,
          minBet: Number(row.min_bet) || 5,
          multipliers: row.multipliers || DEFAULT_CONFIG.multipliers,
          disclaimerHt: row.disclaimer_ht,
          disclaimerFr: row.disclaimer_fr
        };
      }

      // 2. Draws
      const drawsRes = await client.query('SELECT * FROM loto_draws ORDER BY id');
      if (drawsRes.rows.length > 0) {
        this.data.draws = drawsRes.rows.map(d => ({
          id: d.id,
          state: d.state,
          nameFr: d.name_fr,
          nameHt: d.name_ht,
          timePeriod: d.time_period,
          cutoffTime: d.cutoff_time,
          drawTime: d.draw_time,
          timeZone: d.timezone || 'America/New_York',
          enabled: d.enabled !== false,
          manualOverride: d.manual_override
        }));
      }

      // 3. Tickets
      const ticketsRes = await client.query('SELECT * FROM loto_tickets ORDER BY created_at DESC LIMIT 500');
      if (ticketsRes.rows.length > 0) {
        this.data.tickets = ticketsRes.rows.map(t => ({
          id: t.id,
          barcode: t.barcode,
          securityCode: t.security_code,
          drawId: t.draw_id,
          drawNameFr: t.draw_name_fr,
          drawNameHt: t.draw_name_ht,
          drawDate: t.draw_date,
          drawTime: t.draw_time,
          totalAmount: Number(t.total_amount),
          currency: t.currency,
          currencySymbol: t.currency_symbol,
          status: t.status,
          plays: t.plays,
          winnings: t.winnings,
          branchName: t.branch_name,
          posId: t.pos_id,
          sellerId: t.seller_id,
          sellerName: t.seller_name || t.seller_id || "Agent POS",
          cancelledAt: t.cancelled_at,
          paidAt: t.paid_at,
          paidBy: t.paid_by,
          createdAt: t.created_at
        }));
      }

      // 4. Results
      const resRes = await client.query('SELECT * FROM loto_results ORDER BY entered_at DESC LIMIT 100');
      if (resRes.rows.length > 0) {
        this.data.results = resRes.rows.map(r => ({
          id: r.id,
          drawId: r.draw_id,
          drawDate: r.draw_date,
          lot1: r.lot1,
          lot2: r.lot2,
          lot3: r.lot3,
          pick3: r.pick3,
          pick4: r.pick4,
          enteredAt: r.entered_at,
          verified: r.verified
        }));
      }

      // 5. Blocked Numbers
      const blkRes = await client.query('SELECT * FROM loto_blocked_numbers ORDER BY created_at DESC');
      if (blkRes.rows.length > 0) {
        this.data.blockedNumbers = blkRes.rows.map(b => ({
          id: b.id || `blk_${b.draw_id}_${b.number_key}`,
          drawId: b.draw_id,
          number: b.number_key,
          gameType: b.game_type || 'bolette',
          amount: Number(b.amount || 0),
          reason: b.reason || '',
          createdAt: b.created_at || new Date().toISOString()
        }));
      }

      this.saveToLocal();
      console.log(`[POSTGRES] Synced: ${this.data.draws.length} draws, ${this.data.tickets.length} tickets, ${this.data.results.length} results, ${this.data.blockedNumbers.length} blocked numbers.`);
    } catch (err) {
      console.error('[POSTGRES] Sync error:', err.message);
    }
  }

  async getDatabaseStatus() {
    let neonOnline = false;
    let dbInfo = {};

    if (this.pgPool) {
      try {
        const client = await this.pgPool.connect();
        const res = await client.query('SELECT NOW() as server_time, current_database() as db_name, version()');
        client.release();
        neonOnline = true;
        dbInfo = res.rows[0];
      } catch (e) {
        neonOnline = false;
      }
    }

    return {
      connected: neonOnline,
      provider: "Neon PostgreSQL",
      database: dbInfo.db_name || "neondb",
      host: process.env.PGHOST || "ep-shiny-band-b7457fiw-pooler.c-13.us-east-1.aws.neon.tech",
      serverTime: dbInfo.server_time || new Date().toISOString(),
      ticketsCount: this.data.tickets.length,
      drawsCount: this.data.draws.length,
      resultsCount: this.data.results.length
    };
  }

  getConfig() {
    return this.data.config;
  }

  async updateConfig(newConfig) {
    this.data.config = {
      ...this.data.config,
      ...newConfig
    };

    if (this.pgPool) {
      try {
        const c = this.data.config;
        await this.pgPool.query(`
          UPDATE loto_config SET
            company_name = $1,
            company_subtitle = $2,
            pos_id = $3,
            branch_name = $4,
            phone = $5,
            currency = $6,
            currency_symbol = $7,
            cancellation_window_minutes = $8,
            max_bet_per_number = $9,
            min_bet = $10,
            multipliers = $11,
            disclaimer_ht = $12,
            disclaimer_fr = $13,
            updated_at = NOW()
          WHERE id = 'main'
        `, [
          c.companyName, c.companySubtitle, c.posId, c.branchName, c.phone,
          c.currency, c.currencySymbol, c.cancellationWindowMinutes, c.maxBetPerNumber,
          c.minBet, JSON.stringify(c.multipliers), c.disclaimerHt, c.disclaimerFr
        ]);
      } catch (err) {
        console.error('[POSTGRES] Failed to persist config update:', err.message);
      }
    }

    this.saveToLocal();
    return this.data.config;
  }

  getDraws(agentTz = null) {
    return this.data.draws.map(draw => {
      const statusInfo = this.getDrawStatus(draw);
      let localCutoff = draw.cutoffTime;
      let localDrawTime = draw.drawTime;
      let agentTzLabel = null;
      const targetTz = agentTz || draw.timeZone || 'America/New_York';

      // Current live time formatted in target timezone
      let currentTimeStr = '12:00';
      try {
        const timeFmt = new Intl.DateTimeFormat('en-US', {
          timeZone: targetTz,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
        currentTimeStr = timeFmt.format(new Date());
      } catch (e) {
        currentTimeStr = new Date().toTimeString().slice(0, 5);
      }

      // Convert draw times to agent's local timezone if different
      if (agentTz && agentTz !== (draw.timeZone || 'America/New_York')) {
        localCutoff = this.convertTime(draw.cutoffTime, draw.timeZone || 'America/New_York', agentTz);
        localDrawTime = this.convertTime(draw.drawTime, draw.timeZone || 'America/New_York', agentTz);
        // Find label for the agent timezone
        const entry = Object.values(COUNTRY_TIMEZONES).find(c => c.tz === agentTz);
        agentTzLabel = entry ? entry.label : agentTz;
      }

      return {
        ...draw,
        status: statusInfo.status,
        isOpen: statusInfo.status === 'open',
        closesInMinutes: statusInfo.closesInMinutes,
        reopensInMinutes: statusInfo.reopensInMinutes || 0,
        displayTime: localDrawTime,
        localCutoffTime: localCutoff,
        localDrawTime: localDrawTime,
        originalCutoffTime: draw.cutoffTime,
        originalDrawTime: draw.drawTime,
        currentTimeStr,
        agentTzLabel
      };
    });
  }

  // Convert HH:MM from one timezone to another using today's date
  convertTime(timeStr, fromTz, toTz) {
    try {
      const [h, m] = timeStr.split(':').map(Number);
      // Create a date in the source timezone
      const now = new Date();
      const dateStr = getLocalDrawDate(fromTz, now);
      // Build an absolute moment: today at h:m in fromTz
      const srcDate = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
      // Get UTC offset for source timezone
      const srcFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: fromTz, hour12: false, hour: '2-digit', minute: '2-digit',
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
      const dstFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: toTz, hour12: false, hour: '2-digit', minute: '2-digit'
      });

      // Use a reference date to calculate offset difference
      const refUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      const refDate = new Date(refUtc);

      const srcParts = srcFormatter.formatToParts(refDate);
      const srcH = parseInt(srcParts.find(p => p.type === 'hour').value, 10);
      const srcM = parseInt(srcParts.find(p => p.type === 'minute').value, 10);
      const srcOffset = (srcH * 60 + srcM) - (h * 60 + m);

      const dstParts = dstFormatter.formatToParts(refDate);
      const dstH = parseInt(dstParts.find(p => p.type === 'hour').value, 10);
      const dstM = parseInt(dstParts.find(p => p.type === 'minute').value, 10);
      const dstOffset = (dstH * 60 + dstM) - (h * 60 + m);

      const diff = dstOffset - srcOffset;
      let totalMin = (h * 60 + m) + diff;
      if (totalMin < 0) totalMin += 24 * 60;
      if (totalMin >= 24 * 60) totalMin -= 24 * 60;

      const rH = Math.floor(totalMin / 60);
      const rM = totalMin % 60;
      return `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`;
    } catch (e) {
      console.error('[TZ] convertTime error:', e.message);
      return timeStr; // fallback to original
    }
  }

  getDrawStatus(draw) {
    if (draw.manualOverride === 'open') return { status: 'open', closesInMinutes: 999 };
    if (draw.manualOverride === 'closed') return { status: 'closed', closesInMinutes: 0 };
    if (!draw.enabled) return { status: 'closed', closesInMinutes: 0 };

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: draw.timeZone || 'America/New_York',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
    const currentMinutes = hour * 60 + minute;

    const [cutoffH, cutoffM] = draw.cutoffTime.split(':').map(Number);
    const cutoffMinutes = cutoffH * 60 + cutoffM;

    if (currentMinutes < cutoffMinutes) {
      // Before cutoff → OPEN for today's draw
      const diff = cutoffMinutes - currentMinutes;
      return { status: 'open', closesInMinutes: diff };
    } else {
      // At or after cutoff → CLOSED for today
      // Reopens at midnight for tomorrow's draw cycle
      const reopensInMinutes = (24 * 60 - currentMinutes);
      return { status: 'closed', closesInMinutes: 0, reopensInMinutes };
    }
  }

  isDrawOpen(draw) {
    const status = this.getDrawStatus(draw);
    return status.status === 'open';
  }

  async toggleDrawOverride(drawId, overrideStatus) {
    const draw = this.data.draws.find(d => d.id === drawId);
    if (!draw) throw new Error("Tiraj sa a pa egziste / Tirage non trouvé");

    draw.manualOverride = overrideStatus; // null, 'open', 'closed'

    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          UPDATE loto_draws SET manual_override = $1, updated_at = NOW() WHERE id = $2
        `, [overrideStatus, drawId]);
      } catch (err) {
        console.error('[POSTGRES] Failed to persist draw override:', err.message);
      }
    }

    this.saveToLocal();
    return draw;
  }

  calculateNumberExposure(drawId, gameType, numberStr) {
    const today = getLocalDrawDate();
    let sum = 0;
    if (!this.data.tickets) return 0;
    for (const t of this.data.tickets) {
      if (t.drawDate === today && t.drawId === drawId && t.status !== 'cancelled') {
        if (!t.plays) continue;
        for (const p of t.plays) {
          if (p.gameType === gameType) {
            if (gameType === 'bolette' && p.numbers && p.numbers[0] === numberStr) {
              sum += Number(p.amount);
            } else if (gameType === 'mariage' && p.numbers && p.numbers.length >= 2) {
              const m1 = `${p.numbers[0]}x${p.numbers[1]}`;
              const m2 = `${p.numbers[1]}x${p.numbers[0]}`;
              if (m1 === numberStr || m2 === numberStr) {
                sum += Number(p.amount);
              }
            } else if ((gameType === 'loto3' || gameType === 'loto4') && p.numbers && p.numbers[0] === numberStr) {
              sum += Number(p.amount);
            }
          }
        }
      }
    }
    return sum;
  }

  validatePlay(gameType, numbers, amount, drawId) {
    const amt = Number(amount);
    if (isNaN(amt) || amt < this.data.config.minBet) {
      throw new Error(`Montan minimòm pou jwe se ${this.data.config.minBet} ${this.data.config.currencySymbol}`);
    }
    if (amt > this.data.config.maxBetPerNumber) {
      throw new Error(`Montan maksimòm se ${this.data.config.maxBetPerNumber} ${this.data.config.currencySymbol}`);
    }

    if (gameType === 'bolette') {
      if (!numbers || numbers.length !== 1 || !/^\d{2}$/.test(numbers[0])) {
        throw new Error("Bòlèt dwe gen 2 chif egzakteman (00-99)");
      }
    } else if (gameType === 'mariage') {
      if (!numbers || numbers.length !== 2 || !/^\d{2}$/.test(numbers[0]) || !/^\d{2}$/.test(numbers[1])) {
        throw new Error("Maryaj dwe gen 2 nimewo a 2 chif (egz: 28 x 45)");
      }
    } else if (gameType === 'loto3') {
      if (!numbers || numbers.length !== 1 || !/^\d{3}$/.test(numbers[0])) {
        throw new Error("Loto 3 dwe gen 3 chif egzakteman (000-999)");
      }
    } else if (gameType === 'loto4') {
      if (!numbers || numbers.length !== 1 || !/^\d{4}$/.test(numbers[0])) {
        throw new Error("Loto 4 dwe gen 4 chif egzakteman (0000-9999)");
      }
    } else {
      throw new Error(`Kalite jwèt envalid: ${gameType}`);
    }

    // Enforce Blocked Numbers & Risk Limits
    if (drawId && this.data.blockedNumbers && this.data.blockedNumbers.length > 0) {
      const cleanNum = gameType === 'mariage' 
        ? `${numbers[0]}x${numbers[1]}` 
        : String(numbers[0]);

      for (const b of this.data.blockedNumbers) {
        const drawMatches = b.drawId === 'all' || b.drawId === drawId;
        const gameMatches = b.gameType === 'all' || b.gameType === gameType;
        if (!drawMatches || !gameMatches) continue;

        let isMatch = false;
        if (gameType === 'mariage') {
          const m1 = `${numbers[0]}x${numbers[1]}`;
          const m2 = `${numbers[1]}x${numbers[0]}`;
          isMatch = b.number === m1 || b.number === m2 || b.number === numbers[0] || b.number === numbers[1];
        } else {
          isMatch = b.number === cleanNum;
        }

        if (isMatch) {
          if (b.amount === 0) {
            throw new Error(`Nimewo ${cleanNum} bloke pou tiraj sa a! / Le numéro ${cleanNum} est bloqué pour ce tirage!`);
          } else if (b.amount > 0) {
            const currentExp = this.calculateNumberExposure(drawId, gameType, cleanNum);
            if (currentExp + amt > b.amount) {
              throw new Error(`Limit depase pou nimewo ${cleanNum}! Plafon maksimòm se ${b.amount} ${this.data.config.currencySymbol}. Vant jounen an deja: ${currentExp} ${this.data.config.currencySymbol}`);
            }
          }
        }
      }
    }
  }

  async createTicket(ticketData) {
    const { drawId, plays, sellerId, sellerName, branchName, posId } = ticketData;

    const draw = this.data.draws.find(d => d.id === drawId);
    if (!draw) throw new Error("Tiraj chwazi a pa valid");

    if (!this.isDrawOpen(draw)) {
      throw new Error(`Tiraj ${draw.nameHt} fèmen pou kounye a.`);
    }

    if (!plays || !Array.isArray(plays) || plays.length === 0) {
      throw new Error("Panye a vid. Tanpri ajoute omwen yon jwèt.");
    }

    // Security: Anti-flood limit on plays per ticket
    if (plays.length > 50) {
      throw new Error("Panye a depase limit maksimòm 50 jwèt pou yon sèl tikè.");
    }

    const now = new Date();
    const dateStr = getLocalDrawDate(draw.timeZone || 'America/New_York', now);

    // Anti-fraud: prevent betting if draw results have already been entered/published
    const existingResult = this.data.results.find(r => r.drawId === draw.id && r.drawDate === dateStr);
    if (existingResult) {
      throw new Error("Tiraj sa a deja fini epi gen rezilta pibliye pou li. Pari pa posib ankò.");
    }

    let totalAmount = 0;
    plays.forEach(p => {
      this.validatePlay(p.gameType, p.numbers, p.amount, draw.id);
      totalAmount += Number(p.amount);
    });

    if (totalAmount <= 0 || isNaN(totalAmount)) {
      throw new Error("Montan total tikè a dwe pozitif.");
    }
    if (totalAmount > 50000) {
      throw new Error(`Montan maksimòm pa tikè se 50,000 ${this.data.config.currencySymbol}.`);
    }

    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    const randomSuffix = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`;
    const ticketId = `TK-${dateStr.replace(/-/g, '')}-${randomSuffix}`;
    const barcode = `${Math.floor(10000000 + Math.random() * 90000000)}`;
    const securityCode = `SEC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`;

    const newTicket = {
      id: ticketId,
      barcode,
      securityCode,
      drawId: draw.id,
      drawNameFr: draw.nameFr,
      drawNameHt: draw.nameHt,
      drawDate: dateStr,
      drawTime: draw.drawTime,
      createdAt: now.toISOString(),
      totalAmount,
      currency: this.data.config.currency,
      currencySymbol: this.data.config.currencySymbol,
      status: 'active',
      plays,
      winnings: {
        totalWon: 0,
        winningPlays: []
      },
      branchName: branchName || this.data.config.branchName,
      posId: posId || this.data.config.posId,
      sellerId: sellerId || "Caissier-01",
      sellerName: sellerName || ticketData.sellerName || sellerId || "Agent POS",
      cancelledAt: null,
      paidAt: null,
      paidBy: null
    };

    // Banking-grade tamper-proof cryptographic signature
    newTicket.signature = generateTicketSignature(newTicket);

    this.data.tickets.unshift(newTicket);

    // Persist to Neon PostgreSQL
    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO loto_tickets (
            id, barcode, security_code, draw_id, draw_name_fr, draw_name_ht,
            draw_date, draw_time, total_amount, currency, currency_symbol,
            status, plays, winnings, branch_name, pos_id, seller_id, seller_name,
            created_at, signature
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          )
        `, [
          newTicket.id, newTicket.barcode, newTicket.securityCode, newTicket.drawId,
          newTicket.drawNameFr, newTicket.drawNameHt, newTicket.drawDate, newTicket.drawTime,
          newTicket.totalAmount, newTicket.currency, newTicket.currencySymbol,
          newTicket.status, JSON.stringify(newTicket.plays), JSON.stringify(newTicket.winnings),
          newTicket.branchName, newTicket.posId, newTicket.sellerId, newTicket.sellerName, newTicket.createdAt,
          newTicket.signature
        ]);
      } catch (err) {
        console.error('[POSTGRES] Failed to insert ticket:', err.message);
      }
    }

    this.saveToLocal();
    return newTicket;
  }

  async getTickets(filter = {}) {
    if (this.pgPool) {
      try {
        const queryParts = [];
        const params = [];
        let pIndex = 1;

        if (filter.drawId) {
          queryParts.push(`draw_id = $${pIndex++}`);
          params.push(filter.drawId);
        }
        if (filter.status) {
          if (filter.status === 'active' || filter.status === 'pending') {
            queryParts.push(`status IN ('active', 'pending')`);
          } else {
            queryParts.push(`status = $${pIndex++}`);
            params.push(filter.status);
          }
        }
        if (filter.date) {
          queryParts.push(`draw_date = $${pIndex++}`);
          params.push(filter.date);
        }
        if (filter.sellerId) {
          queryParts.push(`(seller_id = $${pIndex} OR pos_id = $${pIndex} OR seller_name = $${pIndex})`);
          params.push(filter.sellerId);
          pIndex++;
        } else if (filter.sellerIds && Array.isArray(filter.sellerIds) && filter.sellerIds.length > 0) {
          queryParts.push(`(seller_id = ANY($${pIndex}) OR pos_id = ANY($${pIndex}) OR seller_name = ANY($${pIndex}))`);
          params.push(filter.sellerIds);
          pIndex++;
        }

        const whereClause = queryParts.length > 0 ? `WHERE ${queryParts.join(' AND ')}` : '';
        const sql = `SELECT * FROM loto_tickets ${whereClause} ORDER BY created_at DESC LIMIT 500`;
        const res = await this.pgPool.query(sql, params);
        if (res.rows.length > 0) {
          return res.rows.map(t => ({
            id: t.id,
            barcode: t.barcode,
            securityCode: t.security_code,
            drawId: t.draw_id,
            drawNameFr: t.draw_name_fr,
            drawNameHt: t.draw_name_ht,
            drawDate: t.draw_date,
            drawTime: t.draw_time,
            totalAmount: Number(t.total_amount),
            currency: t.currency,
            currencySymbol: t.currency_symbol,
            status: t.status,
            plays: typeof t.plays === 'string' ? JSON.parse(t.plays) : t.plays,
            winnings: typeof t.winnings === 'string' ? JSON.parse(t.winnings) : t.winnings,
            branchName: t.branch_name,
            posId: t.pos_id,
            sellerId: t.seller_id,
            sellerName: t.seller_name || t.seller_id || "Agent POS",
            signature: t.signature || null,
            cancelledAt: t.cancelled_at,
            paidAt: t.paid_at,
            paidBy: t.paid_by,
            createdAt: t.created_at
          }));
        }
      } catch (err) {
        console.error('[POSTGRES] getTickets error:', err.message);
      }
    }

    let result = this.data.tickets;
    if (filter.drawId) result = result.filter(t => t.drawId === filter.drawId);
    if (filter.status) {
      if (filter.status === 'active' || filter.status === 'pending') {
        result = result.filter(t => t.status === 'active' || t.status === 'pending');
      } else {
        result = result.filter(t => t.status === filter.status);
      }
    }
    if (filter.date) result = result.filter(t => t.drawDate === filter.date);
    if (filter.sellerId) {
      result = result.filter(t => t.sellerId === filter.sellerId || t.posId === filter.sellerId || t.sellerName === filter.sellerId);
    }
    if (filter.sellerIds && Array.isArray(filter.sellerIds) && filter.sellerIds.length > 0) {
      result = result.filter(t => 
        filter.sellerIds.includes(t.sellerId) || 
        filter.sellerIds.includes(t.posId) || 
        filter.sellerIds.includes(t.sellerName)
      );
    }
    return result;
  }

  getTicketById(idOrBarcodeOrCode) {
    if (!idOrBarcodeOrCode) return null;
    const clean = String(idOrBarcodeOrCode).trim();
    return this.data.tickets.find(t => 
      t.id.toLowerCase() === clean.toLowerCase() ||
      t.barcode === clean ||
      t.securityCode.toLowerCase() === clean.toLowerCase()
    );
  }

  async getTicketByIdAsync(idOrBarcodeOrCode) {
    const memoryTicket = this.getTicketById(idOrBarcodeOrCode);
    if (memoryTicket) return memoryTicket;

    if (this.pgPool && this.pgConnected) {
      try {
        const clean = String(idOrBarcodeOrCode).trim();
        const res = await this.pgPool.query(
          'SELECT * FROM loto_tickets WHERE LOWER(id) = LOWER($1) OR barcode = $1 OR LOWER(security_code) = LOWER($1) LIMIT 1',
          [clean]
        );
        if (res.rows.length > 0) {
          const t = res.rows[0];
          const ticket = {
            id: t.id,
            barcode: t.barcode,
            securityCode: t.security_code,
            drawId: t.draw_id,
            drawNameFr: t.draw_name_fr,
            drawNameHt: t.draw_name_ht,
            drawDate: t.draw_date,
            drawTime: t.draw_time,
            totalAmount: Number(t.total_amount),
            currency: t.currency,
            currencySymbol: t.currency_symbol,
            status: t.status,
            plays: t.plays,
            winnings: t.winnings,
            branchName: t.branch_name,
            posId: t.pos_id,
            sellerId: t.seller_id,
            sellerName: t.seller_name || t.seller_id || "Agent POS",
            signature: t.signature || null,
            cancelledAt: t.cancelled_at,
            paidAt: t.paid_at,
            paidBy: t.paid_by,
            createdAt: t.created_at
          };
          this.data.tickets.unshift(ticket);
          return ticket;
        }
      } catch (err) {
        console.error('[POSTGRES] getTicketByIdAsync error:', err.message);
      }
    }
    return null;
  }

  async cancelTicket(ticketId, userRole = 'agent') {
    const ticket = await this.getTicketByIdAsync(ticketId);
    if (!ticket) throw new Error("Tikè sa a pa egziste / Ticket non trouvé");
    if (ticket.status === 'cancelled') throw new Error("Tikè a te deja anile / Billet déjà annulé");
    if (ticket.status === 'paid') throw new Error("Tikè sa a deja peye / Billet déjà payé");
    if (ticket.status === 'won' || ticket.status === 'lost') {
      throw new Error("Tiraj la gentan fèt. Pa ka anile tikè sa a. / Le tirage a déjà eu lieu.");
    }

    const draw = this.data.draws.find(d => d.id === ticket.drawId);

    // Rule: Admin can cancel ticket anytime before draw closes.
    // Agent can only cancel within 5 minutes of ticket creation AND before draw closes.
    if (userRole === 'admin') {
      if (draw) {
        const drawStatus = this.getDrawStatus(draw);
        if (drawStatus.status !== 'open') {
          throw new Error("Tiraj la deja fèmen. Pa ka anile tikè a apre fèti tiraj la. / La lotería ya cerró.");
        }
      }
    } else {
      const createdTime = new Date(ticket.createdAt).getTime();
      const nowTime = new Date().getTime();
      const diffMinutes = (nowTime - createdTime) / (1000 * 60);

      const maxMins = this.data.config.cancellationWindowMinutes || 5;
      if (diffMinutes > maxMins) {
        throw new Error(`Dela pou ajan anile tikè a depase (${maxMins} minit maksimòm). Kontakte yon administratè.`);
      }

      if (draw) {
        const drawStatus = this.getDrawStatus(draw);
        if (drawStatus.status !== 'open') {
          throw new Error("Tiraj la deja fèmen. Pa ka anile tikè a. / La lotería ya cerró.");
        }
      }
    }

    ticket.status = 'cancelled';
    ticket.cancelledAt = new Date().toISOString();

    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          UPDATE loto_tickets SET status = 'cancelled', cancelled_at = $1 WHERE id = $2
        `, [ticket.cancelledAt, ticket.id]);
      } catch (err) {
        console.error('[POSTGRES] Failed to cancel ticket:', err.message);
      }
    }

    this.saveToLocal();
    return ticket;
  }

  async payoutTicket(ticketId, cashierName = "Caisse") {
    const ticket = await this.getTicketByIdAsync(ticketId);
    if (!ticket) throw new Error("Tikè sa a pa egziste / Ticket non trouvé");
    if (ticket.status !== 'won') throw new Error("Tikè sa a pa yon tikè gayan / Ce billet n'est pas gagnant");
    if (ticket.paidAt) throw new Error(`Tikè a te deja peye nan dat ${new Date(ticket.paidAt).toLocaleString()} pa ${ticket.paidBy || 'Caisse'}`);

    // Verify cryptographic signature before payout
    if (ticket.signature && !verifyTicketSignature(ticket)) {
      throw new Error("ALÈT SEKRITE: Tikè sa a te modifye oswa fòje! Siyati nimerik la pa valid. Pèyman bloke!");
    }

    const paidAt = new Date().toISOString();
    const paidBy = cashierName;

    // Atomic double-spend prevention in Neon PostgreSQL
    if (this.pgPool) {
      try {
        const updateRes = await this.pgPool.query(`
          UPDATE loto_tickets 
          SET status = 'paid', paid_at = $1, paid_by = $2 
          WHERE id = $3 AND status = 'won' AND paid_at IS NULL
        `, [paidAt, paidBy, ticket.id]);

        if (updateRes.rowCount === 0) {
          throw new Error("Erè konkirens: Tikè sa a te gentan peye an menm tan sou yon lòt tèminal!");
        }
      } catch (err) {
        if (err.message.includes('konkirens')) throw err;
        console.error('[POSTGRES] Failed to payout ticket:', err.message);
      }
    }

    ticket.status = 'paid';
    ticket.paidAt = paidAt;
    ticket.paidBy = paidBy;

    this.saveToLocal();
    return ticket;
  }

  evaluateTicket(ticket, result) {
    const mult = this.data.config.multipliers;
    const { lot1, lot2, lot3, pick3, pick4 } = result;
    const winningPlays = [];
    let totalWon = 0;

    ticket.plays.forEach(play => {
      const { gameType, numbers, amount } = play;
      const amt = Number(amount);

      if (gameType === 'bolette') {
        const num = numbers[0];
        if (num === lot1) {
          const payout = amt * mult.bolette_lot1;
          totalWon += payout;
          winningPlays.push({
            gameType: 'bolette',
            numbers: [num],
            amount: amt,
            lotWon: "1er Lot (Premye Lo)",
            multiplier: mult.bolette_lot1,
            payout
          });
        } else if (num === lot2) {
          const payout = amt * mult.bolette_lot2;
          totalWon += payout;
          winningPlays.push({
            gameType: 'bolette',
            numbers: [num],
            amount: amt,
            lotWon: "2ème Lot (Dezyèm Lo)",
            multiplier: mult.bolette_lot2,
            payout
          });
        } else if (num === lot3) {
          const payout = amt * mult.bolette_lot3;
          totalWon += payout;
          winningPlays.push({
            gameType: 'bolette',
            numbers: [num],
            amount: amt,
            lotWon: "3ème Lot (Twazyèm Lo)",
            multiplier: mult.bolette_lot3,
            payout
          });
        }
      } else if (gameType === 'mariage') {
        const [n1, n2] = numbers;
        const allLots = [lot1, lot2, lot3];
        const match1 = allLots.includes(n1);
        const match2 = allLots.includes(n2);

        if (match1 && match2 && (n1 !== n2 || allLots.filter(x => x === n1).length >= 2)) {
          const payout = amt * mult.mariage;
          totalWon += payout;
          winningPlays.push({
            gameType: 'mariage',
            numbers: [n1, n2],
            amount: amt,
            lotWon: "Maryaj Gayan!",
            multiplier: mult.mariage,
            payout
          });
        }
      } else if (gameType === 'loto3') {
        const num = numbers[0];
        if (pick3 && num === pick3) {
          const payout = amt * mult.loto3;
          totalWon += payout;
          winningPlays.push({
            gameType: 'loto3',
            numbers: [num],
            amount: amt,
            lotWon: "Loto 3 Chif Gayan!",
            multiplier: mult.loto3,
            payout
          });
        }
      } else if (gameType === 'loto4') {
        const num = numbers[0];
        if (pick4 && num === pick4) {
          const payout = amt * mult.loto4;
          totalWon += payout;
          winningPlays.push({
            gameType: 'loto4',
            numbers: [num],
            amount: amt,
            lotWon: "Loto 4 Chif Gayan!",
            multiplier: mult.loto4,
            payout
          });
        }
      }
    });

    if (totalWon > 0) {
      ticket.status = ticket.paidAt ? 'paid' : 'won';
      ticket.winnings = {
        totalWon,
        winningPlays
      };
    } else {
      if (ticket.status !== 'cancelled') {
        ticket.status = 'lost';
        ticket.winnings = {
          totalWon: 0,
          winningPlays: []
        };
      }
    }
  }

  async saveResult(resultData) {
    const existingIndex = this.data.results.findIndex(r => r.drawId === resultData.drawId && r.drawDate === resultData.drawDate);
    const newResult = {
      id: `RES-${resultData.drawId}-${resultData.drawDate}`,
      drawId: resultData.drawId,
      drawDate: resultData.drawDate,
      lot1: String(resultData.lot1).padStart(2, '0'),
      lot2: String(resultData.lot2).padStart(2, '0'),
      lot3: String(resultData.lot3).padStart(2, '0'),
      pick3: resultData.pick3 ? String(resultData.pick3).padStart(3, '0') : null,
      pick4: resultData.pick4 ? String(resultData.pick4).padStart(4, '0') : null,
      enteredAt: new Date().toISOString(),
      verified: true
    };

    if (existingIndex >= 0) {
      this.data.results[existingIndex] = newResult;
    } else {
      this.data.results.unshift(newResult);
    }

    // Persist result to Neon PostgreSQL
    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO loto_results (
            id, draw_id, draw_date, lot1, lot2, lot3, pick3, pick4, entered_at, verified
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            lot1 = EXCLUDED.lot1,
            lot2 = EXCLUDED.lot2,
            lot3 = EXCLUDED.lot3,
            pick3 = EXCLUDED.pick3,
            pick4 = EXCLUDED.pick4,
            entered_at = EXCLUDED.entered_at,
            verified = EXCLUDED.verified
        `, [
          newResult.id, newResult.drawId, newResult.drawDate,
          newResult.lot1, newResult.lot2, newResult.lot3,
          newResult.pick3, newResult.pick4, newResult.enteredAt,
          newResult.verified
        ]);
      } catch (err) {
        console.error('[POSTGRES] Failed to save result to Neon:', err.message);
      }
    }

    // Re-evaluate matching tickets
    let affectedTicketsCount = 0;
    let winnersCount = 0;
    let totalPayout = 0;

    for (const ticket of this.data.tickets) {
      if (ticket.drawId === newResult.drawId && ticket.drawDate === newResult.drawDate && ticket.status !== 'cancelled') {
        affectedTicketsCount++;
        this.evaluateTicket(ticket, newResult);
        if (ticket.status === 'won' || ticket.status === 'paid') {
          winnersCount++;
          totalPayout += ticket.winnings.totalWon;
        }

        // Update in PostgreSQL
        if (this.pgPool) {
          try {
            await this.pgPool.query(`
              UPDATE loto_tickets SET status = $1, winnings = $2 WHERE id = $3
            `, [ticket.status, JSON.stringify(ticket.winnings), ticket.id]);
          } catch (e) {
            console.error('[POSTGRES] Ticket evaluation sync error:', e.message);
          }
        }
      }
    }

    this.saveToLocal();
    return {
      result: newResult,
      affectedTicketsCount,
      winnersCount,
      totalPayout
    };
  }

  getResults() {
    return this.data.results.sort((a, b) => new Date(b.enteredAt) - new Date(a.enteredAt));
  }

  async getDailyReport(dateStr, filter = {}) {
    const today = dateStr || getLocalDrawDate();
    let tickets = [];
    try {
      tickets = await this.getTickets({ 
        date: today, 
        sellerId: filter.sellerId, 
        sellerIds: filter.sellerIds 
      });
    } catch (e) {
      console.error('[DB] getDailyReport getTickets error:', e.message);
    }

    if (!tickets || tickets.length === 0) {
      tickets = this.data.tickets.filter(t => t.drawDate === today);
      const allowedSellers = [];
      if (filter.sellerId) allowedSellers.push(filter.sellerId);
      if (filter.posId) allowedSellers.push(filter.posId);
      if (Array.isArray(filter.sellerIds)) allowedSellers.push(...filter.sellerIds);

      if (allowedSellers.length > 0) {
        tickets = tickets.filter(t => 
          allowedSellers.includes(t.sellerId) || 
          allowedSellers.includes(t.posId) ||
          allowedSellers.includes(t.sellerName)
        );
      }
    }

    let totalSales = 0;
    let totalCancelled = 0;
    let totalWinningAmount = 0;
    let totalPaidOut = 0;
    let activeTicketsCount = 0;
    let cancelledCount = 0;
    let winningTicketsCount = 0;

    const salesByDraw = {};
    const salesByGameType = {
      bolette: 0,
      mariage: 0,
      loto3: 0,
      loto4: 0
    };

    tickets.forEach(t => {
      if (t.status === 'cancelled') {
        totalCancelled += t.totalAmount;
        cancelledCount++;
        return;
      }

      totalSales += t.totalAmount;
      activeTicketsCount++;

      if (!salesByDraw[t.drawId]) {
        salesByDraw[t.drawId] = {
          nameFr: t.drawNameFr,
          nameHt: t.drawNameHt,
          count: 0,
          total: 0
        };
      }
      salesByDraw[t.drawId].count++;
      salesByDraw[t.drawId].total += t.totalAmount;

      t.plays.forEach(p => {
        if (salesByGameType[p.gameType] !== undefined) {
          salesByGameType[p.gameType] += Number(p.amount);
        }
      });

      if (t.winnings && t.winnings.totalWon > 0) {
        totalWinningAmount += t.winnings.totalWon;
        winningTicketsCount++;
      }
      if (t.status === 'paid' && t.winnings) {
        totalPaidOut += t.winnings.totalWon;
      }
    });

    const netBalance = totalSales - totalWinningAmount;

    return {
      date: today,
      currency: this.data.config.currency,
      totalSales,
      totalCancelled,
      totalWinningAmount,
      totalPaidOut,
      netBalance,
      activeTicketsCount,
      cancelledCount,
      winningTicketsCount,
      salesByDraw,
      salesByGameType
    };
  }

  async authenticateUser({ username, pin, password, deviceId }) {
    if (this.pgPool && this.pgConnected) {
      try {
        let query = '';
        let params = [];

        if (pin) {
          query = 'SELECT * FROM loto_users WHERE pin = $1 AND enabled = true';
          params = [String(pin).trim()];
        } else if (username && password) {
          query = 'SELECT * FROM loto_users WHERE LOWER(username) = LOWER($1) AND (password = $2 OR pin = $2) AND enabled = true';
          params = [username.trim(), password.trim()];
        } else {
          throw new Error('Tanpri mete yon PIN oswa non itilizatè ak modpas');
        }

        const res = await this.pgPool.query(query, params);
        if (res.rows.length > 0) {
          const user = res.rows[0];

          // Check device / POS ID binding if user is an agent/moderator with assigned pos_id
          if (user.role !== 'admin' && user.pos_id) {
            const allowedDevices = String(user.pos_id)
              .split(',')
              .map(d => d.trim().toLowerCase())
              .filter(Boolean);

            const currentDevice = String(deviceId || '').trim().toLowerCase();
            if (allowedDevices.length > 0 && (!currentDevice || !allowedDevices.includes(currentDevice))) {
              throw new Error(
                `Aksè Refize: Kòd PIN sa a lye sèlman ak aparèy #${user.pos_id}. Aparèy sa a gen ID: [${deviceId || 'Okenn'}].`
              );
            }
          }

          await this.pgPool.query('UPDATE loto_users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});

          const country = user.country || 'HT';
          const tzInfo = COUNTRY_TIMEZONES[country] || COUNTRY_TIMEZONES.HT;

          return {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role, // 'admin', 'moderator', or 'agent'
            posId: user.pos_id || this.data.config.posId,
            branchName: user.branch_name || this.data.config.branchName,
            teamName: user.team_name || (user.role === 'admin' ? 'Direksyon Santral' : 'Ekip Prensipal'),
            supervisorId: user.supervisor_id,
            country: country,
            timezone: tzInfo.tz,
            countryFlag: tzInfo.flag,
            countryLabel: tzInfo.label,
            commissionRate: user.commission_rate != null ? Number(user.commission_rate) : (user.role === 'moderator' ? 2.0 : 8.0),
            moderatorCommissionRate: user.moderator_commission_rate != null ? Number(user.moderator_commission_rate) : 2.0
          };
        }
      } catch (err) {
        if (err.message.includes('Tanpri') || err.message.includes('Aksè Refize')) throw err;
        console.warn('[POSTGRES] Auth query failed, checking fallback:', err.message);
      }
    }

    // Local fallback authentication
    const cleanPin = pin ? String(pin).trim() : null;
    const cleanUser = username ? String(username).toLowerCase().trim() : null;
    const cleanPass = password ? String(password).trim() : null;

    const matched = DEFAULT_USERS.find(u => {
      if (!u.enabled) return false;
      if (cleanPin && u.pin === cleanPin) return true;
      if (cleanUser && cleanPass && u.username.toLowerCase() === cleanUser && (u.password === cleanPass || u.pin === cleanPass)) return true;
      return false;
    });

    if (matched) {
      // Check device / POS ID binding in fallback
      if (matched.role !== 'admin' && matched.posId) {
        const allowedDevices = String(matched.posId)
          .split(',')
          .map(d => d.trim().toLowerCase())
          .filter(Boolean);

        const currentDevice = String(deviceId || '').trim().toLowerCase();
        if (allowedDevices.length > 0 && (!currentDevice || !allowedDevices.includes(currentDevice))) {
          throw new Error(
            `Aksè Refize: Kòd PIN sa a lye sèlman ak aparèy #${matched.posId}. Aparèy sa a gen ID: [${deviceId || 'Okenn'}].`
          );
        }
      }

      const country = matched.country || 'HT';
      const tzInfo = COUNTRY_TIMEZONES[country] || COUNTRY_TIMEZONES.HT;
      return {
        id: matched.id,
        username: matched.username,
        name: matched.name,
        role: matched.role,
        posId: matched.posId || this.data.config.posId,
        branchName: matched.branchName || this.data.config.branchName,
        teamName: matched.teamName || (matched.role === 'admin' ? 'Direksyon Santral' : 'Ekip Prensipal'),
        supervisorId: matched.supervisorId,
        country: country,
        timezone: tzInfo.tz,
        countryFlag: tzInfo.flag,
        countryLabel: tzInfo.label,
        commissionRate: matched.commissionRate != null ? Number(matched.commissionRate) : (matched.role === 'moderator' ? 2.0 : 8.0),
        moderatorCommissionRate: matched.moderatorCommissionRate != null ? Number(matched.moderatorCommissionRate) : 2.0
      };
    }

    throw new Error('PIN oswa modpas la pa kòrèk / Identifiants incorrects');
  }

  async getAgents(filter = {}) {
    let users = [];
    if (this.pgPool) {
      try {
        const res = await this.pgPool.query(`
          SELECT u.id, u.username, u.pin, u.name, u.role, u.pos_id, u.branch_name, 
                 u.country, u.team_name, u.supervisor_id, u.commission_rate, u.moderator_commission_rate,
                 u.enabled, u.last_login, u.created_at,
                 s.name as supervisor_name
          FROM loto_users u
          LEFT JOIN loto_users s ON u.supervisor_id = s.id
          ORDER BY 
            CASE u.role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, 
            u.team_name, u.username
        `);
        users = res.rows.map(u => {
          const country = u.country || 'HT';
          const tzInfo = COUNTRY_TIMEZONES[country] || COUNTRY_TIMEZONES.HT;
          return {
            id: u.id,
            username: u.username,
            pin: u.pin,
            name: u.name,
            role: u.role,
            posId: u.pos_id,
            branchName: u.branch_name,
            country: country,
            teamName: u.team_name || (u.role === 'admin' ? 'Direksyon Santral' : 'Ekip Prensipal'),
            supervisorId: u.supervisor_id,
            supervisorName: u.supervisor_name || (u.role === 'admin' ? 'Santral' : null),
            commissionRate: u.commission_rate != null ? Number(u.commission_rate) : (u.role === 'moderator' ? 2.0 : 8.0),
            moderatorCommissionRate: u.moderator_commission_rate != null ? Number(u.moderator_commission_rate) : 2.0,
            timezone: tzInfo.tz,
            countryFlag: tzInfo.flag,
            countryLabel: tzInfo.label,
            enabled: u.enabled,
            lastLogin: u.last_login,
            createdAt: u.created_at
          };
        });
      } catch (err) {
        console.error('[POSTGRES] getAgents error:', err.message);
      }
    }

    if (users.length === 0) {
      users = DEFAULT_USERS.map(u => {
        const country = u.country || 'HT';
        const tzInfo = COUNTRY_TIMEZONES[country] || COUNTRY_TIMEZONES.HT;
        const supervisor = DEFAULT_USERS.find(s => s.id === u.supervisorId);
        return {
          id: u.id,
          username: u.username,
          pin: u.pin,
          name: u.name,
          role: u.role,
          posId: u.posId,
          branchName: u.branchName,
          country: country,
          teamName: u.teamName || (u.role === 'admin' ? 'Direksyon Santral' : 'Ekip Prensipal'),
          supervisorId: u.supervisorId,
          supervisorName: supervisor?.name || (u.role === 'admin' ? 'Santral' : null),
          commissionRate: u.commissionRate != null ? Number(u.commissionRate) : (u.role === 'moderator' ? 2.0 : 8.0),
          moderatorCommissionRate: u.moderatorCommissionRate != null ? Number(u.moderatorCommissionRate) : 2.0,
          timezone: tzInfo.tz,
          countryFlag: tzInfo.flag,
          countryLabel: tzInfo.label,
          enabled: u.enabled,
          createdAt: u.createdAt || new Date().toISOString()
        };
      });
    }

    // Apply filtering if requested (e.g. by supervisorId or teamName)
    if (filter.supervisorId || filter.teamName) {
      const targetSupervisor = users.find(s => s.id === filter.supervisorId || s.username === filter.supervisorId);
      const targetTeam = filter.teamName || targetSupervisor?.teamName;
      users = users.filter(u => 
        (filter.supervisorId && (u.supervisorId === filter.supervisorId || u.id === filter.supervisorId)) ||
        (targetTeam && u.teamName === targetTeam)
      );
    }

    const today = getLocalDrawDate();
    let todayTickets = [];
    if (this.pgPool) {
      try {
        const tRes = await this.pgPool.query(
          "SELECT id, total_amount, pos_id, seller_id, seller_name FROM loto_tickets WHERE draw_date = $1 AND status != 'cancelled'",
          [today]
        );
        todayTickets = tRes.rows.map(r => ({
          totalAmount: Number(r.total_amount),
          posId: r.pos_id,
          sellerId: r.seller_id,
          sellerName: r.seller_name
        }));
      } catch (e) {
        console.error('[POSTGRES] getAgents tickets error:', e.message);
      }
    }
    if (todayTickets.length === 0) {
      todayTickets = this.data.tickets.filter(t => t.drawDate === today && t.status !== 'cancelled');
    }

    return users.map(u => {
      const agentTickets = todayTickets.filter(t => 
        t.posId === u.posId || 
        t.sellerId === u.username || 
        t.sellerId === u.name ||
        t.sellerName === u.name ||
        t.sellerId === u.id
      );
      const totalSales = agentTickets.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
      return {
        ...u,
        todaySales: totalSales,
        ticketsCount: agentTickets.length
      };
    });
  }

  async createAgent({ username, pin, password, name, posId, branchName, role = 'agent', country = 'HT', teamName = null, supervisorId = null, commissionRate = 8.0, moderatorCommissionRate = 2.0 }) {
    const id = `usr_${Date.now()}`;
    const cleanUser = String(username).toLowerCase().trim();
    const validCountry = COUNTRY_TIMEZONES[country] ? country : 'HT';
    const cleanRole = ['admin', 'moderator', 'agent'].includes(role) ? role : 'agent';
    const effectiveTeam = teamName?.trim() || (cleanRole === 'moderator' ? `Ekip ${name.split(' ')[0]}` : 'Ekip Prensipal');
    const commRate = Number(commissionRate || 8.0);
    const modCommRate = Number(moderatorCommissionRate || 2.0);

    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO loto_users (id, username, pin, password, name, role, pos_id, branch_name, country, team_name, supervisor_id, commission_rate, moderator_commission_rate)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [id, cleanUser, String(pin), String(password || pin), name, cleanRole, posId, branchName, validCountry, effectiveTeam, supervisorId, commRate, modCommRate]);
      } catch (err) {
        console.error('[POSTGRES] createAgent error:', err.message);
        throw err;
      }
    }

    const tzInfo = COUNTRY_TIMEZONES[validCountry] || COUNTRY_TIMEZONES.HT;
    return { 
      id, 
      username: cleanUser, 
      pin, 
      name, 
      role: cleanRole, 
      posId, 
      branchName, 
      country: validCountry, 
      teamName: effectiveTeam,
      supervisorId,
      commissionRate: commRate,
      moderatorCommissionRate: modCommRate,
      timezone: tzInfo.tz, 
      countryFlag: tzInfo.flag, 
      countryLabel: tzInfo.label, 
      enabled: true 
    };
  }

  async toggleAgentStatus(userId) {
    if (this.pgPool) {
      try {
        const res = await this.pgPool.query('UPDATE loto_users SET enabled = NOT enabled WHERE id = $1 RETURNING enabled', [userId]);
        return { success: true, enabled: res.rows[0]?.enabled };
      } catch (err) {
        console.error('[POSTGRES] toggleAgent error:', err.message);
        throw err;
      }
    }
    return { success: true, enabled: true };
  }

  async updateUserPin(userId, newPin) {
    const cleanPin = String(newPin).trim();
    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 20) {
      throw new Error('Kòd PIN dwe genyen ant 4 ak 20 karaktè / Le PIN doit contenir entre 4 et 20 caractères');
    }

    if (this.pgPool) {
      try {
        const res = await this.pgPool.query(
          `UPDATE loto_users 
           SET pin = $1, password = $1 
           WHERE id = $2 OR username = $2 
           RETURNING id, username, name, pin, role`,
          [cleanPin, userId]
        );
        if (res.rows.length === 0) {
          throw new Error('Itilizatè pa jwenn nan baz done a / Utilisateur non trouvé');
        }
        return { success: true, user: res.rows[0] };
      } catch (err) {
        console.error('[POSTGRES] updateUserPin error:', err.message);
        throw err;
      }
    }

    // Fallback in-memory
    const u = DEFAULT_USERS.find(x => x.id === userId || x.username === userId);
    if (u) {
      u.pin = cleanPin;
      u.password = cleanPin;
      return { success: true, user: u };
    }

    throw new Error('Itilizatè pa jwenn / Utilisateur non trouvé');
  }

  async updateAgentCommission(userId, { commissionRate, moderatorCommissionRate }) {
    const cleanComm = commissionRate != null ? Math.max(0, Math.min(100, Number(commissionRate))) : null;
    const cleanModComm = moderatorCommissionRate != null ? Math.max(0, Math.min(100, Number(moderatorCommissionRate))) : null;

    if (this.pgPool) {
      try {
        const res = await this.pgPool.query(`
          UPDATE loto_users 
          SET 
            commission_rate = COALESCE($1, commission_rate),
            moderator_commission_rate = COALESCE($2, moderator_commission_rate)
          WHERE id = $3 OR username = $3
          RETURNING id, username, name, role, commission_rate, moderator_commission_rate
        `, [cleanComm, cleanModComm, userId]);
        if (res.rows.length === 0) {
          throw new Error('Itilizatè pa jwenn nan baz done a / Utilisateur non trouvé');
        }
        return { 
          success: true, 
          user: {
            ...res.rows[0],
            commissionRate: Number(res.rows[0].commission_rate),
            moderatorCommissionRate: Number(res.rows[0].moderator_commission_rate)
          } 
        };
      } catch (err) {
        console.error('[POSTGRES] updateAgentCommission error:', err.message);
        throw err;
      }
    }

    const u = DEFAULT_USERS.find(x => x.id === userId || x.username === userId);
    if (u) {
      if (cleanComm != null) u.commissionRate = cleanComm;
      if (cleanModComm != null) u.moderatorCommissionRate = cleanModComm;
      return { 
        success: true, 
        user: { 
          id: u.id, 
          username: u.username, 
          commissionRate: u.commissionRate, 
          moderatorCommissionRate: u.moderatorCommissionRate 
        } 
      };
    }

    throw new Error('Itilizatè pa jwenn / Utilisateur non trouvé');
  }

  getBlockedNumbers() {
    return this.data.blockedNumbers || [];
  }

  async addBlockedNumber({ drawId = 'all', number, gameType = 'bolette', amount = 0, reason = '' }) {
    if (!number) throw new Error("Nimewo a obligatwa / Numéro obligatoire");
    const cleanNum = String(number).trim();
    const cleanDraw = String(drawId).trim();
    const cleanGame = String(gameType).trim();
    const limitAmt = Number(amount) || 0;
    const id = `blk_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    const newBlock = {
      id,
      drawId: cleanDraw,
      number: cleanNum,
      gameType: cleanGame,
      amount: limitAmt,
      reason: reason.trim(),
      createdAt: new Date().toISOString()
    };

    // Remove existing duplicate in memory if present
    this.data.blockedNumbers = (this.data.blockedNumbers || []).filter(
      b => !(b.drawId === cleanDraw && b.number === cleanNum && b.gameType === cleanGame)
    );
    this.data.blockedNumbers.unshift(newBlock);

    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO loto_blocked_numbers (id, draw_id, number_key, game_type, amount, reason, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (draw_id, number_key) DO UPDATE SET
            id = EXCLUDED.id,
            game_type = EXCLUDED.game_type,
            amount = EXCLUDED.amount,
            reason = EXCLUDED.reason,
            created_at = NOW()
        `, [id, cleanDraw, cleanNum, cleanGame, limitAmt, reason.trim()]);
      } catch (err) {
        console.error('[POSTGRES] addBlockedNumber error:', err.message);
      }
    }

    this.saveToLocal();
    return newBlock;
  }

  async removeBlockedNumber(id) {
    const item = (this.data.blockedNumbers || []).find(b => b.id === id);
    this.data.blockedNumbers = (this.data.blockedNumbers || []).filter(b => b.id !== id);

    if (this.pgPool) {
      try {
        if (item) {
          await this.pgPool.query('DELETE FROM loto_blocked_numbers WHERE id = $1 OR (draw_id = $2 AND number_key = $3)', [id, item.drawId, item.number]);
        } else {
          await this.pgPool.query('DELETE FROM loto_blocked_numbers WHERE id = $1', [id]);
        }
      } catch (err) {
        console.error('[POSTGRES] removeBlockedNumber error:', err.message);
      }
    }

    this.saveToLocal();
    return { success: true, id };
  }

  checkNumberBlocked({ drawId, gameType = 'bolette', number, amount = 0 }) {
    if (!this.data.blockedNumbers || this.data.blockedNumbers.length === 0) {
      return { isBlocked: false, limit: null };
    }

    const cleanNum = String(number).trim();
    const matchingRules = this.data.blockedNumbers.filter(b => {
      const drawMatches = b.drawId === 'all' || b.drawId === drawId;
      const gameMatches = b.gameType === 'all' || b.gameType === gameType;
      if (!drawMatches || !gameMatches) return false;

      if (gameType === 'mariage' && cleanNum.includes('x')) {
        const parts = cleanNum.split('x');
        const m1 = `${parts[0]}x${parts[1]}`;
        const m2 = `${parts[1]}x${parts[0]}`;
        return b.number === m1 || b.number === m2 || b.number === parts[0] || b.number === parts[1];
      }
      return b.number === cleanNum;
    });

    for (const rule of matchingRules) {
      if (rule.amount === 0) {
        return { 
          isBlocked: true, 
          reason: rule.reason || "Nimewo sa a bloke nèt pa Bank Santral la", 
          maxLimit: 0 
        };
      }
      const currentExp = this.calculateNumberExposure(drawId, gameType, cleanNum);
      if (currentExp + Number(amount) > rule.amount) {
        return {
          isBlocked: true,
          limitExceeded: true,
          reason: `Plafon depase: Maks ${rule.amount} ${this.data.config.currencySymbol}`,
          maxLimit: rule.amount,
          currentTotal: currentExp
        };
      }
    }

    return { isBlocked: false };
  }
}

export const db = new Store();
db.generateTicketSignature = generateTicketSignature;
db.verifyTicketSignature = verifyTicketSignature;

