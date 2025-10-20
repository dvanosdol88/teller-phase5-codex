-- Create unified manual_liability and manual_asset tables with seeded rows

BEGIN;

CREATE TABLE IF NOT EXISTS manual_liability (
  slug TEXT PRIMARY KEY,
  loan_amount_usd NUMERIC(14,2) NULL,
  interest_rate_pct NUMERIC(7,4) NULL,
  monthly_payment_usd NUMERIC(14,2) NULL,
  outstanding_balance_usd NUMERIC(14,2) NULL,
  term_months INTEGER NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NULL,
  CONSTRAINT manual_liability_slug_chk CHECK (
    slug IN ('heloc_loan','original_mortgage_loan_672','roof_loan')
  ),
  CONSTRAINT manual_liability_nonnegative_chk CHECK (
    (loan_amount_usd IS NULL OR loan_amount_usd >= 0)
    AND (monthly_payment_usd IS NULL OR monthly_payment_usd >= 0)
    AND (outstanding_balance_usd IS NULL OR outstanding_balance_usd >= 0)
    AND (interest_rate_pct IS NULL OR (interest_rate_pct >= 0 AND interest_rate_pct < 100))
    AND (term_months IS NULL OR term_months >= 0)
  )
);

-- Seed the three liabilities if not present
INSERT INTO manual_liability (slug, term_months)
SELECT v.slug, v.term_months
FROM (
  VALUES
    ('heloc_loan', NULL),
    ('original_mortgage_loan_672', 360),
    ('roof_loan', 120)
) AS v(slug, term_months)
LEFT JOIN manual_liability ml ON ml.slug = v.slug
WHERE ml.slug IS NULL;


CREATE TABLE IF NOT EXISTS manual_asset (
  slug TEXT PRIMARY KEY,
  value_usd NUMERIC(14,2) NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NULL,
  CONSTRAINT manual_asset_slug_chk CHECK (
    slug IN ('property_672_elm_value')
  ),
  CONSTRAINT manual_asset_nonnegative_chk CHECK (
    (value_usd IS NULL OR value_usd >= 0)
  )
);

-- Seed the asset slug if not present
INSERT INTO manual_asset (slug)
SELECT v.slug
FROM (VALUES ('property_672_elm_value')) AS v(slug)
LEFT JOIN manual_asset ma ON ma.slug = v.slug
WHERE ma.slug IS NULL;

COMMIT;

