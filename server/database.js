const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data.db');

let db;

function getDb() {
   if (!db) {
      db = new Database(DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
   }
   return db;
}

function initDatabase() {
   const db = getDb();

   // Users table
   db.exec(`
      CREATE TABLE IF NOT EXISTS users (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         email TEXT UNIQUE NOT NULL,
         password_hash TEXT NOT NULL,
         name TEXT NOT NULL,
         plan TEXT DEFAULT 'free',
         api_key TEXT,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
   `);

   // MT5 Connections table
   db.exec(`
      CREATE TABLE IF NOT EXISTS mt5_connections (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL,
         broker TEXT NOT NULL,
         login TEXT NOT NULL,
         password_encrypted TEXT NOT NULL,
         server TEXT NOT NULL,
         status TEXT DEFAULT 'disconnected',
         last_heartbeat DATETIME,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
   `);

   // Signals table
   db.exec(`
      CREATE TABLE IF NOT EXISTS signals (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL,
         symbol TEXT NOT NULL,
         type TEXT NOT NULL,
         entry_price REAL NOT NULL,
         sl REAL NOT NULL,
         tp REAL NOT NULL,
         status TEXT DEFAULT 'open',
         score REAL DEFAULT 0.5,
         concepts_json TEXT,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         closed_at DATETIME,
         pnl REAL DEFAULT 0,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
   `);

   // Subscriptions table
   db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         subscriber_id INTEGER NOT NULL,
         provider_user_id INTEGER NOT NULL,
         plan TEXT DEFAULT 'monthly',
         status TEXT DEFAULT 'active',
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
         FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
   `);

   // Account stats table (for daily tracking)
   db.exec(`
      CREATE TABLE IF NOT EXISTS account_stats (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL,
         date DATE NOT NULL,
         balance REAL NOT NULL,
         equity REAL NOT NULL,
         daily_pnl REAL DEFAULT 0,
         max_drawdown REAL DEFAULT 0,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
         UNIQUE(user_id, date)
      )
   `);

   // API keys table
   db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL,
         key TEXT UNIQUE NOT NULL,
         label TEXT,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
   `);

   // Signal rate limiting
   db.exec(`
      CREATE TABLE IF NOT EXISTS signal_rate_limits (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL,
         last_signal_at DATETIME,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
   `);

   // Create indexes
   db.exec(`
      CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id);
      CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
      CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider_user_id);
      CREATE INDEX IF NOT EXISTS idx_account_stats_user_date ON account_stats(user_id, date);
   `);

   console.log('[DB] Database initialized');
}

