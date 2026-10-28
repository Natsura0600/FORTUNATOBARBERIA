// Capa de acceso a datos.
// En producción usa Upstash Redis (REST). Si no hay credenciales, cae a un
// almacenamiento en memoria para poder correr `npm run dev` sin configurar nada.
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const PREFIX = process.env.REDIS_PREFIX || "fortunato";
export const k = (...parts) => [PREFIX, ...parts].join(":");

function parse(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

function createUpstash() {
  const redis = new Redis({ url, token });
  return {
    kind: "upstash",
    async get(key) { return parse(await redis.get(key)); },
    async set(key, value) { await redis.set(key, JSON.stringify(value)); },
    async hgetall(key) {
      const r = await redis.hgetall(key);
      if (!r) return {};
      const out = {};
      for (const [f, v] of Object.entries(r)) out[f] = parse(v);
      return out;
    },
    async hgetallMany(keys) {
      if (!keys.length) return [];
      const p = redis.pipeline();
      keys.forEach((key) => p.hgetall(key));
      const res = await p.exec();
      return res.map((r) => {
        const out = {};
        for (const [f, v] of Object.entries(r || {})) out[f] = parse(v);
        return out;
      });
    },
    async hget(key, field) { return parse(await redis.hget(key, field)); },
    async hset(key, field, value) { await redis.hset(key, { [field]: JSON.stringify(value) }); },
    async hdel(key, field) { await redis.hdel(key, field); },
    // Varios campos de un hash en un solo comando.
    async hsetMany(key, obj) {
      const payload = {};
      for (const [f, v] of Object.entries(obj)) payload[f] = JSON.stringify(v);
      if (Object.keys(payload).length) await redis.hset(key, payload);
    },
    // Claves que coinciden con un patrón (solo para copias de seguridad).
    async keys(pattern) {
      const out = [];
      let cursor = "0";
      do {
        const [next, batch] = await redis.scan(cursor, { match: pattern, count: 500 });
        out.push(...batch);
        cursor = String(next);
      } while (cursor !== "0");
      return out;
    },
    // SET NX con vencimiento: devuelve true si tomó la llave.
    async claim(key, value, ttlSeconds) {
      const r = await redis.set(key, value, { nx: true, ex: ttlSeconds });
      return r === "OK";
    },
    async del(...keys) { if (keys.length) await redis.del(...keys); },
  };
}

function createMemory() {
  const g = globalThis;
  if (!g.__fortunatoMem) g.__fortunatoMem = { kv: new Map(), h: new Map(), exp: new Map() };
  const m = g.__fortunatoMem;
  const alive = (key) => {
    const e = m.exp.get(key);
    if (e && e < Date.now()) { m.kv.delete(key); m.exp.delete(key); return false; }
    return m.kv.has(key);
  };
  const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
  return {
    kind: "memory",
    async get(key) { return alive(key) ? clone(m.kv.get(key)) : null; },
    async set(key, value) { m.kv.set(key, clone(value)); },
    async hgetall(key) { return clone(Object.fromEntries(m.h.get(key) || [])) || {}; },
    async hgetallMany(keys) { return keys.map((key) => clone(Object.fromEntries(m.h.get(key) || [])) || {}); },
    async hget(key, field) { return clone(m.h.get(key)?.get(field) ?? null); },
    async hset(key, field, value) {
      if (!m.h.has(key)) m.h.set(key, new Map());
      m.h.get(key).set(field, clone(value));
    },
    async hdel(key, field) { m.h.get(key)?.delete(field); },
    async hsetMany(key, obj) {
      for (const [f, v] of Object.entries(obj)) await this.hset(key, f, v);
    },
    async keys(pattern) {
      const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      return [...m.h.keys()].filter((x) => re.test(x));
    },
    async claim(key, value, ttl) {
      if (alive(key)) return false;
      m.kv.set(key, value); m.exp.set(key, Date.now() + ttl * 1000);
      return true;
    },
    async del(...keys) { keys.forEach((key) => { m.kv.delete(key); m.h.delete(key); m.exp.delete(key); }); },
  };
}

export const db = url && token ? createUpstash() : createMemory();

if (db.kind === "memory" && process.env.NODE_ENV === "production") {
  console.warn("[fortunato] Sin credenciales de Upstash: los datos se guardan en memoria y se pierden. Configurá UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN.");
}
