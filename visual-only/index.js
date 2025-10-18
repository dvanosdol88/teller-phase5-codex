window.FEATURE_USE_BACKEND = false;
window.TEST_BEARER_TOKEN = undefined;
window.FEATURE_MANUAL_DATA = false;
window.__manualDataBound = false;
const TELLER_APPLICATION_ID = 'app_pjnkt3k3flo2jacqo2000';
console.log('[UI] build:', new Date().toISOString());

// BackendAdapter - handles data fetching with fallback to mock data
const BackendAdapter = (() => {
  const DIAGNOSTICS_STORAGE_KEY = 'backend_diagnostics_v1';

  function loadStoredDiagnostics() {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(DIAGNOSTICS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(-20);
      }
    } catch (err) {
      console.warn('[BackendAdapter] Failed to read diagnostics cache:', err);
    }
    return [];
  }

  const state = {
    apiBaseUrl: "/api",
    bearerToken: undefined,
    diagnostics: loadStoredDiagnostics(),
  };

  function persistDiagnostics() {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(state.diagnostics.slice(-20)));
    } catch (err) {
      console.warn('[BackendAdapter] Failed to persist diagnostics cache:', err);
    }
  }

  function emitDiagnosticsUpdate(entry) {
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('backend:diagnostic', { detail: entry }));
      }
    } catch (err) {
      console.warn('[BackendAdapter] Failed to emit diagnostics event:', err);
    }
  }

  function recordDiagnostic(endpoint, error) {
    const entry = {
      endpoint,
      message: (error && error.message) || String(error) || 'Unknown error',
      timestamp: new Date().toISOString(),
    };
    state.diagnostics.push(entry);
    state.diagnostics = state.diagnostics.slice(-20);
    persistDiagnostics();
    console.warn('[BackendAdapter] Falling back to mock data:', entry);
    emitDiagnosticsUpdate(entry);
  }

  function clearDiagnostics() {
    state.diagnostics = [];
    persistDiagnostics();
    emitDiagnosticsUpdate(undefined);
  }

  function getDiagnostics() {
    return state.diagnostics.slice();
  }

  function isBackendEnabled() {
    return Boolean(window.FEATURE_USE_BACKEND);
  }

  async function loadConfig() {
    try {
      if (typeof location !== 'undefined' && location.protocol === 'file:') {
        return {
          enabled: Boolean(window.FEATURE_USE_BACKEND),
          manualDataEnabled: Boolean(window.FEATURE_MANUAL_DATA),
          apiBaseUrl: state.apiBaseUrl
        };
      }
      const resp = await fetch('/api/config', { headers: { Accept: 'application/json' } });
      if (resp && resp.ok) {
        const cfg = await resp.json().catch(() => ({}));
        if (cfg && typeof cfg.apiBaseUrl === 'string' && cfg.apiBaseUrl.trim()) {
          state.apiBaseUrl = cfg.apiBaseUrl;
        }
        if (cfg && typeof cfg.FEATURE_USE_BACKEND === 'boolean') {
          window.FEATURE_USE_BACKEND = cfg.FEATURE_USE_BACKEND;
        }
        if (cfg && typeof cfg.FEATURE_MANUAL_DATA === 'boolean') {
          window.FEATURE_MANUAL_DATA = cfg.FEATURE_MANUAL_DATA;
        } else {
          window.FEATURE_MANUAL_DATA = false;
        }
      }
    } catch (err) {
      recordDiagnostic('GET /api/config', err);
    }
    return {
      enabled: Boolean(window.FEATURE_USE_BACKEND),
      manualDataEnabled: Boolean(window.FEATURE_MANUAL_DATA),
      apiBaseUrl: state.apiBaseUrl
    };
  }

  function headers() {
    const h = { "Accept": "application/json" };
    const token = window.TEST_BEARER_TOKEN || state.bearerToken;
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  function setBearerToken(token) {
    state.bearerToken = token;
    console.log('[BackendAdapter] Bearer token set');
  }

  async function fetchAccounts() {
    if (!isBackendEnabled()) return MOCK_ACCOUNTS;
    try {
      const resp = await fetch(`${state.apiBaseUrl}/db/accounts`, { headers: headers() });
      if (!resp.ok) throw new Error("accounts failed");
      const data = await resp.json();
      return (data.accounts || []).map(a => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        last_four: a.last_four,
        currency: a.currency,
        type: a.type,
        subtype: a.subtype
      }));
    } catch (err) {
      recordDiagnostic('GET /db/accounts', err);
      return MOCK_ACCOUNTS;
    }
  }

  async function fetchCachedBalance(accountId) {
    if (!isBackendEnabled()) return MOCK_BALANCES[accountId];
    try {
      const resp = await fetch(`${state.apiBaseUrl}/db/accounts/${encodeURIComponent(accountId)}/balances`, { headers: headers() });
      if (!resp.ok) throw new Error("balance failed");
      const data = await resp.json();
      return { ...data.balance, cached_at: data.cached_at };
    } catch (err) {
      recordDiagnostic(`GET /db/accounts/${accountId}/balances`, err);
      return MOCK_BALANCES[accountId];
    }
  }

  async function fetchManualData(accountId) {
    if (!isBackendEnabled()) return MOCK_MANUAL_DATA[accountId] || { account_id: accountId, rent_roll: null, updated_at: null };
    try {
      const resp = await fetch(`${state.apiBaseUrl}/db/accounts/${encodeURIComponent(accountId)}/manual-data`, { headers: headers() });
      if (!resp.ok) {
        recordDiagnostic(`GET /db/accounts/${accountId}/manual-data`, new Error(`manual data request failed with status ${resp.status}`));
        return { account_id: accountId, rent_roll: null, updated_at: null };
      }
      return await resp.json();
    } catch (err) {
      recordDiagnostic(`GET /db/accounts/${accountId}/manual-data`, err);
      return { account_id: accountId, rent_roll: null, updated_at: null };
    }
  }

  return {
    loadConfig,
    isBackendEnabled,
    setBearerToken,
    fetchAccounts,
    fetchCachedBalance,
    fetchManualData,
    getDiagnostics,
    clearDiagnostics
  };
})();

