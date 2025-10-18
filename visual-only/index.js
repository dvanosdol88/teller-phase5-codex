window.FEATURE_USE_BACKEND = false;
window.TEST_BEARER_TOKEN = undefined;
window.FEATURE_MANUAL_DATA = false;
window.__manualDataBound = false;

const accountRegistry = new Map();
const manualDataCache = new Map();
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

  async function fetchManualData(accountId, { signal } = {}) {
    if (!isBackendEnabled()) {
      const mock = MOCK_MANUAL_DATA[accountId] || { account_id: accountId, rent_roll: null, updated_at: null };
      updateManualDataCache(accountId, mock);
      return mock;
    }
    try {
      const resp = await fetch(`${state.apiBaseUrl}/db/accounts/${encodeURIComponent(accountId)}/manual-data`, {
        headers: headers(),
        signal
      });
      if (!resp.ok) {
        recordDiagnostic(`GET /db/accounts/${accountId}/manual-data`, new Error(`manual data request failed with status ${resp.status}`));
        const fallback = { account_id: accountId, rent_roll: null, updated_at: null };
        updateManualDataCache(accountId, fallback);
        return fallback;
      }
      const data = await resp.json();
      updateManualDataCache(accountId, data);
      return data;
    } catch (err) {
      recordDiagnostic(`GET /db/accounts/${accountId}/manual-data`, err);
      const fallback = { account_id: accountId, rent_roll: null, updated_at: null };
      updateManualDataCache(accountId, fallback);
      return fallback;
    }
  }

  async function updateManualData(accountId, body, { signal } = {}) {
    if (!isBackendEnabled()) {
      throw Object.assign(new Error('Backend not enabled'), { code: 'BACKEND_DISABLED' });
    }
    const payload = { rent_roll: body?.rent_roll ?? null };
    const requestInit = {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    };

    const endpoint = `${state.apiBaseUrl}/db/accounts/${encodeURIComponent(accountId)}/manual-data`;
    const resp = await fetch(endpoint, requestInit);
    const requestId = resp.headers?.get?.('x-request-id') || resp.headers?.get?.('X-Request-Id') || null;
    if (!resp.ok) {
      let detail;
      try {
        detail = await resp.json();
      } catch (_) {
        detail = undefined;
      }
      const error = new Error(detail?.message || `Failed to update manual data (status ${resp.status})`);
      error.status = resp.status;
      error.requestId = requestId;
      error.body = detail;
      throw error;
    }

    const data = await resp.json();
    updateManualDataCache(accountId, data);
    return { data, requestId };
  }

  return {
    loadConfig,
    isBackendEnabled,
    setBearerToken,
    fetchAccounts,
    fetchCachedBalance,
    fetchManualData,
    updateManualData,
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

function getManualDataFromCache(accountId) {
  if (!accountId) return undefined;
  return manualDataCache.get(accountId);
}

function updateManualDataCache(accountId, data, currency) {
  if (!accountId) return;
  if (!data) {
    manualDataCache.delete(accountId);
    return;
  }
  const normalized = {
    account_id: data.account_id || accountId,
    rent_roll: data.rent_roll != null && !Number.isNaN(Number(data.rent_roll)) ? Number(data.rent_roll) : null,
    updated_at: data.updated_at || null,
    currency: data.currency || currency || (manualDataCache.get(accountId)?.currency) || 'USD'
  };
  manualDataCache.set(accountId, normalized);
}

function clearManualDataCache() {
  manualDataCache.clear();
}

function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message || '';
  el.classList.remove('hidden');
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => el.classList.add('hidden'), 2200);
}

function formatRelativeTime(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  return date.toLocaleString();
}

function updateRentRollSummaryDisplay() {
  const rentRollValueEl = document.getElementById('rent-roll-total');
  if (!rentRollValueEl) return;
  let total = 0;
  let currency = 'USD';
  manualDataCache.forEach((entry) => {
    if (!entry) return;
    if (entry.currency) currency = entry.currency;
    if (entry.rent_roll != null && !Number.isNaN(Number(entry.rent_roll))) {
      total += Number(entry.rent_roll);
    }
  });
  rentRollValueEl.textContent = formatCurrency(total, currency);
}

