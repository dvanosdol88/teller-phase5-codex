-- Manual fields tables. Foreign keys to accounts are optional; enforce in DB if desired.

CREATE TABLE IF NOT EXISTS manual_property (
  account_id TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('first_floor','second_floor','third_floor','barn')),
  rent_amount NUMERIC(12,2) NULL,
  tenant_name TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NULL,
  PRIMARY KEY (account_id, unit)
);

CREATE TABLE IF NOT EXISTS manual_heloc (
  account_id TEXT PRIMARY KEY,
  amount NUMERIC(12,2) NULL,
  interest_rate_pct NUMERIC(5,2) NULL,
  term_months INTEGER NULL,
  payment_amount NUMERIC(12,2) NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NULL
);

CREATE TABLE IF NOT EXISTS manual_mortgage (
  account_id TEXT PRIMARY KEY,
  principal_amount NUMERIC(12,2) NULL,
  interest_rate_pct NUMERIC(5,2) NULL,
  term_months INTEGER NULL,
  payment_day INTEGER NULL CHECK (payment_day IS NULL OR (payment_day BETWEEN 1 AND 28)),
  payment_amount NUMERIC(12,2) NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NULL
);

