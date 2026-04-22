const { Pool } = require('pg');
require('dotenv').config();

// Database connection config from env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase
  }
});

/**
 * Database Helper for PostgreSQL
 * Replaces better-sqlite3 with pg pool for cloud persistence
 */
const db = {
  // Generic query executor
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (err) {
      console.error('Database Query Error:', err);
      throw err;
    }
  },

  // Wrapper for getting a single row
  async get(text, params) {
    const res = await this.query(text, params);
    return res.rows[0];
  },

  // Wrapper for getting all rows
  async all(text, params) {
    const res = await this.query(text, params);
    return res.rows;
  },

  // Wrapper for inserting and getting the new ID
  async run(text, params) {
    const res = await this.query(text, params);
    return res.rows[0];
  },

  // Initialize Tables (Call this on server start)
  async init() {
    console.log('Initializing PostgreSQL schema...');
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          plan TEXT DEFAULT 'free',
          api_key TEXT UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS mt5_connections (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          broker TEXT NOT NULL,
          login TEXT NOT NULL,
          password_encrypted TEXT NOT NULL,
          server TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          last_heartbeat TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS signals (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          symbol TEXT NOT NULL,
          type TEXT NOT NULL,
          entry_price REAL NOT NULL,
          sl REAL NOT NULL,
          tp REAL NOT NULL,
          status TEXT DEFAULT 'open',
          lot_size REAL DEFAULT 0.1,
          score REAL DEFAULT 0.5,
          concepts_json TEXT,
          pnl REAL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          closed_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          subscriber_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plan TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('PostgreSQL schema verified and ready.');
    } catch (err) {
      console.error('Schema Initialization Error:', err);
      throw err;
    }
  }
};

module.exports = db;
