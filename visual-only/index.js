window.FEATURE_USE_BACKEND = false;
window.TEST_BEARER_TOKEN = undefined;
const TELLER_APPLICATION_ID = 'app_pjnkt3k3flo2jacqo2000';
console.log('[UI] build:', new Date().toISOString());

// BackendAdapter - handles data fetching with fallback to mock data
const BackendAdapter = (() => {
  const state = {
    apiBaseUrl: "/api",
    bearerToken: undefined,
  };

  function isBackendEnabled() {
    return Boolean(window.FEATURE_USE_BACKEND);
  }

  async function loadConfig() {
    try {
      if (typeof location !== 'undefined' && location.protocol === 'file:') {
        return { enabled: Boolean(window.FEATURE_USE_BACKEND), apiBaseUrl: state.apiBaseUrl };
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
      }
    } catch {}
    return { enabled: Boolean(window.FEATURE_USE_BACKEND), apiBaseUrl: state.apiBaseUrl };
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
    } catch {
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
    } catch {
      return MOCK_BALANCES[accountId];
    }
  }

  async function fetchManualData(accountId) {
    if (!isBackendEnabled()) return MOCK_MANUAL_DATA[accountId] || { account_id: accountId, rent_roll: null, updated_at: null };
    try {
      const resp = await fetch(`${state.apiBaseUrl}/db/accounts/${encodeURIComponent(accountId)}/manual-data`, { headers: headers() });
      if (!resp.ok) return { account_id: accountId, rent_roll: null, updated_at: null };
      return await resp.json();
    } catch {
      return { account_id: accountId, rent_roll: null, updated_at: null };
    }
  }

  return {
    loadConfig,
    isBackendEnabled,
    setBearerToken,
    fetchAccounts,
    fetchCachedBalance,
    fetchManualData
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

async function boot() {
  try {
    await BackendAdapter.loadConfig();
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  
  setupConnectButton();
  
  if (document.readyState !== 'loading') {
    await init();
    setupRefreshButton();
  } else {
    document.addEventListener('DOMContentLoaded', async () => {
      await init();
      setupRefreshButton();
    });
  }
}

boot();

// Lazy-load Teller Connect SDK if missing
async function ensureTellerScriptLoaded() {
  if (window.TellerConnect || (window.teller && window.teller.connect)) return true;
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
    onSuccess: async ({ accessToken }) => {
      try {
        const resp = await fetch('/api/connect/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ access_token: accessToken })
        });
        if (resp && resp.ok) {
          const data = await resp.json().catch(() => ({}));
          const bearer = data.access_token || data.token || accessToken;
          BackendAdapter.setBearerToken(bearer);
          window.FEATURE_USE_BACKEND = true;
          showToast('Connected. Reloading...');
          setTimeout(() => location.reload(), 300);
          return;
        }
      } catch (_) {}
      window.TEST_BEARER_TOKEN = accessToken;
      window.FEATURE_USE_BACKEND = true;
      showToast('Connected (direct token). Reloading...');
      setTimeout(() => location.reload(), 300);
    },
    onExit: () => {
      showToast('Connect closed');
    }
  });
  return __connectInstance;
}

function resolveTellerCreate() {
  try {
    if (window.TellerConnect && typeof window.TellerConnect.create === 'function') return window.TellerConnect.create;
    if (typeof window.TellerConnect === 'function') return window.TellerConnect;
    if (window.teller && window.teller.connect && typeof window.teller.connect.create === 'function') return window.teller.connect.create;
    if (window.teller && typeof window.teller.connect === 'function') return window.teller.connect;
  } catch (_) {}
  return null;
}

function setupConnectButton() {
  const btn = document.getElementById('connect-btn');
  if (!btn) return;
  
  if (!window.TellerConnect) {
    btn.disabled = true;
    btn.title = 'Teller Connect SDK not loaded';
    return;
  }
  const connect = getConnectInstance();
  btn.addEventListener('click', () => connect.open());
}
