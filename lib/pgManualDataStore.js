const { Pool } = require('pg');

class PgManualDataStore {
  constructor(options = {}) {
    const {
      connectionString = process.env.DATABASE_URL,
      ssl = process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
      tableName = process.env.MANUAL_DATA_TABLE || 'manual_data',
    } = options;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required for PgManualDataStore');
    }

    this.pool = new Pool({ connectionString, ssl });
    this.table = tableName;
  }

  async init() {
    // Create table if it doesn't exist
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.table} (
        account_id TEXT PRIMARY KEY,
        rent_roll NUMERIC NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await this.pool.query(sql);
  }

  // Normalize incoming rent_roll to number|null, ensure non-negative when provided
  static normalizeAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) throw new Error('rent_roll must be a number or null');
    if (num < 0) throw new Error('rent_roll must be non-negative');
    // Round to 2 decimals to mirror UI currency formatting semantics
    return Math.round(num * 100) / 100;
  }

  async get(accountId) {
    const { rows } = await this.pool.query(
      `SELECT account_id, rent_roll, updated_at FROM ${this.table} WHERE account_id = $1`,
      [accountId]
    );
    if (rows.length === 0) {
      return { account_id: accountId, rent_roll: null, updated_at: null };
    }
    const row = rows[0];
    return {
      account_id: row.account_id,
      rent_roll: row.rent_roll === null ? null : Number(row.rent_roll),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
  }

  async set(accountId, payload) {
    const amount = PgManualDataStore.normalizeAmount(payload && payload.rent_roll);
    let rows;
    try {
      ({ rows } = await this.pool.query(
        `INSERT INTO ${this.table} (account_id, rent_roll, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (account_id) DO UPDATE SET rent_roll = EXCLUDED.rent_roll, updated_at = now()
         RETURNING account_id, rent_roll, updated_at`,
        [accountId, amount]
      ));
    } catch (e) {
      if (e && e.code === '23503') {
        const err = new Error('Foreign key violation: account_id does not exist in the referenced accounts table');
        err.code = 'FK_VIOLATION';
        throw err;
      }
      throw e;
    }
    const row = rows[0];
    return {
      account_id: row.account_id,
      rent_roll: row.rent_roll === null ? null : Number(row.rent_roll),
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  async clear(accountId) {
    let rows;
    try {
      ({ rows } = await this.pool.query(
        `INSERT INTO ${this.table} (account_id, rent_roll, updated_at)
         VALUES ($1, NULL, now())
         ON CONFLICT (account_id) DO UPDATE SET rent_roll = NULL, updated_at = now()
         RETURNING account_id, rent_roll, updated_at`,
        [accountId]
      ));
    } catch (e) {
      if (e && e.code === '23503') {
        const err = new Error('Foreign key violation: account_id does not exist in the referenced accounts table');
        err.code = 'FK_VIOLATION';
        throw err;
      }
      throw e;
    }
    const row = rows[0];
    return {
      account_id: row.account_id,
      rent_roll: null,
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { PgManualDataStore };
