window.FEATURE_USE_BACKEND = false;
window.TEST_BEARER_TOKEN = undefined;
window.FEATURE_MANUAL_DATA = false;
window.__manualDataBound = false;

const accountRegistry = new Map();
const manualDataCache = new Map();
const TELLER_APPLICATION_ID = 'app_pjnkt3k3flo2jacqo2000';
const BUILD_VERSION = '2025-10-19T00:00:00Z';
console.log('[UI] build version:', BUILD_VERSION);
console.log('[UI] load time:', new Date().toISOString());

const manualDataStore = new Map();
let manualDataSummaryAccountIds = new Set();
let lastComputedTotals = { assets: 0, liabilities: 0 };
const LIABILITY_SLUGS = ['heloc_loan','original_mortgage_loan_672','roof_loan'];

const manualDataUI = {
  bound: false,
  modal: null,
  overlay: null,
  content: null,
  rentRollInput: null,
  saveButton: null,
  clearButton: null,
  cancelButton: null,
  closeButtons: [],
  state: {
    accountId: null,
    currency: 'USD',
    touched: false,
    isSaving: false,
    isClearing: false,
    isFetching: false,
    lastKnownRentRoll: null,
    lastKnownUpdatedAt: null,
  },
};

function setManualDataSummaryAccounts(accountIds) {
  if (Array.isArray(accountIds)) {
    manualDataSummaryAccountIds = new Set(accountIds);
  } else {
    manualDataSummaryAccountIds = new Set();
  }
}

function getManualDataFromStore(accountId) {
  if (!accountId) return null;
  return manualDataStore.get(accountId) || null;
}

function manualDataStoreHas(accountId) {
  return manualDataStore.has(accountId);
}

function manualDataStoreValues() {
  return Array.from(manualDataStore.values());
}

function normalizeManualDataRecord(accountId, data) {
  const base = {
    account_id: accountId || (data && typeof data.account_id === 'string' ? data.account_id : undefined) || accountId,
    rent_roll: null,
    updated_at: null,
  };

  if (data && typeof data === 'object') {
    if (Object.prototype.hasOwnProperty.call(data, 'rent_roll') && data.rent_roll !== null && data.rent_roll !== undefined && data.rent_roll !== '') {
      const numeric = Number(data.rent_roll);
      if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
        base.rent_roll = numeric;
      }
    } else if (data && typeof data.rent_roll === 'number') {
      base.rent_roll = data.rent_roll;
    }

    if (typeof data.updated_at === 'string') {
      base.updated_at = data.updated_at;
    } else if (data.updated_at instanceof Date && !Number.isNaN(data.updated_at.valueOf())) {
      base.updated_at = data.updated_at.toISOString();
    }
  }

  if (base.rent_roll === undefined) base.rent_roll = null;
  if (base.updated_at === undefined) base.updated_at = null;

  return base;
}

function updateManualDataStore(accountId, payload, options = {}) {
  const normalized = normalizeManualDataRecord(accountId, payload || {});
  const previous = manualDataStore.get(accountId);
  const changed = !previous || previous.rent_roll !== normalized.rent_roll || previous.updated_at !== normalized.updated_at;

  manualDataStore.set(accountId, normalized);

  if (changed && !options.skipNotify) {
    notifyManualDataListeners(accountId);
  }

  return normalized;
}

function clearManualDataFromStore(accountId, options = {}) {
  return updateManualDataStore(accountId, { account_id: accountId, rent_roll: null, updated_at: null }, options);
}

function notifyManualDataListeners(accountId) {
  const record = getManualDataFromStore(accountId);
  rerenderManualDataTab(accountId, record);
  dispatchManualDataEvent(accountId, record);
  recalculateManualDataSummaries();
  refreshManualDataModalState(accountId, record);
}

function rerenderManualDataTab(accountId, manualData) {
  if (!accountId) return;
  try {
    if (window.__manualDataBinder && typeof window.__manualDataBinder.renderTab === 'function') {
      window.__manualDataBinder.renderTab(accountId, manualData);
      return;
    }
    if (window.__manualDataBinder && typeof window.__manualDataBinder.render === 'function') {
      window.__manualDataBinder.render(accountId, manualData);
      return;
    }
    if (typeof window.renderManualDataTab === 'function') {
      window.renderManualDataTab(accountId, manualData);
    }
  } catch (err) {
    console.error('[ManualData] Failed to rerender manual data tab:', err);
  }
}

function dispatchManualDataEvent(accountId, manualData) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('manual-data:updated', { detail: { accountId, manualData } }));
    }
  } catch (err) {
    console.error('[ManualData] Failed to dispatch manual data event:', err);
  }
}

