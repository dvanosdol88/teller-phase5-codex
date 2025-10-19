const fs = require('fs');
const path = require('path');

const DB_FILE_PATH = path.join(__dirname, '..', 'data', 'db.json');

function loadDatabase() {
  try {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
    if (!raw) {
      console.warn('[dataStore] db.json is empty, returning fallback structure');
      return { accounts: [], balances: {}, transactions: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      balances: parsed.balances && typeof parsed.balances === 'object' ? parsed.balances : {},
      transactions: parsed.transactions && typeof parsed.transactions === 'object' ? parsed.transactions : {}
    };
  } catch (error) {
    console.error(`[dataStore] Failed to read db.json: ${error.message}`);
    return { accounts: [], balances: {}, transactions: {} };
  }
}

const database = loadDatabase();

function getAccounts() {
  return database.accounts;
}

function getAccountById(accountId) {
  if (!accountId) return null;
  return database.accounts.find((account) => account.id === accountId) || null;
}

function getBalanceByAccountId(accountId) {
  if (!accountId) return null;
  const balanceEntry = database.balances?.[accountId];
  if (!balanceEntry || typeof balanceEntry !== 'object') {
    return null;
  }

  const balance = balanceEntry.balance && typeof balanceEntry.balance === 'object'
    ? balanceEntry.balance
    : {};

  return {
    account_id: balanceEntry.account_id || accountId,
    cached_at: balanceEntry.cached_at || null,
    balance
  };
}

function getTransactionsByAccountId(accountId, limit) {
  if (!accountId) return null;
  const entry = database.transactions?.[accountId];
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  let transactions = Array.isArray(entry.transactions) ? [...entry.transactions] : [];
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    transactions = transactions.slice(0, limit);
  }

  return {
    account_id: entry.account_id || accountId,
    cached_at: entry.cached_at || null,
    transactions
  };
}

module.exports = {
  getAccounts,
  getAccountById,
  getBalanceByAccountId,
  getTransactionsByAccountId
};
