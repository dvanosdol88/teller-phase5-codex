const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { getAccounts, getAccountById, getBalanceByAccountId, getTransactionsByAccountId } = require('./lib/dataStore');
const { PgManualDataStore } = require('./lib/pgManualDataStore');
const { ManualFieldsStore } = require('./lib/manualFieldsStore');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'https://teller10-15a.onrender.com';
const FEATURE_MANUAL_DATA = String(process.env.FEATURE_MANUAL_DATA || '').toLowerCase() === 'true';
const FEATURE_STATIC_DB = String(process.env.FEATURE_STATIC_DB || '').toLowerCase() === 'true';
const MANUAL_DATA_READONLY = String(process.env.MANUAL_DATA_READONLY || '').toLowerCase() === 'true';
const MANUAL_DATA_DRY_RUN = String(process.env.MANUAL_DATA_DRY_RUN || '').toLowerCase() === 'true';
const MANUAL_DATA_MIGRATION_SECRET = process.env.MANUAL_DATA_MIGRATION_SECRET || '';
const DATABASE_URL = process.env.DATABASE_URL;

const BASE_CONFIG = {
  apiBaseUrl: '/api',
  FEATURE_USE_BACKEND: true,
  FEATURE_MANUAL_DATA,
  FEATURE_STATIC_DB
};

function computeBackendMode(config) {
  if (config.FEATURE_STATIC_DB) {
    return 'static';
  }
  if (!config.FEATURE_USE_BACKEND) {
    return 'disabled';
  }
  return 'live';
}

function enforceServerGuards(config) {
  const next = { ...BASE_CONFIG, ...config };

  // Manual data can only be enabled when the environment allows it
  next.FEATURE_MANUAL_DATA = Boolean(FEATURE_MANUAL_DATA && next.FEATURE_MANUAL_DATA);

  // When static demo data is enabled, always short-circuit backend usage
  next.FEATURE_STATIC_DB = Boolean(FEATURE_STATIC_DB || next.FEATURE_STATIC_DB);
  if (next.FEATURE_STATIC_DB) {
    next.FEATURE_USE_BACKEND = false;
  } else {
    next.FEATURE_USE_BACKEND = Boolean(next.FEATURE_USE_BACKEND);
  }

  next.backendMode = computeBackendMode(next);
  return next;
}

const FALLBACK_CONFIG = enforceServerGuards(BASE_CONFIG);

// Manual data store (PostgreSQL)
let manualStore = null;
let manualFields = null;

function validateConfigPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Config payload is not an object');
  }

  if (typeof payload.apiBaseUrl !== 'string' || payload.apiBaseUrl.trim() === '') {
    throw new Error('Config payload missing required apiBaseUrl string');
  }

  const sanitizedConfig = {
    ...BASE_CONFIG,
    apiBaseUrl: payload.apiBaseUrl.trim()
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'FEATURE_USE_BACKEND')) {
    if (typeof payload.FEATURE_USE_BACKEND === 'boolean') {
      sanitizedConfig.FEATURE_USE_BACKEND = payload.FEATURE_USE_BACKEND;
    } else {
      console.warn('[config] Ignoring invalid FEATURE_USE_BACKEND value from backend payload');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'FEATURE_MANUAL_DATA')) {
    if (typeof payload.FEATURE_MANUAL_DATA === 'boolean') {
      sanitizedConfig.FEATURE_MANUAL_DATA = payload.FEATURE_MANUAL_DATA;
    } else {
      console.warn('[config] Ignoring invalid FEATURE_MANUAL_DATA value from backend payload');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'FEATURE_STATIC_DB')) {
    if (typeof payload.FEATURE_STATIC_DB === 'boolean') {
      sanitizedConfig.FEATURE_STATIC_DB = payload.FEATURE_STATIC_DB;
    } else {
      console.warn('[config] Ignoring invalid FEATURE_STATIC_DB value from backend payload');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'backendMode')) {
    if (typeof payload.backendMode === 'string') {
      sanitizedConfig.backendMode = payload.backendMode;
    } else {
      console.warn('[config] Ignoring invalid backendMode value from backend payload');
    }
  }

  return enforceServerGuards(sanitizedConfig);
}

