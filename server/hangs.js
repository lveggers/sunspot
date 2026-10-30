import { createHash } from "node:crypto";
import { places } from "../src/places.js";
import { normalizeProfilePhoto } from "./profile-photo.js";
import { hangStore } from "./hang-store.js";
const HOUR = 3600000,
  DAY = 24 * HOUR;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const tokenPattern = /^[A-Za-z0-9_-]{43,128}$/;
const idPattern = /^[a-f0-9]{32}$/;
const activities = ["beer", "coffee", "food", "hang"];
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
function name(value) {
  if (typeof value !== "string") fail(400, "Skriv ditt förnamn.");
  const clean = value.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 32 || /[\p{C}<>]/u.test(clean))
    fail(400, "Använd ett förnamn på högst 32 tecken.");
  return clean;
}
function token(value) {
  if (!tokenPattern.test(value || ""))
    fail(401, "Den här webbläsaren saknar behörighet.");
  return value;
}
function phase(h, now) {
  return h.closed || now >= h.endsAt
    ? "ended"
    : now < h.startsAt
      ? "scheduled"
      : "active";
}
function view(h, secret, now, publicOrigin) {
  const p = places.find((p) => p.id === h.placeId);
  const identity = secret ? hash(secret) : "";
  return {
    id: h.id,
    host: h.host,
    hostPhoto: h.hostPhoto
      ? `/api/hangs/${h.id}/photo?v=${hash(h.hostPhoto).slice(0, 12)}`
      : null,
    activity: h.activity,
    startsAt: h.startsAt,
    endsAt: h.endsAt,
    status: phase(h, now),
    serverNow: now,
    place: {
      id: p.id,
      name: p.name,
      district: p.district,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
    },
    guests: h.guests.map((g) => ({
      id: g.id,
      name: g.name,
      photo: g.photo
        ? `/api/hangs/${h.id}/photo?guest=${g.id}&v=${hash(g.photo).slice(0, 12)}`
        : null,
    })),
    isHost: identity === h.hostHash,
    joined: h.guests.some((g) => g.hash === identity),
    sunUntil: h.sunUntil,
    sunAt: h.sunAt,
    url: `${publicOrigin}/hang/${h.id}`,
  };
}
async function readBody(req) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "Skicka JSON.");
  const reader = req.body?.getReader();
  let size = 0;
  const chunks = [];
  if (!reader) fail(400, "Uppgifter saknas.");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      fail(413, "För mycket text.");
    }
    chunks.push(value);
  }
  try {
    const b = JSON.parse(Buffer.concat(chunks).toString());
    if (!b || typeof b !== "object" || Array.isArray(b)) throw Error();
    return b;
  } catch {
    fail(400, "Uppgifterna kunde inte läsas.");
  }
}
export function createHangApi({
  store,
  now = () => Date.now(),
  recipientOnly = false,
  publicOrigin = "",
  allowedOrigin = "",
  rateLimit = 60,
} = {}) {
  async function transact(id, change) {
    for (let i = 0; i < 12; i++) {
      const raw = await store.get(id);
      const current = raw ? JSON.parse(raw) : null;
      const next = change(current);
      if (await store.swap(id, raw, JSON.stringify(next), next.retainUntil))
        return next;
    }
    fail(409, "Flera svar kom samtidigt. Försök igen.");
  }
  return async function handle(req) {
    const reply = (data, status = 200) =>
      Response.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    try {
      const url = new URL(req.url);
      const path = url.pathname
        .replace(/^\/api\/hangs\/?/, "")
        .split("/")
        .filter(Boolean);
      const [id, action] = path;
      const time = now();
      const origin = publicOrigin || url.origin;
      const secret =
        req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
      if (secret && !tokenPattern.test(secret))
        fail(401, "Den här webbläsaren saknar behörighet.");
      if (path.length > 2 || (id && !idPattern.test(id)))
        fail(404, "Hänget finns inte längre.");
      if (req.method === "GET" && id && action === "photo") {
        const raw = await store.get(id);
        if (!raw) fail(404, "Hänget finns inte längre.");
        const h = JSON.parse(raw),
          guest = url.searchParams.get("guest");
        const photo = guest
          ? h.guests.find((g) => g.id === guest)?.photo
          : h.hostPhoto;
        if (!photo) fail(404, "Bilden finns inte längre.");
        return new Response(Buffer.from(photo, "base64"), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex, nofollow",
            "Referrer-Policy": "no-referrer",
          },
        });
      }
      if (req.method === "GET" && id && !action) {
        const raw = await store.get(id);
        if (!raw) fail(404, "Hänget finns inte längre.");
        return reply(view(JSON.parse(raw), secret, time, origin));
      }
      if (req.method !== "POST") fail(405, "Åtgärden stöds inte.");
      // Same-origin browser mutations only; never grant blanket CORS to the guest API.
      if (req.headers.get("origin") !== (allowedOrigin || url.origin))
        fail(403, "Öppna inbjudan i SunSpot och försök igen.");
      if (!id && recipientOnly) fail(403, "Skapa hänget från kartan.");
      const body = await readBody(req);
      token(secret);
      // Shared limits per browser credential and per hang. Creation also has a deployment-wide ceiling.
      const bucket = Math.floor(time / (10 * 60000));
      for (const key of [
        `rate:${hash(secret)}:${bucket}`,
        `rate:${id || "create"}:${bucket}`,
      ]) {
        await transact(key, (old) => {
          const count = (old?.count || 0) + 1;
          if (count > (key.includes(":create:") ? 100 : rateLimit))
            fail(429, "Vänta en stund och försök igen.");
          return { count, retainUntil: time + 20 * 60000 };
        });
      }
      if (!id && !action) {
        const hangId = hash(secret).slice(0, 32);
        const existing = await store.get(hangId);
        if (existing)
          return reply(view(JSON.parse(existing), secret, time, origin));
        if (
          !places.some((p) => p.id === body.placeId) ||
          !activities.includes(body.activity)
        )
          fail(400, "Välj plats och aktivitet.");
        const start =
          body.startsAt === undefined ? time : Number(body.startsAt);
        const duration = Number(body.duration);
        if (
          !Number.isFinite(start) ||
          start < time - 5 * 60000 ||
          start > time + 7 * DAY ||
          ![30, 60, 90, 120, 180].includes(duration)
        )
          fail(400, "Välj en ny tid för hänget.");
        const startsAt = Math.max(start, time),
          endsAt = startsAt + duration * 60000;
        const solar = Number(body.sunUntil);
        const sunAt = Number(body.sunAt);
        const sunValid =
          Number.isFinite(solar) &&
          Number.isFinite(sunAt) &&
          Math.abs(sunAt - startsAt) < 5 * 60000 &&
          solar > startsAt &&
          solar <= sunAt + 180 * 60000 &&
          places.find((p) => p.id === body.placeId).category !== "park";
        const hang = {
          id: hangId,
          host: name(body.host),
          hostPhoto: await normalizeProfilePhoto(body.photo),
          hostHash: hash(secret),
          placeId: body.placeId,
          activity: body.activity,
          startsAt,
          endsAt,
          closed: false,
          guests: [],
          sunAt: sunValid ? sunAt : null,
          sunUntil: sunValid ? solar : null,
          retainUntil: endsAt + DAY,
        };
        const created = await transact(hangId, (old) => old || hang);
        return reply(view(created, secret, time, origin), 201);
      }
      if (!["rsvp", "extend", "close"].includes(action))
        fail(404, "Åtgärden finns inte.");
      const photo =
        action === "rsvp" && body.coming === true
          ? await normalizeProfilePhoto(body.photo)
          : null;
      const updated = await transact(id, (h) => {
        if (!h) fail(404, "Hänget finns inte längre.");
        const identity = hash(secret);
        if (action !== "rsvp" && identity !== h.hostHash)
          fail(403, "Bara värden kan ändra hänget.");
        if (action === "close") {
          h.closed = true;
          return h;
        }
        if (phase(h, now()) === "ended") fail(410, "Hänget är avslutat.");
        if (action === "extend") {
          // Absolute desired end time makes retries idempotent.
          const end = Number(body.endsAt);
          if (
            !Number.isFinite(end) ||
            end < h.endsAt ||
            end > h.startsAt + 6 * HOUR ||
            end > h.endsAt + HOUR
          )
            fail(400, "Hänget kan vara högst sex timmar.");
          h.endsAt = end;
          h.retainUntil = end + DAY;
        } else {
          if (identity === h.hostHash)
            fail(400, "Du är redan värd för hänget.");
          if (typeof body.coming !== "boolean") fail(400, "Välj om du kommer.");
          const other = h.guests.filter((g) => g.hash !== identity);
          if (body.coming) {
            if (other.length >= 50) fail(409, "Hänget är fullt.");
            other.push({
              id: hash(`${id}:${secret}`).slice(0, 16),
              hash: identity,
              name: name(body.name),
              photo,
            });
          }
          h.guests = other;
        }
        return h;
      });
      return reply(view(updated, secret, now(), origin));
    } catch (e) {
      return reply(
        {
          error: e.status
            ? e.message
            : "Det gick inte att nå hänget. Försök igen.",
        },
        e.status || 503,
      );
    }
  };
}
export async function handleHang(req) {
  try {
    const handler = createHangApi({
      store: await hangStore(),
      recipientOnly: process.env.SUNSPOT_RECIPIENT_ONLY === "1",
      publicOrigin: process.env.SUNSPOT_PUBLIC_HANG_ORIGIN,
      allowedOrigin: process.env.SUNSPOT_PUBLIC_ORIGIN,
    });
    return handler(req);
  } catch {
    return Response.json(
      { error: "Häng är inte tillgängliga just nu. Försök igen snart." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
