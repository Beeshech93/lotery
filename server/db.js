import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
try {
  dotenv.config({ path: path.join(__dirname, '.env') });
} catch (e) {}

const DATA_FILE = path.join(__dirname, 'data', 'store.json');

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

      // Load data from PostgreSQL to populate memory cache
      await this.syncFromPostgres(client);
      client.release();
    } catch (err) {
      console.error('[POSTGRES] Connection error:', err.message);
      this.pgConnected = false;
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

  getDraws() {
    return this.data.draws.map(draw => {
      const statusInfo = this.getDrawStatus(draw);
      return {
        ...draw,
        status: statusInfo.status,
        closesInMinutes: statusInfo.closesInMinutes,
        displayTime: draw.drawTime
      };
    });
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

    let diff = cutoffMinutes - currentMinutes;

    if (diff > 0 && diff <= 1440) {
      return { status: 'open', closesInMinutes: diff };
    } else {
      return { status: 'closed', closesInMinutes: 0 };
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
    const today = new Date().toISOString().split('T')[0];
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
    const { drawId, plays, sellerId, branchName, posId } = ticketData;

    const draw = this.data.draws.find(d => d.id === drawId);
    if (!draw) throw new Error("Tiraj chwazi a pa valid");

    if (!this.isDrawOpen(draw)) {
      throw new Error(`Tiraj ${draw.nameHt} fèmen pou kounye a.`);
    }

    if (!plays || !Array.isArray(plays) || plays.length === 0) {
      throw new Error("Panye a vid. Tanpri ajoute omwen yon jwèt.");
    }

    let totalAmount = 0;
    plays.forEach(p => {
      this.validatePlay(p.gameType, p.numbers, p.amount, draw.id);
      totalAmount += Number(p.amount);
    });

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
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
      status: 'pending',
      plays,
      winnings: {
        totalWon: 0,
        winningPlays: []
      },
      branchName: branchName || this.data.config.branchName,
      posId: posId || this.data.config.posId,
      sellerId: sellerId || "Caissier-01",
      cancelledAt: null,
      paidAt: null,
      paidBy: null
    };

    this.data.tickets.unshift(newTicket);

    // Persist to Neon PostgreSQL
    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO loto_tickets (
            id, barcode, security_code, draw_id, draw_name_fr, draw_name_ht,
            draw_date, draw_time, total_amount, currency, currency_symbol,
            status, plays, winnings, branch_name, pos_id, seller_id,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          )
        `, [
          newTicket.id, newTicket.barcode, newTicket.securityCode, newTicket.drawId,
          newTicket.drawNameFr, newTicket.drawNameHt, newTicket.drawDate, newTicket.drawTime,
          newTicket.totalAmount, newTicket.currency, newTicket.currencySymbol,
          newTicket.status, JSON.stringify(newTicket.plays), JSON.stringify(newTicket.winnings),
          newTicket.branchName, newTicket.posId, newTicket.sellerId, newTicket.createdAt
        ]);
      } catch (err) {
        console.error('[POSTGRES] Failed to insert ticket:', err.message);
      }
    }

    this.saveToLocal();
    return newTicket;
  }

  getTickets(filter = {}) {
    let result = this.data.tickets;
    if (filter.drawId) result = result.filter(t => t.drawId === filter.drawId);
    if (filter.status) result = result.filter(t => t.status === filter.status);
    if (filter.date) result = result.filter(t => t.drawDate === filter.date);
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

  async cancelTicket(ticketId) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) throw new Error("Tikè sa a pa egziste / Ticket non trouvé");
    if (ticket.status === 'cancelled') throw new Error("Tikè a te deja anile / Billet déjà annulé");
    if (ticket.status === 'paid') throw new Error("Tikè sa a deja peye / Billet déjà payé");

    const createdTime = new Date(ticket.createdAt).getTime();
    const nowTime = new Date().getTime();
    const diffMinutes = (nowTime - createdTime) / (1000 * 60);

    const maxMins = this.data.config.cancellationWindowMinutes || 5;
    if (diffMinutes > maxMins) {
      throw new Error(`Dela pou anile tikè a depase (${maxMins} minit maksimòm).`);
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
    const ticket = this.getTicketById(ticketId);
    if (!ticket) throw new Error("Tikè sa a pa egziste / Ticket non trouvé");
    if (ticket.status !== 'won') throw new Error("Tikè sa a pa yon tikè gayan / Ce billet n'est pas gagnant");
    if (ticket.paidAt) throw new Error("Tikè a te deja peye / Ce billet a déjà été payé");

    ticket.status = 'paid';
    ticket.paidAt = new Date().toISOString();
    ticket.paidBy = cashierName;

    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          UPDATE loto_tickets SET status = 'paid', paid_at = $1, paid_by = $2 WHERE id = $3
        `, [ticket.paidAt, ticket.paidBy, ticket.id]);
      } catch (err) {
        console.error('[POSTGRES] Failed to payout ticket:', err.message);
      }
    }

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
      pick3: resultData.pick3 ? String(resultData.pick3) : `${resultData.lot1}`,
      pick4: resultData.pick4 ? String(resultData.pick4) : `${resultData.lot2}${resultData.lot3}`,
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

  getDailyReport(dateStr) {
    const today = dateStr || new Date().toISOString().split('T')[0];
    const tickets = this.data.tickets.filter(t => t.drawDate === today);

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

  async authenticateUser({ username, pin, password }) {
    if (this.pgPool) {
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
        if (res.rows.length === 0) {
          throw new Error('PIN oswa modpas la pa kòrèk / Identifiants incorrects');
        }

        const user = res.rows[0];
        await this.pgPool.query('UPDATE loto_users SET last_login = NOW() WHERE id = $1', [user.id]);

        return {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role, // 'admin' or 'agent'
          posId: user.pos_id || this.data.config.posId,
          branchName: user.branch_name || this.data.config.branchName
        };
      } catch (err) {
        if (err.message.includes('Identifiants') || err.message.includes('Tanpri')) {
          throw err;
        }
        console.error('[POSTGRES] Auth error:', err.message);
      }
    }

    // No local fallback — all auth goes through PostgreSQL
    throw new Error('PIN oswa modpas la pa kòrèk / Identifiants incorrects');
  }

  async getAgents() {
    let users = [];
    if (this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT id, username, name, role, pos_id, branch_name, enabled, last_login, created_at FROM loto_users ORDER BY role, username');
        users = res.rows.map(u => ({
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          posId: u.pos_id,
          branchName: u.branch_name,
          enabled: u.enabled,
          lastLogin: u.last_login
        }));
      } catch (err) {
        console.error('[POSTGRES] getAgents error:', err.message);
      }
    }

    if (users.length === 0) {
      users = [
        { id: 'usr_admin', username: 'admin', name: 'Administrateur Central LOTO509', role: 'admin', posId: 'POS-ADMIN-00', branchName: 'Direksyon Jeneral LOTO509', enabled: true },
        { id: 'usr_agent_01', username: 'agent1', name: 'Jean-Baptiste Pierre (Petyonvil)', role: 'agent', posId: 'POS-SUNMI-01', branchName: 'Santral Petyonvil / Pétion-Ville', enabled: true },
        { id: 'usr_agent_02', username: 'agent2', name: 'Marie-Claire Joseph (Dèlma)', role: 'agent', posId: 'POS-SUNMI-02', branchName: 'Sikisal Dèlma 33 / Delmas', enabled: true }
      ];
    }

    const today = new Date().toISOString().split('T')[0];
    const todayTickets = this.data.tickets.filter(t => t.drawDate === today && t.status !== 'cancelled');

    return users.map(u => {
      const agentTickets = todayTickets.filter(t => t.posId === u.posId || t.sellerId === u.username || t.sellerId === u.name);
      const totalSales = agentTickets.reduce((sum, t) => sum + t.totalAmount, 0);
      return {
        ...u,
        todaySales: totalSales,
        ticketsCount: agentTickets.length
      };
    });
  }

  async createAgent({ username, pin, password, name, posId, branchName, role = 'agent' }) {
    const id = `usr_${Date.now()}`;
    const cleanUser = String(username).toLowerCase().trim();

    if (this.pgPool) {
      try {
        await this.pgPool.query(`
          INSERT INTO loto_users (id, username, pin, password, name, role, pos_id, branch_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [id, cleanUser, String(pin), String(password || pin), name, role, posId, branchName]);
      } catch (err) {
        console.error('[POSTGRES] createAgent error:', err.message);
        throw err;
      }
    }

    return { id, username: cleanUser, pin, name, role, posId, branchName, enabled: true };
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