function recalculateManualDataSummaries() {
  const rentRollValueEl = document.getElementById('rent-roll-total');
  if (rentRollValueEl) {
    let total = 0;
    manualDataSummaryAccountIds.forEach((accountId) => {
      const record = manualDataStore.get(accountId);
      if (record && record.rent_roll !== null && record.rent_roll !== undefined && !Number.isNaN(Number(record.rent_roll))) {
        total += Number(record.rent_roll);
      }
    });
    rentRollValueEl.textContent = formatCurrency(total);
  }

  const totalEquityEl = document.getElementById('total-equity-balance');
  if (totalEquityEl) {
    const totalEquity = (lastComputedTotals?.assets || 0) - (lastComputedTotals?.liabilities || 0);
    totalEquityEl.textContent = formatCurrency(totalEquity);
  }
}

function manualRentRollToInputValue(value) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) return '';
  return `${numeric}`;
}

function refreshManualDataModalState(accountId, manualDataOverride) {
  if (!manualDataUI.modal) return;
  if (!manualDataUI.state.accountId || manualDataUI.state.accountId !== accountId) return;

  const record = manualDataOverride || getManualDataFromStore(accountId);
  manualDataUI.state.lastKnownRentRoll = record?.rent_roll ?? null;
  manualDataUI.state.lastKnownUpdatedAt = record?.updated_at ?? null;

  if (manualDataUI.rentRollInput && !manualDataUI.state.touched) {
    manualDataUI.rentRollInput.value = manualRentRollToInputValue(record?.rent_roll);
  }

  refreshManualDataModalButtons();
}

function refreshManualDataModalButtons() {
  const { saveButton, clearButton, rentRollInput } = manualDataUI;
  const { isSaving, isClearing, isFetching, lastKnownRentRoll } = manualDataUI.state;

  if (saveButton) {
    saveButton.disabled = Boolean(isSaving || isClearing || isFetching);
    saveButton.textContent = isSaving ? 'Saving…' : 'Save';
  }

  if (clearButton) {
    const hasValue = lastKnownRentRoll !== null && lastKnownRentRoll !== undefined && !Number.isNaN(Number(lastKnownRentRoll));
    clearButton.disabled = Boolean(isSaving || isClearing || isFetching || !hasValue);
    clearButton.textContent = isClearing ? 'Clearing…' : 'Clear';
  }

  if (rentRollInput) {
    rentRollInput.disabled = Boolean(isSaving || isClearing || isFetching);
  }
}

