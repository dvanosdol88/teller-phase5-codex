-- Remove FK constraint from manual_data table
-- This allows manual data to be saved for any account_id without requiring the account to exist first

BEGIN;

-- Show current constraints
SELECT conname FROM pg_constraint WHERE conrelid = 'manual_data'::regclass;

-- Drop the FK constraint if it exists
ALTER TABLE manual_data DROP CONSTRAINT IF EXISTS manual_data_account_id_fkey;

-- Create index to keep lookups fast (idempotent)
CREATE INDEX IF NOT EXISTS idx_manual_data_account_id ON manual_data(account_id);

-- Document the intent
COMMENT ON TABLE manual_data IS 'Manual rent-roll per account; FK to accounts is optional and may be enforced externally.';

-- Show final constraints
SELECT conname FROM pg_constraint WHERE conrelid = 'manual_data'::regclass;

COMMIT;

-- Done! You should see the FK constraint is no longer listed.