const MOCK_ACCOUNTS = [
  { id: 'acc_llc_checking', name: 'LLC Checking', institution: 'Demo Bank', last_four: '1234', currency: 'USD', type: 'depository', subtype: 'checking' },
  { id: 'acc_llc_savings', name: 'LLC Savings', institution: 'Demo Bank', last_four: '5678', currency: 'USD', type: 'depository', subtype: 'savings' },
  { id: 'acc_llc_credit', name: 'LLC Credit Card', institution: 'Demo Bank', last_four: '9012', currency: 'USD', type: 'credit', subtype: 'credit_card' },
  { id: 'juliePersonalFinances', name: 'Julie Personal', institution: 'Demo Bank', last_four: '3456', currency: 'USD', type: 'depository', subtype: 'checking' },
  { id: 'davidPersonalFinances', name: 'David Personal', institution: 'Demo Bank', last_four: '7890', currency: 'USD', type: 'depository', subtype: 'checking' },
  { id: 'heloc', name: 'HELOC', institution: 'Demo Bank', last_four: '2468', currency: 'USD', type: 'credit', subtype: 'line_of_credit' }
];

const MOCK_BALANCES = {
  acc_llc_checking: { available: 15000.00, ledger: 15000.00, currency: 'USD', cached_at: new Date().toISOString() },
  acc_llc_savings: { available: 45000.00, ledger: 45000.00, currency: 'USD', cached_at: new Date().toISOString() },
  acc_llc_credit: { available: -8500.00, ledger: -8500.00, currency: 'USD', cached_at: new Date().toISOString() },
  juliePersonalFinances: { available: 3200.00, ledger: 3200.00, currency: 'USD', cached_at: new Date().toISOString() },
  davidPersonalFinances: { available: 4800.00, ledger: 4800.00, currency: 'USD', cached_at: new Date().toISOString() },
  heloc: { available: -25000.00, ledger: -25000.00, currency: 'USD', cached_at: new Date().toISOString() }
};