async function fetchBackendConfig() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${BACKEND_URL}/api/config`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Backend config request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return validateConfigPayload(payload);
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

console.log(`[server] Starting proxy server on port ${PORT}`);
console.log(`[server] Backend URL: ${BACKEND_URL}`);
console.log(`[server] FEATURE_MANUAL_DATA: ${FEATURE_MANUAL_DATA}`);
console.log(`[server] FEATURE_STATIC_DB: ${FEATURE_STATIC_DB}`);
if (FEATURE_MANUAL_DATA) {
  console.log(`[server] MANUAL_DATA_READONLY: ${MANUAL_DATA_READONLY}`);
  console.log(`[server] MANUAL_DATA_DRY_RUN: ${MANUAL_DATA_DRY_RUN}`);
}

// Lightweight request id for tracing
app.use((req, res, next) => {
  const existing = req.headers['x-request-id'];
  const rid = existing || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  req.requestId = rid;
  res.setHeader('x-request-id', rid);
  next();
});

const jsonParser = express.json({ limit: '1mb' });

app.get('/api/config', async (req, res) => {
  try {
    const backendConfig = await fetchBackendConfig();
    res.json(backendConfig);
  } catch (error) {
    console.error(`[config] Falling back to static defaults: ${error.message}`);
    res.json({ ...FALLBACK_CONFIG });
  }
});

if (FEATURE_STATIC_DB) {
  console.log('[server] Static dataset routes enabled (demo mode)');

  app.get('/api/db/accounts', (req, res) => {
    const accounts = getAccounts();
    res.json({ accounts });
  });

  app.get('/api/db/accounts/:accountId/balances', (req, res) => {
    const { accountId } = req.params;
    const account = getAccountById(accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const balance = getBalanceByAccountId(accountId);
    if (!balance) {
      res.status(404).json({ error: 'Balance not found' });
      return;
    }

    res.json(balance);
  });

  app.get('/api/db/accounts/:accountId/transactions', (req, res) => {
    const { accountId } = req.params;
    const account = getAccountById(accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const { limit: limitQuery } = req.query;
    let limit = undefined;
    if (limitQuery !== undefined) {
      const parsed = Number(limitQuery);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        res.status(400).json({ error: 'limit must be a positive number' });
        return;
      }
      limit = Math.floor(parsed);
    } else {
      limit = 10;
    }

    const transactions = getTransactionsByAccountId(accountId, limit);
    if (!transactions) {
      res.status(404).json({ error: 'Transactions not found' });
      return;
    }

    res.json(transactions);
  });
} else {
  console.log('[server] Static dataset routes disabled; proxy will service /api/db requests');
}

// Optional PostgreSQL-backed Manual Data store setup
async function setupManualDataStore() {
  if (!FEATURE_MANUAL_DATA) return;
  if (!DATABASE_URL) {
    console.warn('[manual-data] FEATURE_MANUAL_DATA enabled but DATABASE_URL not set; routes will return defaults only.');
    return;
  }
  manualStore = new PgManualDataStore({ connectionString: DATABASE_URL });
  await manualStore.init();
  console.log('[manual-data] PostgreSQL manual data store initialized');

  manualFields = new ManualFieldsStore({ connectionString: DATABASE_URL });
  await manualFields.init();
  console.log('[manual-data] Manual fields tables ensured');
}
// Manual data routes using PostgreSQL store
app.get('/api/db/accounts/:accountId/manual-data', async (req, res) => {
  try {
    const { accountId } = req.params;
    // Do NOT require account to exist; manual data may be set ahead of account wiring
    if (!FEATURE_MANUAL_DATA || !manualStore) {
      return res.json({ account_id: accountId, rent_roll: null, updated_at: null });
    }
    const payload = await manualStore.get(accountId);
    res.json(payload);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', requestId: req.requestId, scope: 'manual-data', op: 'GET', accountId: req.params.accountId, message: error.message }));
    res.status(500).json({ error: 'Failed to read manual data', request_id: req.requestId });
  }
});

app.put('/api/db/accounts/:accountId/manual-data', jsonParser, async (req, res) => {
  const { accountId } = req.params;
  // Do NOT require account to exist; allow pre-provisioning
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (!Object.prototype.hasOwnProperty.call(body, 'rent_roll')) {
    res.status(400).json({ error: 'rent_roll is required (use null to clear)' });
    return;
  }

  const { rent_roll } = body;
  if (MANUAL_DATA_READONLY) {
    return res.status(405).json({ error: 'manual_data_readonly', request_id: req.requestId });
  }
  if (!FEATURE_MANUAL_DATA || !manualStore) {
    return res.status(503).json({ error: 'manual_data_store_unavailable', request_id: req.requestId });
  }

  try {
    if (MANUAL_DATA_DRY_RUN) {
      const normalized = PgManualDataStore.normalizeAmount(rent_roll);
      return res.json({ account_id: accountId, rent_roll: normalized, updated_at: new Date().toISOString(), source: 'dry-run' });
    }
    if (rent_roll === null) {
      const cleared = await manualStore.clear(accountId);
      return res.json(cleared);
    }
    const saved = await manualStore.set(accountId, { rent_roll });
    res.json(saved);
  } catch (error) {
    const payload = { error: 'Failed to persist manual data', message: error.message, request_id: req.requestId };
    if (error && error.code === 'FK_VIOLATION') {
      payload.code = 'FK_VIOLATION';
      payload.hint = 'Seed this account_id in the referenced accounts table or relax the FK constraint';
      console.error(JSON.stringify({ level: 'error', requestId: req.requestId, scope: 'manual-data', op: 'PUT', accountId, message: error.message, code: 'FK_VIOLATION' }));
      return res.status(424).json(payload);
    }
    console.error(JSON.stringify({ level: 'error', requestId: req.requestId, scope: 'manual-data', op: 'PUT', accountId, message: error.message }));
    res.status(400).json(payload);
  }
});

// Health endpoint with simple connectivity check (served by this proxy)
app.get('/api/healthz', async (req, res) => {
  const result = {
    ok: true,
    backendUrl: BACKEND_URL,
    manualData: {
      enabled: FEATURE_MANUAL_DATA,
      readonly: MANUAL_DATA_READONLY,
      dryRun: MANUAL_DATA_DRY_RUN,
      connected: null,
    }
  };
  if (FEATURE_MANUAL_DATA && manualStore) {
    try {
      await manualStore.pool.query('SELECT 1');
      result.manualData.connected = true;
    } catch (e) {
      result.ok = false;
      result.manualData.connected = false;
      result.manualData.error = e.message;
    }
  }
  res.json(result);
});

if (MANUAL_DATA_MIGRATION_SECRET) {
  console.log('[manual-data] Migration endpoint protected by MANUAL_DATA_MIGRATION_SECRET');

  // TEMPORARY: Migration endpoint to drop FK constraint (guarded by shared secret header)
  app.post('/api/migrate/drop-manual-data-fk', async (req, res) => {
    if (!FEATURE_MANUAL_DATA || !manualStore) {
      return res.status(503).json({ error: 'manual_data_not_enabled' });
    }

    const providedSecret = req.get('x-manual-data-migration-secret');
    if (!providedSecret || providedSecret !== MANUAL_DATA_MIGRATION_SECRET) {
      return res.status(403).json({ error: 'forbidden' });
    }

    try {
      const steps = [];

      // Show current constraints
      const before = await manualStore.pool.query(
        "SELECT conname FROM pg_constraint WHERE conrelid = 'manual_data'::regclass"
      );
      steps.push({ step: 'before', constraints: before.rows.map(r => r.conname) });

      // Drop FK constraint
      await manualStore.pool.query('ALTER TABLE manual_data DROP CONSTRAINT IF EXISTS manual_data_account_id_fkey');
      steps.push({ step: 'drop_fk', status: 'done' });

      // Create index
      await manualStore.pool.query('CREATE INDEX IF NOT EXISTS idx_manual_data_account_id ON manual_data(account_id)');
      steps.push({ step: 'create_index', status: 'done' });

      // Add comment
      await manualStore.pool.query("COMMENT ON TABLE manual_data IS 'Manual rent-roll per account; FK to accounts is optional and may be enforced externally.'");
      steps.push({ step: 'add_comment', status: 'done' });

      // Show final constraints
      const after = await manualStore.pool.query(
        "SELECT conname FROM pg_constraint WHERE conrelid = 'manual_data'::regclass"
      );
      steps.push({ step: 'after', constraints: after.rows.map(r => r.conname) });

      res.json({ success: true, steps });
    } catch (error) {
      console.error('[migrate] Failed:', error);
      res.status(500).json({ error: 'migration_failed', message: error.message });
    }
  });
} else {
  console.log('[manual-data] Migration endpoint disabled (no MANUAL_DATA_MIGRATION_SECRET provided)');
}

// Manual field endpoints (property, heloc, mortgage)
// Property
app.get('/api/db/accounts/:accountId/manual/property/:unit/:field', async (req, res) => {
  if (!FEATURE_MANUAL_DATA) return res.status(404).json({ error: 'manual_data_disabled' });
  try {
    const { accountId, unit, field } = req.params;
    if (!manualFields) return res.json({ account_id: accountId, key: `property.${unit}.${field}`, value: null, updated_at: null, updated_by: null });
    const data = await manualFields.getProperty(accountId, unit, field);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: 'validation_failed', reason: error.message, request_id: req.requestId });
  }
});

app.put('/api/db/accounts/:accountId/manual/property/:unit/:field', jsonParser, async (req, res) => {
  if (!FEATURE_MANUAL_DATA) return res.status(404).json({ error: 'manual_data_disabled' });
  if (MANUAL_DATA_READONLY) return res.status(405).json({ error: 'manual_data_readonly', request_id: req.requestId });
  if (!manualFields) return res.status(503).json({ error: 'manual_fields_store_unavailable', request_id: req.requestId });
  try {
    const { accountId, unit, field } = req.params;
    const { value, updated_by } = req.body || {};
    if (MANUAL_DATA_DRY_RUN) {
      // just validate
      await manualFields.setProperty(accountId, unit, field, value, updated_by);
      return res.json({ account_id: accountId, key: `property.${unit}.${field}`, value, updated_at: new Date().toISOString(), updated_by });
    }
    const saved = await manualFields.setProperty(accountId, unit, field, value, updated_by);
    res.json(saved);
  } catch (error) {
    const payload = { error: 'validation_failed', reason: error.message, request_id: req.requestId };
    res.status(400).json(payload);
  }
});

// HELOC
app.get('/api/db/accounts/:accountId/manual/heloc/:field', async (req, res) => {
  if (!FEATURE_MANUAL_DATA) return res.status(404).json({ error: 'manual_data_disabled' });
  try {
    const { accountId, field } = req.params;
    if (!manualFields) return res.json({ account_id: accountId, key: `heloc.${field}`, value: null, updated_at: null, updated_by: null });
    const data = await manualFields.getHeloc(accountId, field);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: 'validation_failed', reason: error.message, request_id: req.requestId });
  }
});

app.put('/api/db/accounts/:accountId/manual/heloc/:field', jsonParser, async (req, res) => {
  if (!FEATURE_MANUAL_DATA) return res.status(404).json({ error: 'manual_data_disabled' });
  if (MANUAL_DATA_READONLY) return res.status(405).json({ error: 'manual_data_readonly', request_id: req.requestId });
  if (!manualFields) return res.status(503).json({ error: 'manual_fields_store_unavailable', request_id: req.requestId });
  try {
    const { accountId, field } = req.params;
    const { value, updated_by } = req.body || {};
    if (MANUAL_DATA_DRY_RUN) {
      await manualFields.setHeloc(accountId, field, value, updated_by);
      return res.json({ account_id: accountId, key: `heloc.${field}`, value, updated_at: new Date().toISOString(), updated_by });
    }
    const saved = await manualFields.setHeloc(accountId, field, value, updated_by);
    res.json(saved);
  } catch (error) {
    const payload = { error: 'validation_failed', reason: error.message, request_id: req.requestId };
    res.status(400).json(payload);
  }
});

// Mortgage
app.get('/api/db/accounts/:accountId/manual/mortgage/:field', async (req, res) => {
  if (!FEATURE_MANUAL_DATA) return res.status(404).json({ error: 'manual_data_disabled' });
  try {
    const { accountId, field } = req.params;
    if (!manualFields) return res.json({ account_id: accountId, key: `mortgage.${field}`, value: null, updated_at: null, updated_by: null });
    const data = await manualFields.getMortgage(accountId, field);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: 'validation_failed', reason: error.message, request_id: req.requestId });
  }
});

app.put('/api/db/accounts/:accountId/manual/mortgage/:field', jsonParser, async (req, res) => {
  if (!FEATURE_MANUAL_DATA) return res.status(404).json({ error: 'manual_data_disabled' });
  if (MANUAL_DATA_READONLY) return res.status(405).json({ error: 'manual_data_readonly', request_id: req.requestId });
  if (!manualFields) return res.status(503).json({ error: 'manual_fields_store_unavailable', request_id: req.requestId });
  try {
    const { accountId, field } = req.params;
    const { value, updated_by } = req.body || {};
    if (MANUAL_DATA_DRY_RUN) {
      await manualFields.setMortgage(accountId, field, value, updated_by);
      return res.json({ account_id: accountId, key: `mortgage.${field}`, value, updated_at: new Date().toISOString(), updated_by });
    }
    const saved = await manualFields.setMortgage(accountId, field, value, updated_by);
    res.json(saved);
  } catch (error) {
    const payload = { error: 'validation_failed', reason: error.message, request_id: req.requestId };
    res.status(400).json(payload);
  }
});
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  proxyTimeout: 30000,
  timeout: 30000,
  pathRewrite: {
    '^/api': '/api'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[proxy] ${req.method} ${req.url} -> ${BACKEND_URL}${req.url}`);
    if (req.readable === false && req.body !== undefined) {
      let payloadBuffer = null;

      if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
        payloadBuffer = req.rawBody;
      } else if (Buffer.isBuffer(req.body)) {
        payloadBuffer = req.body;
      } else {
        let serialized;
        if (req.body === null) {
          serialized = 'null';
        } else if (typeof req.body === 'string') {
          serialized = req.body;
        } else {
          serialized = JSON.stringify(req.body);
        }
        payloadBuffer = Buffer.from(serialized);
      }

      if (!proxyReq.getHeader('Content-Type')) {
        const reqContentType = req.headers['content-type'] || 'application/json';
        proxyReq.setHeader('Content-Type', reqContentType);
      }

      proxyReq.setHeader('Content-Length', Buffer.byteLength(payloadBuffer));
      proxyReq.write(payloadBuffer);
      proxyReq.end();
    }
  },
  onError: (err, req, res) => {
    console.error(`[proxy] Error: ${err.message}`);
    res.status(502).json({ error: 'Backend proxy error', message: err.message });
  }
}));

app.use(express.static(path.join(__dirname, 'visual-only')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'visual-only', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[server] Serving static files from: ${path.join(__dirname, 'visual-only')}`);
  console.log(`[server] Proxying /api/* to: ${BACKEND_URL}`);
});

// Initialize optional resources, then log ready
setupManualDataStore().catch((e) => {
  console.error('[manual-data] initialization failed:', e.message);
});

async function cleanupAndExit(signal) {
  try {
    console.log(`[server] Received ${signal}, cleaning up...`);
    if (manualStore && typeof manualStore.close === 'function') {
      await manualStore.close();
      console.log('[manual-data] store closed');
    }
    if (manualFields && typeof manualFields.close === 'function') {
      await manualFields.close();
      console.log('[manual-data] fields store closed');
    }
  } catch (e) {
    console.error('[server] error during cleanup', e);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => cleanupAndExit('SIGINT'));
process.on('SIGTERM', () => cleanupAndExit('SIGTERM'));
