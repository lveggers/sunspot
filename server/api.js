import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { places } from "../src/places.js";
import { createGoldenHourApi } from "./golden-hour.js";

const token = () => randomBytes(24).toString("base64url");
const hash = (value) =>
  createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
const validText = (value, max) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= max;
const allowed = { walk: "park", bar: "bar", restaurant: "restaurant" };
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
};
const json = (body, status = 200, extra = {}) =>
  Response.json(body, { status, headers: { ...headers, ...extra } });
const error = (message, status, code = "common.error", params = {}) => json({ error: message, code, params }, status);

async function readBody(request) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw Object.assign(new Error("Ogiltig förfrågan."), { status: 415, code: "error.invalidRequest" });
  }
  const reader = request.body?.getReader();
  if (!reader)
    throw Object.assign(new Error("Ogiltig förfrågan."), { status: 400, code: "error.invalidRequest" });
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw Object.assign(new Error("Förfrågan är för stor."), {
          status: 413,
          code: "error.requestTooLarge",
        });
      }
      chunks.push(Buffer.from(value));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body;
  } catch (cause) {
    if (cause.status) throw cause;
    throw Object.assign(new Error("Ogiltig förfrågan."), { status: 400, code: "error.invalidRequest" });
  } finally {
    reader.releaseLock();
  }
}