const MOCK_MANUAL_DATA = {
  acc_llc_checking: { account_id: 'acc_llc_checking', rent_roll: 2400.00, updated_at: new Date().toISOString() },
  acc_llc_savings: { account_id: 'acc_llc_savings', rent_roll: null, updated_at: null }
};

function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message || '';
  el.classList.remove('hidden');
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.classList.add('hidden'), 2200);
}

function ensureManualDataBinder() {
  if (!window.FEATURE_MANUAL_DATA || window.__manualDataBound) return;

  const candidates = [
    window.bindManualDataUI,
    window.bindManualData,
    window.__manualDataBinder
  ];

  let binder = null;
  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      binder = candidate;
      break;
    }
  }

  if (!binder) return;

  const executeBinder = () => {
    try {
      binder();
      window.__manualDataBound = true;
    } catch (err) {
      window.__manualDataBound = false;
      console.error('[ManualData] Failed to initialize manual data UI:', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeBinder, { once: true });
  } else {
    executeBinder();
  }
}

window.__ensureManualDataBinder = ensureManualDataBinder;

let diagnosticsToastCooldown = 0;
let diagnosticsBannerInitialized = false;

function setupDiagnosticsBanner() {
  if (diagnosticsBannerInitialized) return;

  const banner = document.getElementById('diagnostics-banner');
  const detailEl = document.getElementById('diagnostics-detail');
  const timestampEl = document.getElementById('diagnostics-timestamp');
  const dismissBtn = document.getElementById('diagnostics-dismiss');

  if (!banner || !detailEl) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupDiagnosticsBanner, { once: true });
    }
    return;
  }

  diagnosticsBannerInitialized = true;

  function renderDiagnosticsBanner() {
    const diagnostics = BackendAdapter.getDiagnostics();
    if (!diagnostics || diagnostics.length === 0) {
      banner.classList.add('hidden');
      if (detailEl) detailEl.textContent = '';
      if (timestampEl) timestampEl.textContent = '';
      return;
    }

    const latest = diagnostics[diagnostics.length - 1];
    banner.classList.remove('hidden');
    detailEl.textContent = `${latest.endpoint}: ${latest.message}`;
    if (timestampEl) {
      try {
        const when = new Date(latest.timestamp);
        timestampEl.textContent = `Last fallback at ${when.toLocaleString()}`;
      } catch {
        timestampEl.textContent = latest.timestamp ? `Last fallback at ${latest.timestamp}` : '';
      }
    }
  }

  renderDiagnosticsBanner();

  window.addEventListener('backend:diagnostic', (event) => {
    renderDiagnosticsBanner();
    if (event && event.detail) {
      const now = Date.now();
      if (now - diagnosticsToastCooldown > 4000) {
        diagnosticsToastCooldown = now;
        showToast('Using cached demo data (backend unavailable)');
      }
    }
  });

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      BackendAdapter.clearDiagnostics();
      renderDiagnosticsBanner();
    });
  }
}

function formatCurrency(value, currency = 'USD') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value));
  } catch {
    return `${value}`;
  }
}

function categorizeAccount(account) {
  const id = account.id.toLowerCase();
  
  if (id.includes('julie') || id.includes('david')) {
    return 'personal';
  }
  
  if (id.includes('heloc')) {
    return 'heloc';
  }
  
  if (account.type === 'depository') {
    return 'asset';
  }
  
  if (account.type === 'credit') {
    return 'liability';
  }
  
  return 'other';
}

