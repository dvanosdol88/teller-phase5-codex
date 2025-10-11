const BackendAdapter = (() => {
  const state = {
    apiBaseUrl: "/api",
    bearerToken: undefined,
  };

  function isBackendEnabled() {
    return Boolean(window.FEATURE_USE_BACKEND);
  }

  async function loadConfig() {
    return { enabled: false, apiBaseUrl: state.apiBaseUrl };
  }

  function headers() {
    const h = { "Accept": "application/json" };
    const token = window.TEST_BEARER_TOKEN || state.bearerToken;
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  async function fetchAccounts() {
    if (!isBackendEnabled()) return MOCK_ACCOUNTS;
    try {
      const resp = await fetch(`${state.apiBaseUrl}/db/accounts`, { headers: headers() });
      if (!resp.ok) throw new Error("accounts failed");
      const data = await resp.json();
      return (data.accounts || []).map(a => ({
        id: a.id, name: a.name, institution: a.institution, last_four: a.last_four, currency: a.currency
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

  async function fetchCachedTransactions(accountId, limit = 10) {
    if (!isBackendEnabled()) return (MOCK_TRANSACTIONS[accountId] || []);
    try {
      const url = `${state.apiBaseUrl}/db/accounts/${encodeURIComponent(accountId)}/transactions?limit=${limit}`;
      const resp = await fetch(url, { headers: headers() });
      if (!resp.ok) throw new Error("transactions failed");
      const data = await resp.json();
      return data.transactions || [];
    } catch {
      return (MOCK_TRANSACTIONS[accountId] || []);
    }
  }

  async function refreshLive(accountId, count = 10) {
    if (!isBackendEnabled()) return { balance: MOCK_BALANCES[accountId], transactions: (MOCK_TRANSACTIONS[accountId] || []) };
    try {
      const [bResp, tResp] = await Promise.all([
        fetch(`${state.apiBaseUrl}/accounts/${encodeURIComponent(accountId)}/balances`, { headers: headers() }),
        fetch(`${state.apiBaseUrl}/accounts/${encodeURIComponent(accountId)}/transactions?count=${count}`, { headers: headers() }),
      ]);
      if (!bResp.ok || !tResp.ok) throw new Error("live refresh failed");
      const balance = await bResp.json();
      const txsData = await tResp.json();
      return { balance, transactions: txsData.transactions || [] };
    } catch {
      return { balance: MOCK_BALANCES[accountId], transactions: (MOCK_TRANSACTIONS[accountId] || []) };
    }
  }

  return { loadConfig, isBackendEnabled, fetchAccounts, fetchCachedBalance, fetchCachedTransactions, refreshLive };
})();
const MOCK_ACCOUNTS = [
  { id: 'acc_checking', name: 'Checking', institution: 'Demo Bank', last_four: '1234', currency: 'USD' },
  { id: 'acc_savings', name: 'Savings', institution: 'Demo Bank', last_four: '9876', currency: 'USD' }
];

const MOCK_BALANCES = {
  acc_checking: { available: 1250.25, ledger: 1300.25, currency: 'USD', cached_at: new Date().toISOString() },
  acc_savings: { available: 8200.00, ledger: 8200.00, currency: 'USD', cached_at: new Date().toISOString() }
};

const MOCK_TRANSACTIONS = {
  acc_checking: [
    { description: 'Coffee Shop', amount: -3.75, date: '2025-10-08' },
    { description: 'Payroll', amount: 2500.00, date: '2025-10-01' },
  ],
  acc_savings: []
};

function showToast(message) {
  const el = document.getElementById('toast');
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

function formatAmount(value, currency = 'USD') {
  const s = formatCurrency(value, currency);
  if (typeof value === 'number' && value < 0) return s;
  return s;
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return `${ts}`;
  }
}

function renderCard(account) {
  const template = document.getElementById('account-card-template');
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.accountId = account.id;

  node.querySelectorAll('.flip-btn').forEach(btn => {
    btn.addEventListener('click', () => node.classList.toggle('is-flipped'));
  });

  node.querySelectorAll('.account-name').forEach(el => el.textContent = account.name || 'Account');
  const subtitle = [account.institution, account.last_four ? `•••• ${account.last_four}` : null].filter(Boolean).join(' · ');
  node.querySelectorAll('.account-subtitle').forEach(el => el.textContent = subtitle);

  const bal = MOCK_BALANCES[account.id] || {};
  node.querySelector('.balance-available').textContent = formatCurrency(bal.available, account.currency);
  node.querySelector('.balance-ledger').textContent = formatCurrency(bal.ledger, account.currency);
  node.querySelector('.balance-cached').textContent = `Cached: ${formatTimestamp(bal.cached_at)}`;

  const list = node.querySelector('.transactions-list');
  list.innerHTML = '';
  const txs = (MOCK_TRANSACTIONS[account.id] || []);
  if (!txs.length) {
    node.querySelector('.transactions-empty').classList.remove('hidden');
  } else {
    node.querySelector('.transactions-empty').classList.add('hidden');
    txs.forEach(tx => {
      const li = document.createElement('li');
      const details = document.createElement('div');
      details.className = 'details';
      const description = document.createElement('span');
      description.className = 'description';
      description.textContent = tx.description || 'Transaction';
      const date = document.createElement('span');
      date.className = 'date';
      date.textContent = tx.date ? new Date(tx.date).toLocaleDateString() : '';
      details.append(description, date);
      const amount = document.createElement('span');
      amount.className = 'amount';
      amount.textContent = formatAmount(tx.amount, account.currency);
      li.append(details, amount);
      list.appendChild(li);
    });
  }
  node.querySelector('.transactions-cached').textContent = `Cached: ${formatTimestamp(bal.cached_at)}`;

  const refreshBtn = node.querySelector('.refresh-btn');
  refreshBtn.addEventListener('click', () => showToast('Demo: no live refresh in visual-only mode'));

  return node;
}

function init() {
  const grid = document.getElementById('accounts-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '';

  if (!MOCK_ACCOUNTS.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  MOCK_ACCOUNTS.forEach(acc => grid.appendChild(renderCard(acc)));
}

document.addEventListener('DOMContentLoaded', init);
