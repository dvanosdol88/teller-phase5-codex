const fs = require('fs/promises');
const path = require('path');

class ManualDataStore {
  constructor(filePath = path.join(__dirname, '..', 'data', 'manual-data.json')) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
    this.ready = this.ensureStorage();
  }

  async ensureStorage() {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.writeFile(this.filePath, '{}\n', 'utf8');
      } else {
        throw error;
      }
    }
  }

  async readAll(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    await this.ready;
    if (!opts.skipQueue) {
      await this.queue;
    }
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      console.error(`[manualDataStore] Failed to read manual data file: ${error.message}`);
      return {};
    }
  }

  async writeAll(data) {
    await this.ready;
    const payload = `${JSON.stringify(data, null, 2)}\n`;
    await fs.writeFile(this.filePath, payload, 'utf8');
  }

  formatRecord(accountId, record, currency) {
    const rentRoll = record && typeof record.rent_roll === 'number' && Number.isFinite(record.rent_roll)
      ? record.rent_roll
      : null;
    const updatedAt = record && typeof record.updated_at === 'string' ? record.updated_at : null;
    const resolvedCurrency = currency || (record && typeof record.currency === 'string' ? record.currency : null);

    const payload = {
      account_id: accountId,
      rent_roll: rentRoll,
      updated_at: updatedAt
    };

    if (resolvedCurrency) {
      payload.currency = resolvedCurrency;
    }

    return payload;
  }

  enqueue(work) {
    const next = this.queue.then(() => work());
    this.queue = next.catch((error) => {
      this.queue = Promise.resolve();
      throw error;
    });
    return next;
  }

  async get(accountId, currency) {
    const data = await this.readAll();
    const record = data?.[accountId];
    if (!record) {
      const payload = { account_id: accountId, rent_roll: null, updated_at: null };
      if (currency) {
        payload.currency = currency;
      }
      return payload;
    }
    return this.formatRecord(accountId, record, currency);
  }

  async set(accountId, rentRoll, currency) {
    const numeric = typeof rentRoll === 'number' ? rentRoll : Number(rentRoll);
    if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
      throw new TypeError('rentRoll must be a finite number');
    }

    const normalized = Math.round(numeric * 100) / 100;
    const now = new Date().toISOString();

    return this.enqueue(async () => {
      const data = await this.readAll({ skipQueue: true });
      data[accountId] = {
        rent_roll: normalized,
        updated_at: now,
        currency: currency || undefined
      };
      await this.writeAll(data);
      return this.formatRecord(accountId, data[accountId], currency);
    });
  }

  async clear(accountId, currency) {
    return this.enqueue(async () => {
      const data = await this.readAll({ skipQueue: true });
      if (Object.prototype.hasOwnProperty.call(data, accountId)) {
        delete data[accountId];
        await this.writeAll(data);
      }
      const payload = { account_id: accountId, rent_roll: null, updated_at: null };
      if (currency) {
        payload.currency = currency;
      }
      return payload;
    });
  }
}

module.exports = { ManualDataStore };