window.__manualDataStore = {
  get: getManualDataFromStore,
  set: (accountId, payload) => updateManualDataStore(accountId, payload),
  clear: (accountId) => clearManualDataFromStore(accountId),
  has: manualDataStoreHas,
  values: manualDataStoreValues,
  setSummaryAccounts: setManualDataSummaryAccounts,
};

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
    backendStatus: { mode: 'unknown', message: '' }
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

  function emitStatusUpdate() {
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('backend:status', { detail: { ...state.backendStatus } }));
      }
    } catch (err) {
      console.warn('[BackendAdapter] Failed to emit backend status event:', err);
    }
  }

  function setBackendStatus(mode, message = '') {
    const next = { mode, message };
    const changed = state.backendStatus.mode !== next.mode || state.backendStatus.message !== next.message;
    state.backendStatus = next;
    if (changed) {
      emitStatusUpdate();
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
    if (isBackendEnabled()) {
      setBackendStatus('degraded', 'Live backend request failed; using cached data');
    }
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

  function getBackendStatus() {
    return { ...state.backendStatus };
  }

  function isBackendEnabled() {
    return Boolean(window.FEATURE_USE_BACKEND);
  }

  async function fetchManualSummary() {
    try {
      const resp = await fetch('/api/manual/summary', { headers: headers() });
      if (!resp.ok) throw new Error('manual summary failed');
      const data = await resp.json();
      return data;
    } catch (e) {
      recordDiagnostic('GET /api/manual/summary', e);
      return { manual: { liabilities: {}, assets: {} }, calculated: { totalAssets: 0, totalLiabilities: 0, totalEquity: 0 } };
    }
  }

  function markBackendHealthy() {
    if (isBackendEnabled()) {
      setBackendStatus('live', '');
    }
  }

  async function loadConfig() {
    let backendEnabled = Boolean(window.FEATURE_USE_BACKEND);
    let manualDataEnabled = Boolean(window.FEATURE_MANUAL_DATA);

    try {
      if (typeof location !== 'undefined' && location.protocol === 'file:') {
        setBackendStatus(backendEnabled ? 'live' : 'demo', backendEnabled ? '' : 'Running in local mock mode');
        return {
          enabled: backendEnabled,
          manualDataEnabled,
          apiBaseUrl: state.apiBaseUrl
        };
      }
      const resp = await fetch('/api/config', { headers: { Accept: 'application/json' } });
      if (!resp || !resp.ok) {
        throw new Error(`config request failed with status ${resp ? resp.status : 'unknown'}`);
      }
      const cfg = await resp.json().catch(() => ({}));
      if (cfg && typeof cfg.apiBaseUrl === 'string' && cfg.apiBaseUrl.trim()) {
        state.apiBaseUrl = cfg.apiBaseUrl;
      }
      if (cfg && typeof cfg.FEATURE_STATIC_DB === 'boolean') {
        window.FEATURE_STATIC_DB = cfg.FEATURE_STATIC_DB;
      } else {
        window.FEATURE_STATIC_DB = Boolean(window.FEATURE_STATIC_DB);
      }
      if (cfg && typeof cfg.FEATURE_USE_BACKEND === 'boolean') {
        backendEnabled = cfg.FEATURE_USE_BACKEND;
      }
      window.FEATURE_USE_BACKEND = backendEnabled;

      if (cfg && typeof cfg.FEATURE_MANUAL_DATA === 'boolean') {
        manualDataEnabled = cfg.FEATURE_MANUAL_DATA;
      }
      window.FEATURE_MANUAL_DATA = Boolean(manualDataEnabled);

      const backendMode = (cfg && typeof cfg.backendMode === 'string') ? cfg.backendMode : (window.FEATURE_STATIC_DB ? 'static' : (backendEnabled ? 'live' : 'disabled'));
      if (backendMode === 'static') {
        setBackendStatus('demo', 'Proxy is serving cached demo data');
      } else if (backendMode === 'disabled' || !backendEnabled) {
        setBackendStatus('disabled', 'Live backend disabled via configuration');
      } else {
        setBackendStatus('live', '');
      }
    } catch (err) {
      recordDiagnostic('GET /api/config', err);
      setBackendStatus('degraded', 'Unable to load backend configuration; using cached data');
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
      markBackendHealthy();
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
      if (!resp.ok) {
        if (resp.status === 404) {
          // Treat missing balance as zero; do not degrade entire app state
          return { available: 0, cached_at: null };
        }
        throw new Error("balance failed");
      }
      const data = await resp.json();
      markBackendHealthy();
      return { ...data.balance, cached_at: data.cached_at };
    } catch (err) {
      recordDiagnostic(`GET /db/accounts/${accountId}/balances`, err);
      return MOCK_BALANCES[accountId];
    }
  }

  async function fetchManualData(accountId, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const forceRefresh = Boolean(opts.force || opts.forceRefresh);
    const skipNotify = Boolean(opts.skipNotify);

    if (!forceRefresh) {
      const cached = getManualDataFromStore(accountId);
      if (cached) {
        return cached;
      }
    }

    if (!isBackendEnabled()) {
      const fallback = MOCK_MANUAL_DATA[accountId] || { account_id: accountId, rent_roll: null, updated_at: null };
      return updateManualDataStore(accountId, fallback, { skipNotify });
    }

    try {
      const requestInit = { headers: headers() };
      if (Object.prototype.hasOwnProperty.call(opts, 'signal')) {
        const abortSignal = opts.signal;
        if (abortSignal && typeof abortSignal === 'object' && typeof abortSignal.aborted === 'boolean') {
          requestInit.signal = abortSignal;
        } else if (abortSignal !== undefined && abortSignal !== null) {
          console.warn('[BackendAdapter] Ignoring non-AbortSignal value passed to fetchManualData');
        }
      }

      const resp = await fetch(`${state.apiBaseUrl}/db/accounts/${encodeURIComponent(accountId)}/manual-data`, requestInit);
      if (!resp.ok) {
        const error = new Error(`manual data request failed with status ${resp.status}`);
        recordDiagnostic(`GET /db/accounts/${accountId}/manual-data`, error);
        const fallback = { account_id: accountId, rent_roll: null, updated_at: null };
        return updateManualDataStore(accountId, fallback, { skipNotify });
      }
      const payload = await resp.json().catch(() => ({ account_id: accountId, rent_roll: null, updated_at: null }));
      markBackendHealthy();
      return updateManualDataStore(accountId, payload, { skipNotify });
    } catch (err) {
      recordDiagnostic(`GET /db/accounts/${accountId}/manual-data`, err);
      const fallback = { account_id: accountId, rent_roll: null, updated_at: null };
      return updateManualDataStore(accountId, fallback, { skipNotify });
    }
  }

  async function persistManualData(accountId, rentRollValue) {
    if (!isBackendEnabled()) {
      throw new Error('Backend not enabled');
    }

    const requestHeaders = { ...headers(), 'Content-Type': 'application/json' };
    const body = JSON.stringify({ rent_roll: rentRollValue });

    try {
      const resp = await fetch(`${state.apiBaseUrl}/db/accounts/${encodeURIComponent(accountId)}/manual-data`, {
        method: 'PUT',
        headers: requestHeaders,
        body,
      });

      if (!resp.ok) {
        let message = `manual data request failed with status ${resp.status}`;
        try {
          const errorPayload = await resp.json();
          if (errorPayload && typeof errorPayload.message === 'string') {
            message = errorPayload.message;
          } else if (errorPayload && typeof errorPayload.error === 'string') {
            message = errorPayload.error;
          }
        } catch (_) {}
        throw new Error(message);
      }

      let responseData = null;
      try {
        responseData = await resp.json();
      } catch (_) {}

      const normalized = updateManualDataStore(accountId, responseData || {
        account_id: accountId,
        rent_roll: rentRollValue ?? null,
        updated_at: (responseData && responseData.updated_at) || new Date().toISOString(),
      });

      return normalized;
    } catch (err) {
      console.error(`[ManualData] Failed to persist manual data for ${accountId}:`, err);
      throw err;
    }
  }

  return {
    loadConfig,
    isBackendEnabled,
    setBearerToken,
    fetchAccounts,
    fetchCachedBalance,
    fetchManualData,
    fetchManualSummary,
    saveManualData: (accountId, rentRoll) => persistManualData(accountId, rentRoll),
    clearManualData: (accountId) => persistManualData(accountId, null),
    getDiagnostics,
    clearDiagnostics,
    getBackendStatus
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

function bindManualDataUI() {
  if (manualDataUI.bound) return;

  const modal = document.getElementById('manual-data-modal');
  const rentRollInput = document.getElementById('rent-roll-input');

  if (!modal || !rentRollInput) {
    console.warn('[ManualData] Manual data modal elements not found.');
    return;
  }

  manualDataUI.modal = modal;
  manualDataUI.overlay = modal.querySelector('.modal-bg');
  manualDataUI.content = modal.querySelector('.modal-content');
  manualDataUI.rentRollInput = rentRollInput;
  manualDataUI.saveButton = modal.querySelector('.modal-save');
  manualDataUI.clearButton = modal.querySelector('.modal-clear');
  manualDataUI.cancelButton = modal.querySelector('.modal-cancel');
  manualDataUI.closeButtons = Array.from(modal.querySelectorAll('.modal-close'));
  manualDataUI.bound = true;

  rentRollInput.addEventListener('input', () => {
    manualDataUI.state.touched = true;
    refreshManualDataModalButtons();
  });

  if (manualDataUI.saveButton) {
    manualDataUI.saveButton.addEventListener('click', (event) => {
      event.preventDefault();
      handleManualDataSave();
    });
  }

  if (manualDataUI.clearButton) {
    manualDataUI.clearButton.addEventListener('click', (event) => {
      event.preventDefault();
      handleManualDataClear();
    });
  }

  if (manualDataUI.cancelButton) {
    manualDataUI.cancelButton.addEventListener('click', (event) => {
      event.preventDefault();
      closeManualDataModal();
    });
  }

  manualDataUI.closeButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      closeManualDataModal();
    });
  });

  if (manualDataUI.overlay) {
    manualDataUI.overlay.addEventListener('click', () => closeManualDataModal());
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && manualDataUI.modal && !manualDataUI.modal.classList.contains('hidden')) {
      closeManualDataModal();
    }
  });

  window.addEventListener('manual-data:open', (event) => {
    const detail = event?.detail || {};
    if (detail && detail.accountId) {
      openManualDataModal(detail.accountId, detail);
    }
  });

  window.openManualDataModal = openManualDataModal;
  window.closeManualDataModal = closeManualDataModal;

  refreshManualDataModalButtons();
}

