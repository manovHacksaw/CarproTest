const logger = require("../utils/logger");

class CacheService {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  set(key, value, ttlSeconds = 60) {
    this.store.set(key, value);
    const expiry = Date.now() + ttlSeconds * 1000;
    this.ttls.set(key, expiry);
    logger.debug("Cache set", { key, ttlSeconds });
  }

  get(key) {
    const expiry = this.ttls.get(key);
    if (!expiry || Date.now() > expiry) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return this.store.get(key);
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.store.delete(key);
    this.ttls.delete(key);
  }

  clear() {
    this.store.clear();
    this.ttls.clear();
    logger.info("Cache cleared");
  }

  async getOrSet(key, fetchFn, ttlSeconds = 60) {
    const cached = this.get(key);
    if (cached !== null) {
      logger.debug("Cache hit", { key });
      return cached;
    }

    logger.debug("Cache miss", { key });
    const value = await fetchFn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        logger.debug("Cache invalidated", { key });
      }
    }
  }

  getStats() {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

module.exports = new CacheService();
