import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[MIGRATION] Error: DATABASE_URL not set in .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('[MIGRATION] Connected to Neon PostgreSQL. Creating tables...');

    await client.query(`
      -- Configuration Table
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

      -- Draws Table
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

      -- Tickets Table
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
        status VARCHAR(20) DEFAULT 'pending',
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
      ALTER TABLE loto_tickets ALTER COLUMN draw_time DROP NOT NULL;

      -- Results Table
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

      -- Blocked / Bet limits on specific numbers
      CREATE TABLE IF NOT EXISTS loto_blocked_numbers (
        draw_id VARCHAR(50) NOT NULL,
        number_key VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL DEFAULT 0,
        PRIMARY KEY (draw_id, number_key)
      );

      -- Indexes for fast lookup
      CREATE INDEX IF NOT EXISTS idx_tickets_draw ON loto_tickets(draw_id, draw_date);
      CREATE INDEX IF NOT EXISTS idx_tickets_barcode ON loto_tickets(barcode);
      CREATE INDEX IF NOT EXISTS idx_tickets_security ON loto_tickets(security_code);
      CREATE INDEX IF NOT EXISTS idx_results_draw ON loto_results(draw_id, draw_date);
    `);

    console.log('[MIGRATION] Tables & Indexes created successfully in Neon.');

    // Seed initial data if tables are empty
    const cfgCheck = await client.query('SELECT COUNT(*) FROM loto_config');
    if (parseInt(cfgCheck.rows[0].count) === 0) {
      console.log('[MIGRATION] Seeding initial config and draws from local data...');
      let localStore = null;
      const storeFile = path.join(__dirname, 'data', 'store.json');
      if (fs.existsSync(storeFile)) {
        try {
          localStore = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
        } catch (e) {
          console.warn('[MIGRATION] Warning: could not parse store.json', e.message);
        }
      }

      const cfg = localStore?.config || {
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
          bolette_lot1: 50,
          bolette_lot2: 20,
          bolette_lot3: 10,
          mariage: 1000,
          loto3: 500,
          loto4: 5000
        },
        disclaimerHt: "Tikè sa a valab pandan 90 jou sèlman. Pa gen ranbousman si tikè a pèdi oubyen chire.",
        disclaimerFr: "Ce billet est valable pendant 90 jours seulement. Aucun remboursement en cas de perte ou détérioration."
      };

      await client.query(`
        INSERT INTO loto_config (
          id, company_name, company_subtitle, pos_id, branch_name, phone,
          currency, currency_symbol, cancellation_window_minutes, max_bet_per_number,
          min_bet, multipliers, disclaimer_ht, disclaimer_fr
        ) VALUES (
          'main', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
      `, [
        cfg.companyName, cfg.companySubtitle, cfg.posId, cfg.branchName, cfg.phone,
        cfg.currency, cfg.currencySymbol, cfg.cancellationWindowMinutes, cfg.maxBetPerNumber,
        cfg.minBet, JSON.stringify(cfg.multipliers), cfg.disclaimerHt, cfg.disclaimerFr
      ]);

      const draws = localStore?.draws || [
        { id: "ny_midday", state: "NY", nameFr: "New York Midi", nameHt: "Nouyòk Midi", timePeriod: "midday", cutoffTime: "14:15", drawTime: "14:30", timeZone: "America/New_York", enabled: true, manualOverride: null },
        { id: "ny_evening", state: "NY", nameFr: "New York Soir", nameHt: "Nouyòk Swè", timePeriod: "evening", cutoffTime: "22:15", drawTime: "22:30", timeZone: "America/New_York", enabled: true, manualOverride: null },
        { id: "fl_midday", state: "FL", nameFr: "Floride Midi", nameHt: "Florid Midi", timePeriod: "midday", cutoffTime: "13:15", drawTime: "13:30", timeZone: "America/New_York", enabled: true, manualOverride: null },
        { id: "fl_evening", state: "FL", nameFr: "Floride Soir", nameHt: "Florid Swè", timePeriod: "evening", cutoffTime: "21:15", drawTime: "21:45", timeZone: "America/New_York", enabled: true, manualOverride: null },
        { id: "ga_midday", state: "GA", nameFr: "Géorgie Midi", nameHt: "Jòdja Midi", timePeriod: "midday", cutoffTime: "12:15", drawTime: "12:29", timeZone: "America/New_York", enabled: true, manualOverride: null },
        { id: "ga_evening", state: "GA", nameFr: "Géorgie Soir", nameHt: "Jòdja Swè", timePeriod: "evening", cutoffTime: "18:45", drawTime: "19:00", timeZone: "America/New_York", enabled: true, manualOverride: null }
      ];

      for (const d of draws) {
        await client.query(`
          INSERT INTO loto_draws (
            id, state, name_fr, name_ht, time_period, cutoff_time, draw_time, timezone, enabled, manual_override
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [d.id, d.state, d.nameFr, d.nameHt, d.timePeriod, d.cutoffTime, d.drawTime, d.timeZone || 'America/New_York', d.enabled, d.manualOverride]);
      }

      if (localStore?.tickets && localStore.tickets.length > 0) {
        for (const t of localStore.tickets) {
          await client.query(`
            INSERT INTO loto_tickets (
              id, barcode, security_code, draw_id, draw_name_fr, draw_name_ht,
              draw_date, draw_time, total_amount, currency, currency_symbol,
              status, plays, winnings, branch_name, pos_id, seller_id,
              cancelled_at, paid_at, paid_by, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            )
            ON CONFLICT (id) DO NOTHING
          `, [
            t.id, t.barcode, t.securityCode, t.drawId, t.drawNameFr, t.drawNameHt,
            t.drawDate, t.drawTime, t.totalAmount, t.currency, t.currencySymbol,
            t.status, JSON.stringify(t.plays), JSON.stringify(t.winnings || {}),
            t.branchName, t.posId, t.sellerId, t.cancelledAt, t.paidAt, t.paidBy,
            t.createdAt || new Date().toISOString()
          ]);
        }
      }

      if (localStore?.results && localStore.results.length > 0) {
        for (const r of localStore.results) {
          await client.query(`
            INSERT INTO loto_results (
              id, draw_id, draw_date, lot1, lot2, lot3, pick3, pick4, entered_at, verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
          `, [r.id, r.drawId, r.drawDate, r.lot1, r.lot2, r.lot3, r.pick3, r.pick4, r.enteredAt || new Date().toISOString(), r.verified !== false]);
        }
      }

      console.log('[MIGRATION] Seeding completed.');
    } else {
      console.log('[MIGRATION] Database already contains records. Skipping seed.');
    }

  } catch (err) {
    console.error('[MIGRATION] Migration error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// If run directly:
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration().then(() => {
    console.log('[MIGRATION] All operations completed successfully.');
    pool.end();
    process.exit(0);
  }).catch((err) => {
    console.error('[MIGRATION] Fatal error:', err);
    pool.end();
    process.exit(1);
  });
}