function openManualDataModal(accountId, options = {}) {
  if (!manualDataUI.modal || !accountId) return;

  const forceRefresh = Boolean(options.force || options.forceRefresh);
  const existingRecord = getManualDataFromStore(accountId);

  manualDataUI.state.accountId = accountId;
  manualDataUI.state.currency = options.currency || 'USD';
  manualDataUI.state.touched = false;
  manualDataUI.state.isSaving = false;
  manualDataUI.state.isClearing = false;
  manualDataUI.state.isFetching = false;
  manualDataUI.state.lastKnownRentRoll = existingRecord?.rent_roll ?? null;
  manualDataUI.state.lastKnownUpdatedAt = existingRecord?.updated_at ?? null;

  manualDataUI.modal.classList.remove('hidden');
  if (manualDataUI.content) {
    manualDataUI.content.classList.add('opacity-0', 'scale-95');
    requestAnimationFrame(() => {
      if (manualDataUI.content) {
        manualDataUI.content.classList.remove('opacity-0', 'scale-95');
      }
    });
  }

  if (manualDataUI.rentRollInput) {
    manualDataUI.rentRollInput.value = manualRentRollToInputValue(existingRecord?.rent_roll);
    try {
      manualDataUI.rentRollInput.focus({ preventScroll: true });
      const length = manualDataUI.rentRollInput.value.length;
      manualDataUI.rentRollInput.setSelectionRange(length, length);
    } catch (_) {}
  }

  const needsFetch = forceRefresh || !existingRecord;
  if (needsFetch && BackendAdapter && typeof BackendAdapter.fetchManualData === 'function') {
    manualDataUI.state.isFetching = true;
    refreshManualDataModalButtons();
    BackendAdapter.fetchManualData(accountId, { force: forceRefresh })
      .catch((err) => {
        console.error('[ManualData] Failed to load manual data:', err);
      })
      .finally(() => {
        if (manualDataUI.state.accountId === accountId) {
          manualDataUI.state.isFetching = false;
          if (!manualDataUI.state.touched) {
            const latest = getManualDataFromStore(accountId);
            manualDataUI.state.lastKnownRentRoll = latest?.rent_roll ?? null;
            manualDataUI.state.lastKnownUpdatedAt = latest?.updated_at ?? null;
            if (manualDataUI.rentRollInput) {
              manualDataUI.rentRollInput.value = manualRentRollToInputValue(latest?.rent_roll);
            }
          }
          refreshManualDataModalButtons();
        }
      });
  } else {
    refreshManualDataModalButtons();
  }
}