async function renderAccountCard(account) {
  const balance = await BackendAdapter.fetchCachedBalance(account.id);
  const balanceValue = balance?.available ?? 0;
  
  const card = document.createElement('div');
  card.className = 'bg-slate-50 p-4 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer';
  card.dataset.accountId = account.id;
  
  const nameEl = document.createElement('h5');
  nameEl.className = 'font-semibold text-slate-800 mb-1';
  nameEl.textContent = account.name || 'Account';
  
  const balanceEl = document.createElement('p');
  balanceEl.className = 'text-lg font-bold text-slate-900';
  balanceEl.textContent = formatCurrency(balanceValue, account.currency);
  
  const subtitleParts = [];
  if (account.institution) subtitleParts.push(account.institution);
  if (account.last_four) subtitleParts.push(`•••• ${account.last_four}`);
  
  if (subtitleParts.length > 0) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'text-xs text-slate-500 mt-1';
    subtitleEl.textContent = subtitleParts.join(' · ');
    card.append(nameEl, balanceEl, subtitleEl);
  } else {
    card.append(nameEl, balanceEl);
  }
  
  return { card, balance: balanceValue };
}

async function calculateRentRoll(accounts) {
  let total = 0;
  for (const account of accounts) {
    const manualData = await BackendAdapter.fetchManualData(account.id);
    if (manualData.rent_roll !== null && manualData.rent_roll !== undefined) {
      total += Number(manualData.rent_roll);
    }
  }
  return total;
}

async function init() {
  const assetsContainer = document.getElementById('assets-container');
  const liabilitiesContainer = document.getElementById('liabilities-container');
  const rentRollValue = document.getElementById('rent-roll-total');
  const totalEquityValue = document.getElementById('total-equity-balance');
  
  if (!assetsContainer || !liabilitiesContainer) {
    console.error('Required containers not found');
    return;
  }
  
  assetsContainer.innerHTML = '';
  liabilitiesContainer.innerHTML = '';
  
  const accounts = await BackendAdapter.fetchAccounts();
  
  let totalAssets = 0;
  let totalLiabilities = 0;
  
  for (const account of accounts) {
    const category = categorizeAccount(account);
    
    if (category === 'personal' || category === 'heloc') {
      continue;
    }
    
    const { card, balance } = await renderAccountCard(account);
    
    if (category === 'asset') {
      assetsContainer.appendChild(card);
      totalAssets += balance;
    } else if (category === 'liability') {
      liabilitiesContainer.appendChild(card);
      totalLiabilities += Math.abs(balance);
    }
  }
  
  const rentRoll = await calculateRentRoll(accounts);
  if (rentRollValue) {
    rentRollValue.textContent = formatCurrency(rentRoll);
  }
  
  const totalEquity = totalAssets - totalLiabilities;
  if (totalEquityValue) {
    totalEquityValue.textContent = formatCurrency(totalEquity);
  }
  
  showToast('Dashboard loaded');
}

function setupRefreshButton() {
  const refreshBtn = document.getElementById('refresh-data-btn');
  const connectBankBtn = document.getElementById('connect-bank');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        await ensureTellerScriptLoaded();
        const connect = getConnectInstance();
        if (connect && typeof connect.open === 'function') {
          connect.open();
          return;
        }
      } catch (e) {
        console.error('Connect open failed:', e);
      }
      // Fallback: just refresh the dashboard data
      showToast('Refreshing data...');
      await init();
    });
  }
  if (connectBankBtn) {
    connectBankBtn.addEventListener('click', async () => {
      try {
        await ensureTellerScriptLoaded();
        const connect = getConnectInstance();
        if (connect && typeof connect.open === 'function') {
          connect.open();
          return;
        }
      } catch (e) {
        console.error('Connect open failed:', e);
      }
      showToast('Unable to open Connect');
    });
  }
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  
  if (!themeToggle || !themeIcon) return;
  
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.textContent = '☀️';
  }
  
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

