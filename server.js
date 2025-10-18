const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'https://teller10-15a.onrender.com';

const FALLBACK_CONFIG = {
  apiBaseUrl: '/api',
  FEATURE_USE_BACKEND: true,
  FEATURE_MANUAL_DATA: false
};

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

app.get('/api/config', async (req, res) => {
  try {
    const backendConfig = await fetchBackendConfig();
    res.json(backendConfig);
  } catch (error) {
    console.error(`[config] Falling back to static defaults: ${error.message}`);
    res.json({ ...FALLBACK_CONFIG });
  }
});

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
