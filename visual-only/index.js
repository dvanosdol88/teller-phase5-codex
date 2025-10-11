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