// Web Request/Response service used directly by Next Route Handlers and tests.
// The database opens lazily in runtime.js, never while Next prerenders pages.
export function createApi({
  database = ":memory:",
  getWeather = async () => ({ available: false }),
  getSunEligibility = async () => ({
    allowed: false,
    reason: "Sol og åbningstid kan ikke bekræftes lige nu.",
    reasonCode: "error.sunUnconfirmed",
    until: 0,
  }),
  development = false,
  origin,
  limit = 100,
} = {}) {
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS gatherings (id TEXT PRIMARY KEY, host_hash TEXT NOT NULL, place_id TEXT NOT NULL, activity TEXT NOT NULL, starts_at TEXT NOT NULL, duration INTEGER NOT NULL, host TEXT NOT NULL, message TEXT NOT NULL, cancelled INTEGER DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rsvps (id TEXT PRIMARY KEY, gathering_id TEXT NOT NULL REFERENCES gatherings(id) ON DELETE CASCADE, edit_hash TEXT NOT NULL, name TEXT NOT NULL, answer TEXT NOT NULL);
  `);
  db.prepare(
    "DELETE FROM gatherings WHERE datetime(starts_at, '+' || duration || ' minutes', '+30 days') < datetime('now')",
  ).run();
  const handleGoldenHour = createGoldenHourApi({
    db,
    getSunEligibility,
    development,
    readBody,
    json,
  });
  // Shared per-process budget for the single-server pilot. Never trust a client-
  // supplied forwarding header as identity. Distributed hosting needs a shared limiter.
  let windowEnd = 0,
    requests = 0;

  async function handle(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, "");
      const method = request.method;
      if (Date.now() >= windowEnd) {
        windowEnd = Date.now() + 60_000;
        requests = 0;
      }
      if (++requests > limit)
        return json({ error: "För många försök. Vänta en minut.", code: "error.rateLimit", params: {} }, 429, {
          "Retry-After": String(Math.ceil((windowEnd - Date.now()) / 1000)),
        });
      if (["POST", "PATCH", "DELETE"].includes(method)) {
        const source = request.headers.get("origin");
        const allowedOrigins = Array.isArray(origin)
          ? origin
          : [origin || url.origin];
        if (source && !allowedOrigins.includes(source))
          return error("Ogiltigt ursprung.", 403, "error.origin");
      }
      const goldenHour = await handleGoldenHour(request, path, method);
      if (goldenHour) return goldenHour;
      if (path === "/api/weather") {
        if (method !== "GET") return error("Metoden stöds inte.", 405, "error.method");
        return json(await getWeather());
      }
      if (path === "/api/gatherings") {
        if (method !== "POST") return error("Metoden stöds inte.", 405, "error.method");
        const {
          placeId,
          activity,
          startsAt,
          duration,
          host,
          message = "",
        } = await readBody(request);
        const place = places.find((p) => p.id === placeId);
        const start = Date.parse(startsAt);
        if (
          !place ||
          !Object.hasOwn(allowed, activity) ||
          place.category !== allowed[activity] ||
          !Number.isFinite(start) ||
          start <= Date.now() ||
          start > Date.now() + 7 * 86400_000 ||
          ![30, 60, 90, 120].includes(duration) ||
          !validText(host, 50) ||
          typeof message !== "string" ||
          message.length > 300
        ) {
          return error(
            "Välj en giltig aktivitet, plats och framtida tid inom sju dagar. Ange ditt namn (högst 50 tecken).",
            400,
            "error.gatheringInvalid",
          );
        }
        const id = token(),
          hostToken = token();
        db.prepare(
          "INSERT INTO gatherings (id, host_hash, place_id, activity, starts_at, duration, host, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
          id,
          hash(hostToken),
          placeId,
          activity,
          new Date(start).toISOString(),
          duration,
          host.trim(),
          message.trim(),
          new Date().toISOString(),
        );
        return json({ id, hostToken }, 201);
      }
      const match = /^\/api\/gatherings\/([A-Za-z0-9_-]+)(\/rsvp)?$/.exec(path);
      if (!match) return error("Sidan finns inte.", 404, "error.notFound");
      const [, id, rsvp] = match;
      if (
        (rsvp && method !== "POST") ||
        (!rsvp && !["GET", "PATCH"].includes(method))
      )
        return error("Metoden stöds inte.", 405, "error.method");
      const g = db.prepare("SELECT * FROM gatherings WHERE id = ?").get(id);
      if (!g) return error("Inbjudan kunde inte hittas.", 404, "error.invitationNotFound");
      if (
        Date.now() >
        Date.parse(g.starts_at) + g.duration * 60_000 + 7 * 86400_000
      )
        return error("Inbjudan har gått ut.", 410, "error.invitationExpired");
      if (method === "GET") {
        const isHost =
          hash(request.headers.get("x-host-token")) === g.host_hash;
        const answers = db
          .prepare("SELECT name, answer FROM rsvps WHERE gathering_id = ?")
          .all(g.id);
        const counts = { yes: 0, maybe: 0, no: 0 };
        answers.forEach((a) => {
          counts[a.answer]++;
        });
        return json({
          id: g.id,
          place: places.find((p) => p.id === g.place_id),
          activity: g.activity,
          startsAt: g.starts_at,
          duration: g.duration,
          host: g.host,
          message: g.message,
          cancelled: Boolean(g.cancelled),
          counts,
          isHost,
          ...(isHost ? { answers } : {}),
        });
      }
      if (rsvp) {
        if (
          g.cancelled ||
          Date.now() > Date.parse(g.starts_at) + g.duration * 60_000
        )
          return error("Den här träffen tar inte längre emot svar.", 409, "error.rsvpClosed");
        const { name, answer, editToken } = await readBody(request);
        if (!validText(name, 50) || !["yes", "maybe", "no"].includes(answer))
          return error("Ange ditt namn och välj ett svar.", 400, "error.rsvpInvalid");
        if (editToken) {
          const row = db
            .prepare(
              "SELECT id FROM rsvps WHERE gathering_id = ? AND edit_hash = ?",
            )
            .get(g.id, hash(editToken));
          if (!row)
            return error("Ditt tidigare svar kunde inte verifieras.", 403, "error.rsvpUnverified");
          db.prepare("UPDATE rsvps SET name = ?, answer = ? WHERE id = ?").run(
            name.trim(),
            answer,
            row.id,
          );
          return json({ editToken });
        }
        const newToken = token();
        db.prepare("INSERT INTO rsvps VALUES (?, ?, ?, ?, ?)").run(
          token(),
          g.id,
          hash(newToken),
          name.trim(),
          answer,
        );
        return json({ editToken: newToken }, 201);
      }
      if (hash(request.headers.get("x-host-token")) !== g.host_hash)
        return error("Bara värden kan ställa in träffen.", 403, "error.hostOnly");
      const body = await readBody(request);
      if (body.cancelled !== true)
        return error("Endast inställning stöds i den här versionen.", 400, "error.cancelOnly");
      db.prepare("UPDATE gatherings SET cancelled = 1 WHERE id = ?").run(id);
      return json({ cancelled: true });
    } catch (cause) {
      return error(
        cause.status ? cause.message : "Något gick fel. Försök igen.",
        cause.status || 500,
        cause.status ? cause.code : "common.error",
      );
    }
  }
  return { handle, db };
}