// User queries
const queries = {
   // Users
   createUser: (email, passwordHash, name) => {
      const stmt = getDb().prepare(`
         INSERT INTO users (email, password_hash, name, api_key) 
         VALUES (?, ?, ?, ?)
      `);
      const apiKey = crypto.randomBytes(32).toString('hex');
      const result = stmt.run(email, passwordHash, name, apiKey);
      return { id: result.lastInsertRowid, apiKey };
   },

   getUserByEmail: (email) => {
      return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
   },

   getUserById: (id) => {
      return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
   },

   updateUserPlan: (userId, plan) => {
      return getDb().prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, userId);
   },

   // MT5 Connections
   createMT5Connection: (userId, broker, login, passwordEncrypted, server) => {
      const stmt = getDb().prepare(`
         INSERT INTO mt5_connections (user_id, broker, login, password_encrypted, server, status)
         VALUES (?, ?, ?, ?, ?, 'connected')
      `);
      const result = stmt.run(userId, broker, login, passwordEncrypted, server);
      return { id: result.lastInsertRowid };
   },

   getMT5ConnectionsByUser: (userId) => {
      return getDb().prepare('SELECT * FROM mt5_connections WHERE user_id = ?').all(userId);
   },

   getMT5ConnectionById: (id) => {
      return getDb().prepare('SELECT * FROM mt5_connections WHERE id = ?').get(id);
   },

   updateMT5Status: (id, status) => {
      const lastHeartbeat = status === 'connected' ? new Date().toISOString() : null;
      return getDb().prepare(`
         UPDATE mt5_connections 
         SET status = ?, last_heartbeat = ? 
         WHERE id = ?
      `).run(status, lastHeartbeat, id);
   },

   deleteMT5Connection: (id, userId) => {
      return getDb().prepare('DELETE FROM mt5_connections WHERE id = ? AND user_id = ?').run(id, userId);
   },

   // Signals
   createSignal: (userId, symbol, type, entryPrice, sl, tp, score, conceptsJson) => {
      const stmt = getDb().prepare(`
         INSERT INTO signals (user_id, symbol, type, entry_price, sl, tp, score, concepts_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `);
      const result = stmt.run(userId, symbol, type, entryPrice, sl, tp, score, conceptsJson);
      return { id: result.lastInsertRowid };
   },

   getSignalById: (id) => {
      return getDb().prepare('SELECT * FROM signals WHERE id = ?').get(id);
   },

   getSignals: (userId, options = {}) => {
      let sql = 'SELECT * FROM signals WHERE user_id = ?';
      const params = [userId];

      if (options.symbol) {
         sql += ' AND symbol = ?';
         params.push(options.symbol);
      }
      if (options.type) {
         sql += ' AND type = ?';
         params.push(options.type);
      }
      if (options.status) {
         sql += ' AND status = ?';
         params.push(options.status);
      }

      sql += ' ORDER BY created_at DESC';

      if (options.limit) {
         sql += ' LIMIT ?';
         params.push(options.limit);
      }
      if (options.offset) {
         sql += ' OFFSET ?';
         params.push(options.offset);
      }

      return getDb().prepare(sql).all(...params);
   },

   getSignalsCount: (userId, options = {}) => {
      let sql = 'SELECT COUNT(*) as count FROM signals WHERE user_id = ?';
      const params = [userId];

      if (options.symbol) {
         sql += ' AND symbol = ?';
         params.push(options.symbol);
      }
      if (options.type) {
         sql += ' AND type = ?';
         params.push(options.type);
      }
      if (options.status) {
         sql += ' AND status = ?';
         params.push(options.status);
      }

      return getDb().prepare(sql).get(...params).count;
   },

   getRecentSignals: (limit = 50) => {
      return getDb().prepare(`
         SELECT s.*, u.name as provider_name 
         FROM signals s 
         JOIN users u ON s.user_id = u.id 
         ORDER BY s.created_at DESC 
         LIMIT ?
      `).all(limit);
   },

   updateSignalStatus: (id, status, pnl = 0) => {
      const closedAt = status !== 'open' ? new Date().toISOString() : null;
      return getDb().prepare(`
         UPDATE signals 
         SET status = ?, closed_at = ?, pnl = ? 
         WHERE id = ?
      `).run(status, closedAt, pnl, id);
   },

   // Subscriptions
   createSubscription: (subscriberId, providerUserId, plan) => {
      const stmt = getDb().prepare(`
         INSERT INTO subscriptions (subscriber_id, provider_user_id, plan, status)
         VALUES (?, ?, ?, 'active')
      `);
      const result = stmt.run(subscriberId, providerUserId, plan);
      return { id: result.lastInsertRowid };
   },

   getSubscriptionsBySubscriber: (subscriberId) => {
      return getDb().prepare(`
         SELECT subs.*, u.name as provider_name, u.email as provider_email
         FROM subscriptions subs
         JOIN users u ON subs.provider_user_id = u.id
         WHERE subs.subscriber_id = ? AND subs.status = 'active'
      `).all(subscriberId);
   },

   getSubscriptionStatus: (subscriberId) => {
      return getDb().prepare(`
         SELECT subs.*, u.name as provider_name
         FROM subscriptions subs
         JOIN users u ON subs.provider_user_id = u.id
         WHERE subs.subscriber_id = ? AND subs.status = 'active'
         ORDER BY subs.created_at DESC
         LIMIT 1
      `).get(subscriberId);
   },

   cancelSubscription: (subscriberId, providerUserId) => {
      return getDb().prepare(`
         UPDATE subscriptions 
         SET status = 'cancelled' 
         WHERE subscriber_id = ? AND provider_user_id = ? AND status = 'active'
      `).run(subscriberId, providerUserId);
   },

   // Account Stats
   upsertAccountStats: (userId, date, balance, equity, dailyPnl, maxDrawdown) => {
      const stmt = getDb().prepare(`
         INSERT INTO account_stats (user_id, date, balance, equity, daily_pnl, max_drawdown)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET
            balance = excluded.balance,
            equity = excluded.equity,
            daily_pnl = excluded.daily_pnl,
            max_drawdown = MAX(max_drawdown, excluded.max_drawdown)
      `);
      stmt.run(userId, date, balance, equity, dailyPnl, maxDrawdown);
   },

   getAccountStatsHistory: (userId, days = 30) => {
      return getDb().prepare(`
         SELECT * FROM account_stats 
         WHERE user_id = ? AND date >= date('now', '-' || ? || ' days')
         ORDER BY date ASC
      `).all(userId, days);
   },

   getTodayStats: (userId) => {
      return getDb().prepare(`
         SELECT * FROM account_stats 
         WHERE user_id = ? AND date = date('now')
      `).get(userId);
   },

   // Dashboard Stats
   getDashboardStats: (userId) => {
      const stats = getDb().prepare(`
         SELECT 
            COALESCE(SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END), 0) as open_positions,
            COALESCE(SUM(CASE WHEN status IN ('tp', 'sl', 'closed') THEN pnl ELSE 0 END), 0) as total_pnl,
            COALESCE(SUM(CASE WHEN status IN ('tp', 'closed') THEN 1 ELSE 0 END), 0) as winning_trades,
            COALESCE(SUM(CASE WHEN status IN ('sl', 'closed') AND pnl < 0 THEN 1 ELSE 0 END), 0) as losing_trades,
            COUNT(*) as total_trades
         FROM signals 
         WHERE user_id = ?
      `).get(userId);

      const todayPnl = getDb().prepare(`
         SELECT COALESCE(SUM(pnl), 0) as pnl
         FROM signals 
         WHERE user_id = ? AND date(created_at) = date('now') AND status != 'open'
      `).get(userId).pnl;

      return { ...stats, today_pnl: todayPnl };
   },

   // Rate limiting
   checkRateLimit: (userId, minIntervalSeconds = 30) => {
      const lastSignal = getDb().prepare(`
         SELECT last_signal_at FROM signal_rate_limits WHERE user_id = ?
      `).get(userId);

      if (!lastSignal || !lastSignal.last_signal_at) {
         return true; // No previous signal
      }

      const lastTime = new Date(lastSignal.last_signal_at).getTime();
      const now = Date.now();
      const diff = (now - lastTime) / 1000;

      return diff >= minIntervalSeconds;
   },

   updateRateLimit: (userId) => {
      const stmt = getDb().prepare(`
         INSERT INTO signal_rate_limits (user_id, last_signal_at)
         VALUES (?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET last_signal_at = datetime('now')
      `);
      stmt.run(userId);
   },

   // API Keys
   getApiKeyByUser: (userId) => {
      return getDb().prepare('SELECT api_key FROM users WHERE id = ?').get(userId);
   },

   validateApiKey: (apiKey) => {
      const user = getDb().prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey);
      return user || null;
   }
};

module.exports = {
   initDatabase,
   getDb,
   queries
};
