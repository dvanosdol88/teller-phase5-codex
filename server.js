const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { getAccounts, getAccountById, getBalanceByAccountId, getTransactionsByAccountId } = require('./lib/dataStore');
const { PgManualDataStore } = require('./lib/pgManualDataStore');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'https://teller10-15a.onrender.com';
const FEATURE_MANUAL_DATA = String(process.env.FEATURE_MANUAL_DATA || '').toLowerCase() === 'true';
const MANUAL_DATA_READONLY = String(process.env.MANUAL_DATA_READONLY || '').toLowerCase() === 'true';
const MANUAL_DATA_DRY_RUN = String(process.env.MANUAL_DATA_DRY_RUN || '').toLowerCase() === 'true';
const DATABASE_URL = process.env.DATABASE_URL;

const FALLBACK_CONFIG = {
  apiBaseUrl: '/api',
  FEATURE_USE_BACKEND: true,
  FEATURE_MANUAL_DATA: true
};

// Manual data store (PostgreSQL)
let manualStore = null;

function validateConfigPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Config payload is not an object');
  }

  if (typeof payload.apiBaseUrl !== 'string' || payload.apiBaseUrl.trim() === '') {
    throw new Error('Config payload missing required apiBaseUrl string');
  }

  const sanitizedConfig = {
    ...FALLBACK_CONFIG,
    apiBaseUrl: payload.apiBaseUrl.trim()
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'FEATURE_USE_BACKEND')) {
    if (typeof payload.FEATURE_USE_BACKEND === 'boolean') {
      sanitizedConfig.FEATURE_USE_BACKEND = payload.FEATURE_USE_BACKEND;
    } else {
      console.warn('[config] Ignoring invalid FEATURE_USE_BACKEND value from backend payload');
    }
  }

  sanitizedConfig.FEATURE_MANUAL_DATA = true;

  if (Object.prototype.hasOwnProperty.call(payload, 'FEATURE_MANUAL_DATA')) {
    if (typeof payload.FEATURE_MANUAL_DATA === 'boolean') {
      sanitizedConfig.FEATURE_MANUAL_DATA = payload.FEATURE_MANUAL_DATA;
    } else {
      console.warn('[config] Ignoring invalid FEATURE_MANUAL_DATA value from backend payload');
    }
  }

  return sanitizedConfig;
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
if (FEATURE_MANUAL_DATA) {
  console.log(`[server] MANUAL_DATA_READONLY: ${MANUAL_DATA_READONLY}`);
  console.log(`[server] MANUAL_DATA_DRY_RUN: ${MANUAL_DATA_DRY_RUN}`);
}

// basic body parsing for JSON endpoints we may serve locally
app.use(express.json());

// Lightweight request id for tracing
app.use((req, res, next) => {
  const existing = req.headers['x-request-id'];
  const rid = existing || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  req.requestId = rid;
  res.setHeader('x-request-id', rid);
  next();
});

app.use(express.json({ limit: '1mb' }));

const apiRouter = express.Router();

apiRouter.get('/config', async (req, res) => {
  try {
    const backendConfig = await fetchBackendConfig();
    res.json({
      ...backendConfig,
      FEATURE_MANUAL_DATA: true
    });
  } catch (error) {
    console.error(`[config] Falling back to static defaults: ${error.message}`);
    res.json({ ...FALLBACK_CONFIG });
  }
});

apiRouter.get('/db/accounts', (req, res) => {
  const accounts = getAccounts();
  res.json({ accounts });
});

apiRouter.get('/db/accounts/:accountId/balances', (req, res) => {
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

apiRouter.get('/db/accounts/:accountId/transactions', (req, res) => {
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
}
// Manual data routes using PostgreSQL store
apiRouter.get('/db/accounts/:accountId/manual-data', async (req, res) => {
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

apiRouter.put('/db/accounts/:accountId/manual-data', async (req, res) => {
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
apiRouter.get('/healthz', async (req, res) => {
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

app.use('/api', apiRouter);
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[proxy] ${req.method} ${req.url} -> ${BACKEND_URL}${req.url}`);
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
  } catch (e) {
    console.error('[server] error during cleanup', e);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => cleanupAndExit('SIGINT'));
process.on('SIGTERM', () => cleanupAndExit('SIGTERM'));
