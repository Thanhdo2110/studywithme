"use strict";

/* ==========================================================================
   StudyWithMe — khoá-giá trị dùng cho phiên đăng nhập, rate limit và credit
   focus. Redis là mặc định; nếu không cấu hình REDIS_URL thì dùng bộ nhớ
   trong tiến trình (tiện cho dev/test nhanh, không dùng cho nhiều instance).
   ========================================================================== */

const { createClient } = require("redis");

function createMemoryKv() {
  const store = new Map();

  const live = (key) => {
    const item = store.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return item;
  };

  return {
    kind: "memory",
    async get(key) {
      const item = live(key);
      return item ? item.value : null;
    },
    async set(key, value, options = {}) {
      store.set(key, {
        value: String(value),
        expiresAt: options.EX ? Date.now() + options.EX * 1000 : 0,
      });
      return "OK";
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
    async incr(key) {
      const item = live(key);
      const next = (item ? Number(item.value) : 0) + 1;
      store.set(key, { value: String(next), expiresAt: item ? item.expiresAt : 0 });
      return next;
    },
    async expire(key, seconds) {
      const item = live(key);
      if (!item) return 0;
      item.expiresAt = Date.now() + seconds * 1000;
      return 1;
    },
    async ping() {
      return "PONG";
    },
    async flush() {
      store.clear();
    },
    async close() {
      store.clear();
    },
  };
}

async function createKv(url) {
  if (!url) {
    console.warn("[StudyWithMe] REDIS_URL chưa đặt — dùng bộ nhớ trong tiến trình.");
    return createMemoryKv();
  }

  const client = createClient({ url });
  client.on("error", (err) => console.error("[StudyWithMe][redis]", err.message));
  await client.connect();

  return {
    kind: "redis",
    get: (key) => client.get(key),
    set: (key, value, options) => (options && options.EX ? client.set(key, String(value), { EX: options.EX }) : client.set(key, String(value))),
    del: (key) => client.del(key),
    incr: (key) => client.incr(key),
    expire: (key, seconds) => client.expire(key, seconds),
    ping: () => client.ping(),
    flush: () => client.flushDb(),
    async close() {
      try {
        await client.quit();
      } catch {
        client.destroy();
      }
    },
  };
}

module.exports = { createKv, createMemoryKv };