const ManualDataUI = (() => {
  const state = {
    bound: false,
    accountModal: null,
    accountModalContent: null,
    accountModalOverlay: null,
    accountModalClose: null,
    accountModalTitle: null,
    accountModalSubtitle: null,
    accountModalTabs: null,
    accountModalTabContent: null,
    manualModal: null,
    manualModalContent: null,
    manualModalOverlay: null,
    manualModalClose: null,
    manualModalCancel: null,
    manualModalClear: null,
    manualModalSave: null,
    manualModalInput: null,
    manualModalError: null,
    manualModalSaving: false,
    manualModalEnterLock: false,
    activeAccount: null,
    activeTab: 'manual',
    loadController: null,
    saveController: null,
    tabButtons: {},
    manualDataEditButton: null,
  };

  function bind() {
    if (state.bound) return;
    cacheElements();
    if (!state.accountModal || !state.manualModal) {
      throw new Error('Manual data modals not found in DOM');
    }
    setupAccountModal();
    setupManualModal();
    attachAccountCardDelegates();
    state.bound = true;
  }

  function cacheElements() {
    state.accountModal = document.getElementById('account-modal');
    state.accountModalContent = state.accountModal?.querySelector('.modal-content');
    state.accountModalOverlay = state.accountModal?.querySelector('.modal-bg');
    state.accountModalClose = document.getElementById('close-modal-btn');
    state.accountModalTitle = document.getElementById('modal-title');
    state.accountModalSubtitle = document.getElementById('modal-subtitle');
    state.accountModalTabs = document.getElementById('modal-tabs');
    state.accountModalTabContent = document.getElementById('modal-tab-content');

    state.manualModal = document.getElementById('manual-data-modal');
    state.manualModalContent = state.manualModal?.querySelector('.modal-content');
    state.manualModalOverlay = state.manualModal?.querySelector('.modal-bg');
    state.manualModalClose = state.manualModal?.querySelector('.modal-close');
    state.manualModalCancel = state.manualModal?.querySelector('.modal-cancel');
    state.manualModalClear = state.manualModal?.querySelector('.modal-clear');
    state.manualModalSave = state.manualModal?.querySelector('.modal-save');
    state.manualModalInput = document.getElementById('rent-roll-input');

    if (state.manualModalInput && !state.manualModalError) {
      state.manualModalError = document.createElement('p');
      state.manualModalError.className = 'text-sm text-rose-600 mt-2 hidden';
      state.manualModalInput.insertAdjacentElement('afterend', state.manualModalError);
    }
  }

  function setupAccountModal() {
    if (!state.accountModal) return;
    const close = () => closeAccountModal();
    state.accountModalClose?.addEventListener('click', close);
    state.accountModalOverlay?.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.accountModal && !state.accountModal.classList.contains('hidden')) {
        closeAccountModal();
      }
    });
  }

  function setupManualModal() {
    if (!state.manualModal) return;
    state.manualModalClose?.addEventListener('click', () => closeManualDataModal());
    state.manualModalOverlay?.addEventListener('click', () => closeManualDataModal());
    state.manualModalCancel?.addEventListener('click', (event) => {
      event.preventDefault();
      closeManualDataModal();
    });
    state.manualModalClear?.addEventListener('click', handleManualDataClear);
    state.manualModalSave?.addEventListener('click', handleManualDataSave);
    if (state.manualModalInput) {
      state.manualModalInput.addEventListener('input', () => updateManualModalValidity());
      state.manualModalInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (state.manualModalEnterLock) return;
          state.manualModalEnterLock = true;
          window.setTimeout(() => { state.manualModalEnterLock = false; }, 250);
          handleManualDataSave();
        }
      });
    }
  }

  function attachAccountCardDelegates() {
    const containers = [document.getElementById('assets-container'), document.getElementById('liabilities-container')];
    containers.forEach((container) => {
      if (!container) return;
      container.addEventListener('click', (event) => {
        const card = event.target.closest('[data-account-id]');
        if (!card) return;
        const accountId = card.dataset.accountId;
        if (!accountId || !accountRegistry.has(accountId)) return;
        event.preventDefault();
        event.stopPropagation();
        openAccountModal(accountRegistry.get(accountId));
      });
    });
  }

  function openAccountModal(account) {
    if (!account) return;
    state.activeAccount = account;
    abortCurrentLoad();
    if (state.accountModalTitle) state.accountModalTitle.textContent = account.name || 'Account Details';
    if (state.accountModalSubtitle) {
      const subtitleParts = [];
      if (account.institution) subtitleParts.push(account.institution);
      if (account.last_four) subtitleParts.push(`•••• ${account.last_four}`);
      if (subtitleParts.length) {
        state.accountModalSubtitle.textContent = subtitleParts.join(' · ');
        state.accountModalSubtitle.classList.remove('hidden');
      } else {
        state.accountModalSubtitle.textContent = '';
        state.accountModalSubtitle.classList.add('hidden');
      }
    }

    renderAccountTabs(account);
    showModal(state.accountModal, state.accountModalContent);
  }

  function closeAccountModal() {
    abortCurrentLoad();
    state.activeAccount = null;
    closeManualDataModal();
    hideModal(state.accountModal, state.accountModalContent);
  }

  function renderAccountTabs(account) {
    if (!state.accountModalTabs || !state.accountModalTabContent) return;
    state.accountModalTabs.innerHTML = '';
    state.tabButtons = {};

    const transactionsTab = document.createElement('button');
    transactionsTab.type = 'button';
    transactionsTab.className = 'tab px-4 py-2 text-sm text-slate-500 hover:text-slate-700';
    transactionsTab.textContent = 'Transactions';
    transactionsTab.addEventListener('click', () => selectTab('transactions'));

    const manualTab = document.createElement('button');
    manualTab.type = 'button';
    manualTab.className = 'tab px-4 py-2 text-sm text-slate-500 hover:text-slate-700';
    manualTab.textContent = 'Manual Data';
    manualTab.addEventListener('click', () => selectTab('manual'));

    state.tabButtons.transactions = transactionsTab;
    state.tabButtons.manual = manualTab;

    state.accountModalTabs.append(transactionsTab, manualTab);

    selectTab('manual', { account });
  }

  function selectTab(name, { account } = {}) {
    state.activeTab = name;
    Object.entries(state.tabButtons).forEach(([key, btn]) => {
      if (!btn) return;
      if (key === name) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const activeAccount = account || state.activeAccount;
    if (!activeAccount) return;

    if (name === 'manual') {
      renderManualDataTab(activeAccount);
    } else if (name === 'transactions') {
      renderTransactionsPlaceholder();
    }
  }

  function renderTransactionsPlaceholder() {
    if (!state.accountModalTabContent) return;
    state.accountModalTabContent.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'p-6 text-center text-slate-500';
    placeholder.textContent = 'Transactions view coming soon.';
    state.accountModalTabContent.appendChild(placeholder);
  }

  function renderManualDataTab(account) {
    if (!state.accountModalTabContent) return;
    const cached = getManualDataFromCache(account.id);
    if (cached) {
      renderManualDataContent(account, { status: 'ready', data: cached });
      loadManualData(account, { showLoading: false });
    } else {
      renderManualDataContent(account, { status: 'loading' });
      loadManualData(account, { showLoading: true });
    }
  }

  function renderManualDataContent(account, payload) {
    if (!state.accountModalTabContent) return;
    state.accountModalTabContent.innerHTML = '';
    state.manualDataEditButton = null;

    const container = document.createElement('div');
    container.className = 'space-y-6';

    if (payload.status === 'loading') {
      const spinnerWrapper = document.createElement('div');
      spinnerWrapper.className = 'flex items-center justify-center py-8';
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinnerWrapper.appendChild(spinner);
      container.appendChild(spinnerWrapper);
      state.accountModalTabContent.appendChild(container);
      return;
    }

    if (payload.status === 'error') {
      const errorBox = document.createElement('div');
      errorBox.className = 'bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg';
      const message = document.createElement('p');
      message.className = 'font-medium';
      message.textContent = payload.error?.message || 'Unable to load manual data.';
      errorBox.appendChild(message);
      if (payload.error?.requestId) {
        const requestIdEl = document.createElement('p');
        requestIdEl.className = 'text-xs text-rose-500 mt-1';
        requestIdEl.textContent = `Request ID: ${payload.error.requestId}`;
        errorBox.appendChild(requestIdEl);
      }
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'mt-4 bg-rose-600 text-white px-4 py-2 rounded-md hover:bg-rose-700 transition-colors';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => loadManualData(account, { showLoading: true }));
      errorBox.appendChild(retryBtn);
      container.appendChild(errorBox);
      state.accountModalTabContent.appendChild(container);
      return;
    }

    const data = payload.data || {};
    const currency = data.currency || account.currency || 'USD';
    const rentRollValue = data.rent_roll != null && !Number.isNaN(Number(data.rent_roll)) ? Number(data.rent_roll) : null;
    const rentRollDisplay = formatCurrency(rentRollValue, currency);
    const updatedDisplay = formatRelativeTime(data.updated_at);
    const annualRent = rentRollValue != null ? rentRollValue * 12 : null;

    const headerRow = document.createElement('div');
    headerRow.className = 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4';

    const valueBlock = document.createElement('div');
    valueBlock.className = 'space-y-1';
    const rentLabel = document.createElement('p');
    rentLabel.className = 'text-sm font-medium text-slate-600 uppercase tracking-wide';
    rentLabel.textContent = 'Rent Roll';
    const rentValueEl = document.createElement('p');
    rentValueEl.className = 'text-2xl font-bold text-slate-900';
    rentValueEl.textContent = rentRollDisplay;
    rentValueEl.dataset.role = 'manual-data-rent-roll';
    const updatedEl = document.createElement('p');
    updatedEl.className = 'text-xs text-slate-500';
    updatedEl.textContent = `Last updated ${updatedDisplay}`;
    updatedEl.dataset.role = 'manual-data-updated';
    valueBlock.append(rentLabel, rentValueEl, updatedEl);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'self-start bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors';
    editButton.textContent = rentRollValue != null ? 'Edit' : 'Add Rent Roll';
    editButton.addEventListener('click', () => openManualDataModal(account));
    state.manualDataEditButton = editButton;

    headerRow.append(valueBlock, editButton);
    container.appendChild(headerRow);

    const calculatedSection = document.createElement('div');
    calculatedSection.className = 'grid grid-cols-1 gap-4';

    const annualCard = document.createElement('div');
    annualCard.className = 'bg-slate-50 border border-slate-200 rounded-lg p-4';
    const annualLabel = document.createElement('p');
    annualLabel.className = 'text-sm font-medium text-slate-600';
    annualLabel.textContent = 'Annual Rent (calculated)';
    const annualValueEl = document.createElement('p');
    annualValueEl.className = 'text-lg font-semibold text-slate-800';
    annualValueEl.textContent = rentRollValue != null ? formatCurrency(annualRent, currency) : '—';
    annualValueEl.dataset.role = 'manual-data-annual-rent';
    const annualHint = document.createElement('p');
    annualHint.className = 'text-xs text-slate-500 mt-1';
    annualHint.textContent = 'Calculated automatically from monthly rent roll × 12.';
    calculatedSection.appendChild(annualCard);
    annualCard.append(annualLabel, annualValueEl, annualHint);

    const calculatedNotice = document.createElement('div');
    calculatedNotice.className = 'text-xs text-slate-500';
    calculatedNotice.textContent = 'Calculated fields are read-only and update automatically when you save manual data.';

    container.append(calculatedSection, calculatedNotice);
    state.accountModalTabContent.appendChild(container);
  }

  function loadManualData(account, { showLoading }) {
    abortCurrentLoad();
    if (!state.accountModalTabContent) return;
    if (showLoading) {
      renderManualDataContent(account, { status: 'loading' });
    }
    const controller = new AbortController();
    state.loadController = controller;
    BackendAdapter.fetchManualData(account.id, { signal: controller.signal })
      .then((data) => {
        if (state.activeAccount && state.activeAccount.id === account.id) {
          renderManualDataContent(account, { status: 'ready', data });
          updateRentRollSummaryDisplay();
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        const enriched = error instanceof Error ? error : new Error(String(error));
        if (state.activeAccount && state.activeAccount.id === account.id) {
          renderManualDataContent(account, { status: 'error', error: enriched });
        }
      })
      .finally(() => {
        if (state.loadController === controller) {
          state.loadController = null;
        }
      });
  }

  function abortCurrentLoad() {
    if (state.loadController) {
      try { state.loadController.abort(); } catch (_) {}
      state.loadController = null;
    }
  }

  function openManualDataModal(account) {
    if (!state.manualModal || !state.manualModalInput) return;
    state.manualModalSaving = false;
    state.manualModalInput.value = '';
    const cached = getManualDataFromCache(account.id);
    if (cached && cached.rent_roll != null && !Number.isNaN(Number(cached.rent_roll))) {
      state.manualModalInput.value = Number(cached.rent_roll).toString();
    }
    hideManualModalError();
    state.activeAccount = account;
    state.manualModal.dataset.accountId = account.id;
    updateManualModalValidity();
    showModal(state.manualModal, state.manualModalContent, () => {
      state.manualModalInput?.focus();
      state.manualModalInput?.select();
    });
  }

  function closeManualDataModal() {
    abortCurrentSave();
    hideModal(state.manualModal, state.manualModalContent);
  }

  function abortCurrentSave() {
    if (state.saveController) {
      try { state.saveController.abort(); } catch (_) {}
      state.saveController = null;
    }
    state.manualModalSaving = false;
    updateManualModalValidity();
  }

  function handleManualDataSave(event) {
    if (event) event.preventDefault();
    if (!state.activeAccount) return;
    const validation = updateManualModalValidity({ showError: true });
    if (!validation.valid) {
      return;
    }

    if (!BackendAdapter.isBackendEnabled()) {
      showToast('Backend not enabled');
      return;
    }

    performManualDataMutation({ rentRoll: validation.value, action: 'save' });
  }

  function handleManualDataClear(event) {
    if (event) event.preventDefault();
    if (!state.activeAccount) return;
    const confirmClear = window.confirm('Clear manual rent roll value?');
    if (!confirmClear) return;
    if (!BackendAdapter.isBackendEnabled()) {
      showToast('Backend not enabled');
      return;
    }
    performManualDataMutation({ rentRoll: null, action: 'clear' });
  }

  function performManualDataMutation({ rentRoll, action }) {
    const account = state.activeAccount;
    if (!account || !state.manualModalInput) return;
    state.manualModalSaving = true;
    updateManualModalValidity();
    disableManualModalButtons(true);
    const controller = new AbortController();
    state.saveController = controller;

    BackendAdapter.updateManualData(account.id, { rent_roll: rentRoll }, { signal: controller.signal })
      .then(({ data, requestId }) => {
        updateManualDataCache(account.id, data, account.currency);
        showToast('Manual data saved successfully');
        closeManualDataModal();
        if (state.activeAccount && state.activeAccount.id === account.id) {
          renderManualDataTab(account);
        }
        updateRentRollSummaryDisplay();
        if (requestId) {
          console.log('[ManualData] request-id:', requestId);
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        const message = error.code === 'BACKEND_DISABLED'
          ? 'Backend not enabled'
          : (error.message || 'Failed to save manual data');
        const toastMessage = error.requestId ? `${message} (request-id: ${error.requestId})` : message;
        showToast(toastMessage);
        showManualModalError(message, error.requestId);
      })
      .finally(() => {
        if (state.saveController === controller) {
          state.saveController = null;
        }
        state.manualModalSaving = false;
        disableManualModalButtons(false);
        updateManualModalValidity();
      });
  }

  function disableManualModalButtons(disabled) {
    [state.manualModalSave, state.manualModalClear, state.manualModalCancel, state.manualModalClose].forEach((btn) => {
      if (!btn) return;
      if (disabled) {
        btn.setAttribute('disabled', 'true');
      } else {
        btn.removeAttribute('disabled');
      }
    });
  }

  function showManualModalError(message, requestId) {
    if (!state.manualModalError) return;
    const detail = requestId ? `${message} (request-id: ${requestId})` : message;
    state.manualModalError.textContent = detail;
    state.manualModalError.classList.remove('hidden');
  }

  function hideManualModalError() {
    if (!state.manualModalError) return;
    state.manualModalError.textContent = '';
    state.manualModalError.classList.add('hidden');
  }

  function updateManualModalValidity({ showError = false } = {}) {
    if (!state.manualModalInput || !state.manualModalSave) return { valid: false };
    const raw = state.manualModalInput.value.trim();
    const validation = validateRentRollInput(raw);
    const disableSave = state.manualModalSaving || !validation.valid;
    if (disableSave) {
      state.manualModalSave.setAttribute('disabled', 'true');
    } else {
      state.manualModalSave.removeAttribute('disabled');
    }
    if (!showError || validation.valid) {
      hideManualModalError();
    } else {
      showManualModalError(validation.message);
    }
    return validation;
  }

  function validateRentRollInput(raw) {
    if (raw === '') {
      return { valid: false, message: 'Please enter a value or use Clear' };
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return { valid: false, message: 'Please enter a numeric value' };
    }
    if (value < 0) {
      return { valid: false, message: 'Please enter a valid non-negative number' };
    }
    if (value > 1e9) {
      return { valid: false, message: 'Value is too large (max 1,000,000,000)' };
    }
    const rounded = Math.round(value * 100) / 100;
    return { valid: true, value: rounded };
  }

  function showModal(modal, content, onShown) {
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    window.requestAnimationFrame(() => {
      content.classList.remove('scale-95', 'opacity-0');
      content.classList.add('scale-100', 'opacity-100');
      if (typeof onShown === 'function') {
        window.setTimeout(onShown, 20);
      }
    });
  }

  function hideModal(modal, content) {
    if (!modal || !content) return;
    content.classList.add('scale-95');
    content.classList.remove('scale-100');
    content.classList.remove('opacity-100');
    content.classList.add('opacity-0');
    window.setTimeout(() => {
      modal.classList.add('hidden');
      content.classList.remove('opacity-0');
    }, 150);
  }

  return {
    bind,
    openAccountModal,
    closeAccountModal,
    openManualModal: openManualDataModal,
  };
})();

window.bindManualDataUI = () => {
  ManualDataUI.bind();
};

window.openManualDataModal = (accountId, rentRoll, currency = 'USD') => {
  ManualDataUI.bind();
  if (!accountId) {
    throw new Error('accountId is required');
  }
  const existing = accountRegistry.get(accountId) || { id: accountId, name: accountId, currency };
  if (!accountRegistry.has(accountId)) {
    accountRegistry.set(accountId, existing);
  }
  if (currency && existing.currency !== currency) {
    existing.currency = currency;
  }
  if (rentRoll !== undefined) {
    updateManualDataCache(accountId, {
      account_id: accountId,
      rent_roll: rentRoll,
      updated_at: new Date().toISOString(),
      currency,
    }, currency);
  }
  ManualDataUI.openAccountModal(existing);
  ManualDataUI.openManualModal(existing);
};

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
  accountRegistry.clear();
  clearManualDataCache();

  const accounts = await BackendAdapter.fetchAccounts();

  let totalAssets = 0;
  let totalLiabilities = 0;
  
  for (const account of accounts) {
    const category = categorizeAccount(account);
    
    if (category === 'personal' || category === 'heloc') {
      continue;
    }
    
    const { card, balance } = await renderAccountCard(account);
    accountRegistry.set(account.id, { ...account, balance });

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
    updateRentRollSummaryDisplay();
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