function closeManualDataModal() {
  if (!manualDataUI.modal) return;

  if (manualDataUI.content) {
    manualDataUI.content.classList.add('opacity-0', 'scale-95');
  }

  window.setTimeout(() => {
    if (manualDataUI.modal) {
      manualDataUI.modal.classList.add('hidden');
    }
  }, 160);

  manualDataUI.state.accountId = null;
  manualDataUI.state.currency = 'USD';
  manualDataUI.state.touched = false;
  manualDataUI.state.isSaving = false;
  manualDataUI.state.isClearing = false;
  manualDataUI.state.isFetching = false;
  manualDataUI.state.lastKnownRentRoll = null;
  manualDataUI.state.lastKnownUpdatedAt = null;

  if (manualDataUI.rentRollInput) {
    manualDataUI.rentRollInput.value = '';
  }

  refreshManualDataModalButtons();
}

async function handleManualDataSave() {
  const { accountId } = manualDataUI.state;
  if (!accountId || !manualDataUI.rentRollInput) return;

  const rawValue = manualDataUI.rentRollInput.value.trim();
  if (rawValue === '') {
    showToast('Please enter a value or use Clear');
    manualDataUI.rentRollInput.focus();
    return;
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || Number.isNaN(numeric) || numeric < 0) {
    showToast('Please enter a valid non-negative number');
    manualDataUI.rentRollInput.focus();
    return;
  }

  if (!BackendAdapter.isBackendEnabled()) {
    showToast('Backend not enabled');
    return;
  }

  manualDataUI.state.isSaving = true;
  refreshManualDataModalButtons();

  try {
    await BackendAdapter.saveManualData(accountId, numeric);
    showToast('Manual data saved successfully');
    manualDataUI.state.touched = false;
    closeManualDataModal();
  } catch (err) {
    const message = err?.message || 'Failed to save manual data';
    showToast(message);
    console.error('[ManualData] Save failed:', err);
  } finally {
    manualDataUI.state.isSaving = false;
    refreshManualDataModalButtons();
  }
}

