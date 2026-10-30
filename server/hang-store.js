import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Compare-and-swap keeps concurrent RSVPs, host edits and expiry consistent.
const cas = `local old=redis.call('GET',KEYS[1]); if (old or '')~=ARGV[1] then return 0 end; if ARGV[3]=='0' then redis.call('SET',KEYS[1],ARGV[2]) else redis.call('SET',KEYS[1],ARGV[2],'PXAT',ARGV[3]) end; return 1`;
export function redisHangStore(url, token, namespace = "hangs") {
  async function command(args) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("Hang storage unavailable");
    const body = await res.json();
    if (body.error) throw new Error("Hang storage command failed");
    return body.result;
  }
  const key = (id) => `sunspot:${namespace}:v1:${id}`;
  return {
    get: (id) => command(["GET", key(id)]),
    swap: async (id, old, next, expires) =>
      (await command(["EVAL", cas, 1, key(id), old || "", next, expires])) ===
      1,
  };
}
export async function sqliteHangStore(filename = ":memory:") {
  const { DatabaseSync } = await import("node:sqlite");
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS hang_records (id TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL)",
  );
  return {
    async get(id) {
      db.prepare(
        "DELETE FROM hang_records WHERE expires > 0 AND expires <= ?",
      ).run(Date.now());
      return (
        db.prepare("SELECT value FROM hang_records WHERE id=?").get(id)
          ?.value || null
      );
    },
    async swap(id, old, next, expires) {
      if (old === null)
        return !!db
          .prepare("INSERT OR IGNORE INTO hang_records VALUES (?,?,?)")
          .run(id, next, expires).changes;
      return !!db
        .prepare(
          "UPDATE hang_records SET value=?, expires=? WHERE id=? AND value=?",
        )
        .run(next, expires, id, old).changes;
    },
    close: () => db.close(),
  };
}
let singleton;
export function hangStore() {
  if (!singleton) {
    const url =
      process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token =
      process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) singleton = Promise.resolve(redisHangStore(url, token));
    else if (process.env.VERCEL)
      throw new Error("Shared hang storage is not configured");
    else
      singleton = sqliteHangStore(
        process.env.SUNSPOT_HANG_DB || ".data/hangs.sqlite",
      );
  }
  return singleton;
}

let profiles;
export function profileStore() {
  if (!profiles) {
    const url =
      process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token =
      process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!process.env.VERCEL && process.env.SUNSPOT_PROFILE_DB)
      profiles = sqliteHangStore(process.env.SUNSPOT_PROFILE_DB);
    else if (url && token)
      profiles = Promise.resolve(redisHangStore(url, token, "profiles"));
    else if (process.env.VERCEL)
      throw new Error("Shared profile storage is not configured");
    else
      profiles = sqliteHangStore(
        process.env.SUNSPOT_PROFILE_DB || ".data/profiles.sqlite",
      );
  }
  return profiles;
}
