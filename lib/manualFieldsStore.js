const { Pool } = require('pg');

class ManualFieldsStore {
  constructor(options = {}) {
    const {
      connectionString = process.env.DATABASE_URL,
      ssl = process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
    } = options;
    if (!connectionString) throw new Error('DATABASE_URL is required for ManualFieldsStore');
    this.pool = new Pool({ connectionString, ssl });
  }

  async init() {
    // Run table creation SQL
    const sql = require('fs').readFileSync(require('path').join(__dirname, '..', 'sql', 'manual', '001_create_manual_tables.sql'), 'utf8');
    await this.pool.query(sql);
  }

  static normCurrency(value) {
    if (value === null) return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) throw new Error('must be a non-negative number');
    return Math.round(num * 100) / 100;
  }
  static normPercent(value) {
    if (value === null) return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > 100) throw new Error('must be a percentage between 0 and 100');
    return Math.round(num * 100) / 100;
  }
  static normInt(value, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    if (value === null) return null;
    const num = Number(value);
    if (!Number.isInteger(num) || num < min || num > max) throw new Error(`must be an integer between ${min} and ${max}`);
    return num;
  }
  static normString(value) {
    if (value === null) return null;
    const s = String(value).trim();
    if (!s) throw new Error('must be a non-empty string');
    if (s.length > 120) throw new Error('must be <= 120 characters');
    return s;
  }

  // Property
  async getProperty(accountId, unit, field) {
    const { rows } = await this.pool.query(
      'SELECT account_id, unit, rent_amount, tenant_name, updated_at, updated_by FROM manual_property WHERE account_id=$1 AND unit=$2',
      [accountId, unit]
    );
    const row = rows[0];
    const value = row ? (field === 'rent_amount' ? (row.rent_amount == null ? null : Number(row.rent_amount)) : row.tenant_name ?? null) : null;
    return { account_id: accountId, key: `property.${unit}.${field}`, value, updated_at: row ? new Date(row.updated_at).toISOString() : null, updated_by: row ? row.updated_by || null : null };
  }
  async setProperty(accountId, unit, field, value, updatedBy) {
    let col, norm;
    if (field === 'rent_amount') { col = 'rent_amount'; norm = ManualFieldsStore.normCurrency(value); }
    else if (field === 'tenant_name') { col = 'tenant_name'; norm = ManualFieldsStore.normString(value); }
    else throw new Error('unknown field');
    const { rows } = await this.pool.query(
      `INSERT INTO manual_property (account_id, unit, ${col}, updated_at, updated_by)
       VALUES ($1,$2,$3, now(), $4)
       ON CONFLICT (account_id, unit) DO UPDATE SET ${col}=EXCLUDED.${col}, updated_at=now(), updated_by=EXCLUDED.updated_by
       RETURNING account_id, unit, ${col} as value, updated_at, updated_by`,
      [accountId, unit, norm, updatedBy || null]
    );
    const row = rows[0];
    return { account_id: accountId, key: `property.${unit}.${field}`, value: row.value === null ? null : (col === 'rent_amount' ? Number(row.value) : row.value), updated_at: new Date(row.updated_at).toISOString(), updated_by: row.updated_by || null };
  }

  // HELOC
  async getHeloc(accountId, field) {
    const { rows } = await this.pool.query('SELECT * FROM manual_heloc WHERE account_id=$1', [accountId]);
    const row = rows[0];
    const map = {
      amount: row && row.amount != null ? Number(row.amount) : null,
      interest_rate_pct: row && row.interest_rate_pct != null ? Number(row.interest_rate_pct) : null,
      term_months: row && row.term_months != null ? row.term_months : null,
      payment_amount: row && row.payment_amount != null ? Number(row.payment_amount) : null,
    };
    return { account_id: accountId, key: `heloc.${field}`, value: row ? map[field] : null, updated_at: row ? new Date(row.updated_at).toISOString() : null, updated_by: row ? row.updated_by || null : null };
  }
  async setHeloc(accountId, field, value, updatedBy) {
    let col, norm;
    if (field === 'amount' || field === 'payment_amount') { col = field; norm = ManualFieldsStore.normCurrency(value); }
    else if (field === 'interest_rate_pct') { col = field; norm = ManualFieldsStore.normPercent(value); }
    else if (field === 'term_months') { col = field; norm = ManualFieldsStore.normInt(value, { min: 1 }); }
    else throw new Error('unknown field');
    const { rows } = await this.pool.query(
      `INSERT INTO manual_heloc (account_id, ${col}, updated_at, updated_by)
       VALUES ($1, $2, now(), $3)
       ON CONFLICT (account_id) DO UPDATE SET ${col}=EXCLUDED.${col}, updated_at=now(), updated_by=EXCLUDED.updated_by
       RETURNING ${col} as value, updated_at, updated_by`,
      [accountId, norm, updatedBy || null]
    );
    const row = rows[0];
    return { account_id: accountId, key: `heloc.${field}`, value: row.value == null ? null : (col.includes('amount') ? Number(row.value) : row.value), updated_at: new Date(row.updated_at).toISOString(), updated_by: row.updated_by || null };
  }

  // Mortgage
  async getMortgage(accountId, field) {
    const { rows } = await this.pool.query('SELECT * FROM manual_mortgage WHERE account_id=$1', [accountId]);
    const row = rows[0];
    const map = {
      principal_amount: row && row.principal_amount != null ? Number(row.principal_amount) : null,
      interest_rate_pct: row && row.interest_rate_pct != null ? Number(row.interest_rate_pct) : null,
      term_months: row && row.term_months != null ? row.term_months : null,
      payment_day: row && row.payment_day != null ? row.payment_day : null,
      payment_amount: row && row.payment_amount != null ? Number(row.payment_amount) : null,
    };
    return { account_id: accountId, key: `mortgage.${field}`, value: row ? map[field] : null, updated_at: row ? new Date(row.updated_at).toISOString() : null, updated_by: row ? row.updated_by || null : null };
  }
  async setMortgage(accountId, field, value, updatedBy) {
    let col, norm;
    if (['principal_amount', 'payment_amount'].includes(field)) { col = field; norm = ManualFieldsStore.normCurrency(value); }
    else if (field === 'interest_rate_pct') { col = field; norm = ManualFieldsStore.normPercent(value); }
    else if (field === 'term_months') { col = field; norm = ManualFieldsStore.normInt(value, { min: 1 }); }
    else if (field === 'payment_day') { col = field; norm = ManualFieldsStore.normInt(value, { min: 1, max: 28 }); }
    else throw new Error('unknown field');
    const { rows } = await this.pool.query(
      `INSERT INTO manual_mortgage (account_id, ${col}, updated_at, updated_by)
       VALUES ($1, $2, now(), $3)
       ON CONFLICT (account_id) DO UPDATE SET ${col}=EXCLUDED.${col}, updated_at=now(), updated_by=EXCLUDED.updated_by
       RETURNING ${col} as value, updated_at, updated_by`,
      [accountId, norm, updatedBy || null]
    );
    const row = rows[0];
    return { account_id: accountId, key: `mortgage.${field}`, value: row.value == null ? null : (['principal_amount','payment_amount'].includes(col) ? Number(row.value) : row.value), updated_at: new Date(row.updated_at).toISOString(), updated_by: row.updated_by || null };
  }

  async close() { await this.pool.end(); }
}

module.exports = { ManualFieldsStore };