async function handleManualDataClear() {
  const { accountId, lastKnownRentRoll } = manualDataUI.state;
  if (!accountId) return;

  if (!BackendAdapter.isBackendEnabled()) {
    showToast('Backend not enabled');
    return;
  }

  if (lastKnownRentRoll === null || lastKnownRentRoll === undefined) {
    showToast('Nothing to clear');
    return;
  }

  const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm('Clear manual data for this account?') : true;
  if (!confirmed) return;

  manualDataUI.state.isClearing = true;
  refreshManualDataModalButtons();

  try {
    await BackendAdapter.clearManualData(accountId);
    showToast('Manual data saved successfully');
    manualDataUI.state.touched = false;
    closeManualDataModal();
  } catch (err) {
    const message = err?.message || 'Failed to clear manual data';
    showToast(message);
    console.error('[ManualData] Clear failed:', err);
  } finally {
    manualDataUI.state.isClearing = false;
    refreshManualDataModalButtons();
  }
}

window.bindManualDataUI = bindManualDataUI;

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
  const headlineEl = document.getElementById('diagnostics-headline');
  const cardEl = document.getElementById('diagnostics-card');

  if (!banner || !detailEl) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupDiagnosticsBanner, { once: true });
    }
    return;
  }

  diagnosticsBannerInitialized = true;

  function renderDiagnosticsBanner() {
    const diagnostics = BackendAdapter.getDiagnostics();
    const status = BackendAdapter.getBackendStatus();
    const latestDiagnostic = diagnostics && diagnostics.length > 0 ? diagnostics[diagnostics.length - 1] : null;
    const statusMode = status?.mode || 'unknown';

    if (!latestDiagnostic && (!status || statusMode === 'live' || statusMode === 'unknown')) {
      banner.classList.add('hidden');
      if (headlineEl) headlineEl.textContent = 'Using cached demo data';
      if (detailEl) detailEl.textContent = '';
      if (timestampEl) timestampEl.textContent = '';
      return;
    }

    banner.classList.remove('hidden');

    if (latestDiagnostic) {
      if (headlineEl) headlineEl.textContent = 'Backend fallback active';
      detailEl.textContent = `${latestDiagnostic.endpoint}: ${latestDiagnostic.message}`;
      if (timestampEl) {
        try {
          const when = new Date(latestDiagnostic.timestamp);
          timestampEl.textContent = `Last fallback at ${when.toLocaleString()}`;
        } catch {
          timestampEl.textContent = latestDiagnostic.timestamp ? `Last fallback at ${latestDiagnostic.timestamp}` : '';
        }
      }
    } else if (status) {
      let headline = 'Backend status';
      if (statusMode === 'demo') headline = 'Demo data mode';
      if (statusMode === 'disabled') headline = 'Live backend disabled';
      if (statusMode === 'degraded') headline = 'Backend unavailable';
      if (headlineEl) headlineEl.textContent = headline;
      detailEl.textContent = status.message || 'The dashboard is using cached data.';
      if (timestampEl) timestampEl.textContent = '';
    }

    if (cardEl) {
      cardEl.classList.remove('bg-amber-100', 'border-amber-500', 'text-amber-900', 'bg-sky-100', 'border-sky-500', 'text-sky-900');
      if (statusMode === 'disabled') {
        cardEl.classList.add('bg-sky-100', 'border-sky-500', 'text-sky-900');
      } else {
        cardEl.classList.add('bg-amber-100', 'border-amber-500', 'text-amber-900');
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
        // More accurate toast for partial failures
        showToast('Some requests failed; showing partial data');
      }
    }
  });

  window.addEventListener('backend:status', (event) => {
    renderDiagnosticsBanner();
    const detail = event && event.detail;
    if (!detail) return;
    if (detail.mode === 'degraded' || detail.mode === 'demo' || detail.mode === 'disabled') {
      const now = Date.now();
      if (now - diagnosticsToastCooldown > 4000) {
        diagnosticsToastCooldown = now;
        const message = detail.message || 'Backend unavailable; showing cached data';
        showToast(message);
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

function formatTimestamp(isoString) {
  if (!isoString) return 'Unknown';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Unknown';
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  } catch (err) {
    console.error('Failed to format timestamp:', err);
    return 'Unknown';
  }
}

function updateDataTimestamp(timestamp) {
  const timestampEl = document.getElementById('data-timestamp');
  if (!timestampEl) return;
  
  if (timestamp) {
    const formattedTime = formatTimestamp(timestamp);
    timestampEl.textContent = `Data as of ${formattedTime}`;
    timestampEl.style.display = 'block';
  } else {
    timestampEl.textContent = 'Data timestamp unavailable';
    timestampEl.style.display = 'block';
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
  const cachedAt = balance?.cached_at;
  
  const card = document.createElement('div');
  card.className = 'bg-slate-50 p-4 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer';
  card.style.cssText = 'background-color: var(--bg-tertiary); border-color: var(--border-color);';
  card.dataset.accountId = account.id;
  
  const nameEl = document.createElement('h5');
  nameEl.className = 'font-semibold text-slate-800 mb-1';
  nameEl.style.color = 'var(--text-primary)';
  nameEl.textContent = account.name || 'Account';
  
  const balanceEl = document.createElement('p');
  balanceEl.className = 'text-lg font-bold text-slate-900';
  balanceEl.style.color = 'var(--text-primary)';
  balanceEl.textContent = formatCurrency(balanceValue, account.currency);
  
  const subtitleParts = [];
  if (account.institution) subtitleParts.push(account.institution);
  if (account.last_four) subtitleParts.push(`•••• ${account.last_four}`);
  
  if (subtitleParts.length > 0) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'text-xs text-slate-500 mt-1';
    subtitleEl.style.color = 'var(--text-secondary)';
    subtitleEl.textContent = subtitleParts.join(' · ');
    card.append(nameEl, balanceEl, subtitleEl);
  } else {
    card.append(nameEl, balanceEl);
  }
  
  return { card, balance: balanceValue, cachedAt };
}

async function calculateRentRoll(accounts) {
  if (!Array.isArray(accounts)) return 0;

  const missing = new Set();
  for (const account of accounts) {
    if (!account || !account.id) continue;
    if (!manualDataStoreHas(account.id)) {
      missing.add(account.id);
    }
  }

  if (missing.size > 0) {
    await Promise.all(
      Array.from(missing).map((accountId) =>
        BackendAdapter.fetchManualData(accountId).catch((err) => {
          console.error(`[ManualData] Failed to fetch manual data for ${accountId}:`, err);
          return null;
        })
      )
    );
  }

  let total = 0;
  for (const account of accounts) {
    const record = getManualDataFromStore(account.id);
    if (record && record.rent_roll !== null && record.rent_roll !== undefined && !Number.isNaN(Number(record.rent_roll))) {
      total += Number(record.rent_roll);
    }
  }

  return total;
}

async function init() {
  const assetsContainer = document.getElementById('assets-container');
  const liabilitiesContainer = document.getElementById('liabilities-container');
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
  setManualDataSummaryAccounts((accounts || []).map((account) => account && account.id).filter(Boolean));
  
  let totalAssets = 0;
  let totalLiabilities = 0;
  let mostRecentTimestamp = null;
  
  for (const account of accounts) {
    const category = categorizeAccount(account);
    
    if (category === 'personal' || category === 'heloc') {
      continue;
    }
    
    const { card, balance, cachedAt } = await renderAccountCard(account);
    accountRegistry.set(account.id, { ...account, balance });

    if (cachedAt && (!mostRecentTimestamp || new Date(cachedAt) > new Date(mostRecentTimestamp))) {
      mostRecentTimestamp = cachedAt;
    }

    if (category === 'asset') {
      assetsContainer.appendChild(card);
      totalAssets += balance;
    } else if (category === 'liability') {
      liabilitiesContainer.appendChild(card);
      totalLiabilities += Math.abs(balance);
    }
  }
  
  lastComputedTotals = { assets: totalAssets, liabilities: totalLiabilities };

  const totalEquity = totalAssets - totalLiabilities;
  if (totalEquityValue) {
    totalEquityValue.textContent = formatCurrency(totalEquity);
  }

  updateDataTimestamp(mostRecentTimestamp);

  await calculateRentRoll(accounts);
  recalculateManualDataSummaries();

  showToast('Dashboard loaded');

  // Load manual summary (assets/liabilities totals + manual fields)
  try {
    const summary = await BackendAdapter.fetchManualSummary();
    renderManualSummary(summary);
  } catch (_) {}
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

// ---- Manual Liabilities/Assets UI wiring ----
function readNumberInput(id, decimals = 2) {
  const el = document.getElementById(id);
  if (!el) return null;
  if (el.value === '') return null;
  const n = Number(el.value);
  if (!Number.isFinite(n) || n < 0) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

async function renderManualSummary(summary) {
  if (!summary || !summary.calculated) return;
  const ta = document.getElementById('total-assets-label');
  const tl = document.getElementById('total-liabilities-label');
  const te = document.getElementById('total-equity-balance');
  if (ta) ta.textContent = `Total Assets: ${formatCurrency(summary.calculated.totalAssets)}`;
  if (tl) tl.textContent = `Total Liabilities: ${formatCurrency(summary.calculated.totalLiabilities)}`;
  if (te) te.textContent = `${formatCurrency(summary.calculated.totalEquity)}`;

  const liab = (summary.manual && summary.manual.liabilities) || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val == null ? '' : val); };
  if (liab.heloc_loan) {
    setVal('heloc-loan-amount', liab.heloc_loan.loanAmountUsd);
    setVal('heloc-interest-rate', liab.heloc_loan.interestRatePct);
    setVal('heloc-monthly-payment', liab.heloc_loan.monthlyPaymentUsd);
    setVal('heloc-outstanding', liab.heloc_loan.outstandingBalanceUsd);
  }
  if (liab.original_mortgage_loan_672) {
    setVal('m672-loan-amount', liab.original_mortgage_loan_672.loanAmountUsd);
    setVal('m672-interest-rate', liab.original_mortgage_loan_672.interestRatePct);
    setVal('m672-monthly-payment', liab.original_mortgage_loan_672.monthlyPaymentUsd);
    setVal('m672-outstanding', liab.original_mortgage_loan_672.outstandingBalanceUsd);
  }
  if (liab.roof_loan) {
    setVal('roof-loan-amount', liab.roof_loan.loanAmountUsd);
    setVal('roof-interest-rate', liab.roof_loan.interestRatePct);
    setVal('roof-monthly-payment', liab.roof_loan.monthlyPaymentUsd);
    setVal('roof-outstanding', liab.roof_loan.outstandingBalanceUsd);
  }
  const asset = summary.manual && summary.manual.assets && summary.manual.assets['property_672_elm_value'];
  if (asset && document.getElementById('asset-672-elm')) document.getElementById('asset-672-elm').value = asset.valueUsd ?? '';
}

async function saveManualLiability(slug, ids) {
  const payload = {
    loanAmountUsd: readNumberInput(ids.loan, 2),
    interestRatePct: readNumberInput(ids.rate, 4),
    monthlyPaymentUsd: readNumberInput(ids.monthly, 2),
    outstandingBalanceUsd: readNumberInput(ids.outstanding, 2)
  };
  try {
    const resp = await fetch(`/api/manual/liabilities/${slug}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (resp.status === 405) { showToast('Writes disabled by feature flag'); return; }
    if (resp.status === 503) { showToast('Manual data store unavailable'); return; }
    if (!resp.ok) {
      let msg = 'Save failed';
      try {
        const err = await resp.json();
        if (typeof err?.message === 'string') msg = err.message;
        else if (typeof err?.reason === 'string') msg = err.reason;
        else if (typeof err?.error === 'string') msg = err.error;
      } catch (_) {
        try { msg = await resp.text(); } catch (_) {}
      }
      throw new Error(msg || 'Save failed');
    }
    showToast('Saved');
    const summary = await BackendAdapter.fetchManualSummary();
    renderManualSummary(summary);
  } catch (e) { showToast(e?.message || 'Save failed'); }
}

async function saveManualAsset() {
  const valueUsd = readNumberInput('asset-672-elm', 2);
  try {
    const resp = await fetch('/api/manual/assets/property_672_elm_value', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valueUsd }) });
    if (resp.status === 405) { showToast('Writes disabled by feature flag'); return; }
    if (resp.status === 503) { showToast('Manual data store unavailable'); return; }
    if (!resp.ok) {
      let msg = 'Save failed';
      try {
        const err = await resp.json();
        if (typeof err?.message === 'string') msg = err.message;
        else if (typeof err?.reason === 'string') msg = err.reason;
        else if (typeof err?.error === 'string') msg = err.error;
      } catch (_) {
        try { msg = await resp.text(); } catch (_) {}
      }
      throw new Error(msg || 'Save failed');
    }
    showToast('Saved');
    const summary = await BackendAdapter.fetchManualSummary();
    renderManualSummary(summary);
  } catch (e) { showToast(e?.message || 'Save failed'); }
}

document.addEventListener('DOMContentLoaded', () => {
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  bind('save-asset-672-elm', saveManualAsset);
  bind('save-heloc', () => saveManualLiability('heloc_loan', { loan:'heloc-loan-amount', rate:'heloc-interest-rate', monthly:'heloc-monthly-payment', outstanding:'heloc-outstanding' }));
  bind('save-m672', () => saveManualLiability('original_mortgage_loan_672', { loan:'m672-loan-amount', rate:'m672-interest-rate', monthly:'m672-monthly-payment', outstanding:'m672-outstanding' }));
  bind('save-roof', () => saveManualLiability('roof_loan', { loan:'roof-loan-amount', rate:'roof-interest-rate', monthly:'roof-monthly-payment', outstanding:'roof-outstanding' }));
});

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
