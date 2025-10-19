const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { getAccounts, getAccountById, getBalanceByAccountId, getTransactionsByAccountId } = require('./lib/dataStore');
const { ManualDataStore } = require('./lib/manualDataStore');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'https://teller10-15a.onrender.com';

const FALLBACK_CONFIG = {
  apiBaseUrl: '/api',
  FEATURE_USE_BACKEND: true,
  FEATURE_MANUAL_DATA: true
};

const manualDataStore = new ManualDataStore();

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

apiRouter.get('/db/accounts/:accountId/manual-data', async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = getAccountById(accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const payload = await manualDataStore.get(accountId, account.currency);
    res.json(payload);
  } catch (error) {
    console.error(`[manual-data] Failed to read manual data for ${req.params.accountId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to read manual data' });
  }
});

apiRouter.put('/db/accounts/:accountId/manual-data', async (req, res) => {
  const { accountId } = req.params;
  const account = getAccountById(accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  if (!Object.prototype.hasOwnProperty.call(body, 'rent_roll')) {
    res.status(400).json({ error: 'rent_roll is required (use null to clear)' });
    return;
  }

  const { rent_roll: rentRoll } = body;

  if (rentRoll === null) {
    try {
      const cleared = await manualDataStore.clear(accountId, account.currency);
      res.json(cleared);
    } catch (error) {
      console.error(`[manual-data] Failed to clear manual data for ${accountId}: ${error.message}`);
      res.status(500).json({ error: 'Failed to clear manual data' });
    }
    return;
  }

  if (typeof rentRoll === 'string' && rentRoll.trim() === '') {
    res.status(400).json({ error: 'rent_roll must be a non-empty numeric value or null' });
    return;
  }

  const numeric = Number(rentRoll);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric) || numeric < 0) {
    res.status(400).json({ error: 'rent_roll must be a non-negative number or null' });
    return;
  }

  try {
    const record = await manualDataStore.set(accountId, numeric, account.currency);
    res.json(record);
  } catch (error) {
    console.error(`[manual-data] Failed to persist manual data for ${accountId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to persist manual data' });
  }
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
