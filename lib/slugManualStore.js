const { Pool } = require('pg');

const LIABILITY_SLUGS = new Set(['heloc_loan','original_mortgage_loan_672','roof_loan']);
const ASSET_SLUG = 'property_672_elm_value';

function toNumberOrNull(v) { return v == null ? null : Number(v); }

class SlugManualStore {
  constructor(options = {}) {
    const { connectionString = process.env.DATABASE_URL, ssl = process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } } = options;
    if (!connectionString) throw new Error('DATABASE_URL is required for SlugManualStore');
    this.pool = new Pool({ connectionString, ssl });
  }

  async init() {
    // Ensure tables exist by running our migration file if present (idempotent)
    const fs = require('fs');
    const path = require('path');
    const p = path.join(__dirname, '..', 'sql', 'manual', '003_create_manual_liability_and_asset.sql');
    if (fs.existsSync(p)) {
      const sql = fs.readFileSync(p, 'utf8');
      await this.pool.query(sql);
    }
  }

  async close() { await this.pool.end(); }

  // Reads
  async getAllLiabilities() {
    const { rows } = await this.pool.query('SELECT * FROM manual_liability');
    const out = {};
    for (const r of rows) {
      if (!LIABILITY_SLUGS.has(r.slug)) continue;
      out[r.slug] = {
        loanAmountUsd: toNumberOrNull(r.loan_amount_usd),
        interestRatePct: toNumberOrNull(r.interest_rate_pct),
        monthlyPaymentUsd: toNumberOrNull(r.monthly_payment_usd),
        outstandingBalanceUsd: toNumberOrNull(r.outstanding_balance_usd),
        termMonths: r.term_months == null ? null : Number(r.term_months),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
        updatedBy: r.updated_by || null,
      };
    }
    // Ensure all slugs present (seed should do this, but be defensive)
    for (const slug of LIABILITY_SLUGS) {
      if (!out[slug]) out[slug] = { loanAmountUsd: null, interestRatePct: null, monthlyPaymentUsd: null, outstandingBalanceUsd: null, termMonths: slug==='roof_loan'?120:(slug==='original_mortgage_loan_672'?360:null), updatedAt: null, updatedBy: null };
    }
    return out;
  }

  async getAssetValue() {
    const { rows } = await this.pool.query('SELECT value_usd, updated_at, updated_by FROM manual_asset WHERE slug=$1', [ASSET_SLUG]);
    const r = rows[0];
    return {
      slug: ASSET_SLUG,
      valueUsd: r && r.value_usd != null ? Number(r.value_usd) : null,
      updatedAt: r ? new Date(r.updated_at).toISOString() : null,
      updatedBy: r ? r.updated_by || null : null,
    };
  }

  // Writes
  static normCurrency(v) {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error('must be a non-negative number');
    return Math.round(n * 100) / 100;
  }
  static normPercent(v) {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n >= 100) throw new Error('must be a percentage 0-<100');
    return Math.round(n * 10000) / 10000;
  }
  static normInt(v) {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) throw new Error('must be an integer >= 0');
    return n;
  }

  async updateLiability(slug, fields = {}, updatedBy = null) {
    if (!LIABILITY_SLUGS.has(slug)) throw new Error('unknown_slug');
    const allowed = ['loanAmountUsd','interestRatePct','monthlyPaymentUsd','outstandingBalanceUsd','termMonths'];
    const clean = {};
    for (const k of Object.keys(fields)) {
      if (!allowed.includes(k)) throw new Error('unknown_field');
      const v = fields[k];
      if (k === 'loanAmountUsd' || k === 'monthlyPaymentUsd' || k === 'outstandingBalanceUsd') clean[k] = SlugManualStore.normCurrency(v);
      else if (k === 'interestRatePct') clean[k] = SlugManualStore.normPercent(v);
      else if (k === 'termMonths') clean[k] = SlugManualStore.normInt(v);
    }

    const cols = [];
    const params = [slug];
    const sets = [];
    let idx = 2;
    if (clean.loanAmountUsd !== undefined) { cols.push('loan_amount_usd'); params.push(clean.loanAmountUsd); sets.push(`loan_amount_usd=$${idx++}`); }
    if (clean.interestRatePct !== undefined) { cols.push('interest_rate_pct'); params.push(clean.interestRatePct); sets.push(`interest_rate_pct=$${idx++}`); }
    if (clean.monthlyPaymentUsd !== undefined) { cols.push('monthly_payment_usd'); params.push(clean.monthlyPaymentUsd); sets.push(`monthly_payment_usd=$${idx++}`); }
    if (clean.outstandingBalanceUsd !== undefined) { cols.push('outstanding_balance_usd'); params.push(clean.outstandingBalanceUsd); sets.push(`outstanding_balance_usd=$${idx++}`); }
    if (clean.termMonths !== undefined) { cols.push('term_months'); params.push(clean.termMonths); sets.push(`term_months=$${idx++}`); }
    params.push(updatedBy || null);

    if (sets.length === 0) return this.getAllLiabilities();

    const stmt = `INSERT INTO manual_liability (slug, ${cols.join(', ')}, updated_at, updated_by)
                  VALUES ($1, ${cols.map((_,i)=>`$${i+2}`).join(', ')}, now(), $${idx})
                  ON CONFLICT (slug) DO UPDATE SET ${sets.join(', ')}, updated_at=now(), updated_by=EXCLUDED.updated_by`;
    await this.pool.query(stmt, params);
    return this.getAllLiabilities();
  }

  async updateAssetValue(valueUsd, updatedBy = null) {
    const v = SlugManualStore.normCurrency(valueUsd);
    await this.pool.query(
      `INSERT INTO manual_asset (slug, value_usd, updated_at, updated_by)
       VALUES ($1, $2, now(), $3)
       ON CONFLICT (slug) DO UPDATE SET value_usd=EXCLUDED.value_usd, updated_at=now(), updated_by=EXCLUDED.updated_by`,
      [ASSET_SLUG, v, updatedBy || null]
    );
    return this.getAssetValue();
  }
}

module.exports = { SlugManualStore, LIABILITY_SLUGS, ASSET_SLUG };