async function boot() {
  const savedToken = localStorage.getItem('teller_access_token');
  if (savedToken) {
    window.TEST_BEARER_TOKEN = savedToken;
    BackendAdapter.setBearerToken(savedToken);
    window.FEATURE_USE_BACKEND = true;
    console.log('Loaded saved Teller token');
  }
  
  try {
    await BackendAdapter.loadConfig();
  } catch (err) {
    console.error('Failed to load config:', err);
  }

  ensureManualDataBinder();

  await setupConnectButton();

  setupDiagnosticsBanner();
  ensureManualDataBinder();

  if (document.readyState !== 'loading') {
    setupDiagnosticsBanner();
    ensureManualDataBinder();
    await init();
    setupRefreshButton();
    setupThemeToggle();
  } else {
    document.addEventListener('DOMContentLoaded', async () => {
      setupDiagnosticsBanner();
      ensureManualDataBinder();
      await init();
      setupRefreshButton();
      setupThemeToggle();
    });
  }
}

boot();

// Lazy-load Teller Connect SDK if missing
async function ensureTellerScriptLoaded() {
  if (window.TellerConnect || (window.teller && window.teller.connect)) return true;
  
  const existingScript = document.querySelector('script[src*="teller.io/connect"]');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Teller SDK load timeout')), 10000);
      const checkLoaded = setInterval(() => {
        if (window.TellerConnect || (window.teller && window.teller.connect)) {
          clearInterval(checkLoaded);
          clearTimeout(timeout);
          resolve(true);
        }
      }, 100);
    });
  }
  
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.teller.io/connect/connect.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return Boolean(window.TellerConnect || (window.teller && window.teller.connect));
}

let __connectInstance;
function getConnectInstance() {
  if (__connectInstance) return __connectInstance;
  const create = resolveTellerCreate();
  if (!create) throw new Error('Teller Connect SDK not available or unsupported shape');
  __connectInstance = create({
    applicationId: TELLER_APPLICATION_ID,
    institution: 'td_bank',
    onSuccess: async (enrollment) => {
      const accessToken = enrollment.accessToken;
      localStorage.setItem('teller_access_token', accessToken);
      window.TEST_BEARER_TOKEN = accessToken;
      BackendAdapter.setBearerToken(accessToken);
      window.FEATURE_USE_BACKEND = true;
      
      try {
        const resp = await fetch('/api/enrollments', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Accept': 'application/json'
          },
          body: JSON.stringify({ enrollment })
        });
        if (resp && resp.ok) {
          const data = await resp.json().catch(() => ({}));
          console.log('Enrollment posted to backend successfully', data);
        } else {
          console.error('Failed to post enrollment:', resp.status, resp.statusText);
        }
      } catch (e) {
        console.error('Backend enrollment endpoint error:', e);
      }
      
      showToast('Connected. Reloading...');
      setTimeout(() => location.reload(), 300);
    },
    onExit: () => {
      console.log('Teller Connect widget closed by user');
      showToast('Connection cancelled');
    }
  });
  return __connectInstance;
}

function resolveTellerCreate() {
  try {
    if (window.TellerConnect && typeof window.TellerConnect.setup === 'function') return window.TellerConnect.setup;
    if (window.TellerConnect && typeof window.TellerConnect.create === 'function') return window.TellerConnect.create;
    if (typeof window.TellerConnect === 'function') return window.TellerConnect;
    if (window.teller && window.teller.connect && typeof window.teller.connect.setup === 'function') return window.teller.connect.setup;
    if (window.teller && window.teller.connect && typeof window.teller.connect.create === 'function') return window.teller.connect.create;
    if (window.teller && typeof window.teller.connect === 'function') return window.teller.connect;
  } catch (_) {}
  return null;
}

async function setupConnectButton() {
  const btn = document.getElementById('connect-btn');
  if (!btn) return;
  
  try {
    await ensureTellerScriptLoaded();
    const connect = getConnectInstance();
    btn.disabled = false;
    btn.addEventListener('click', () => connect.open());
  } catch (e) {
    console.error('Failed to setup Teller Connect:', e);
    btn.disabled = true;
    btn.title = 'Teller Connect SDK not available';
  }
}
