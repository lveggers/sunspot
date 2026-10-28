import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { places } from "../src/places.js";

const HOUR = 3600_000;
const SESSION_SECONDS = 8 * 3600;
const token = () => randomBytes(32).toString("base64url");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const text = (value, max) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= max;
const cookieValue = (request, name) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

export function createGoldenHourApi({
  db,
  getSunEligibility,
  development,
  readBody,
  json,
}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS golden_partners (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, place_id TEXT NOT NULL,
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS golden_sessions (
      token_hash TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES golden_partners(id), expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS golden_offers (
      id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES golden_partners(id),
      title TEXT NOT NULL, description TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('beer','cocktail')),
      price_ore INTEGER NOT NULL CHECK(price_ore > 0 AND price_ore <= 100000),
      created_at TEXT NOT NULL, active_at TEXT, active_until TEXT
    );
    CREATE TABLE IF NOT EXISTS golden_vouchers (
      id TEXT PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES golden_offers(id), visitor_hash TEXT NOT NULL,
      claimed_at TEXT NOT NULL, expires_at TEXT NOT NULL, redeemed_at TEXT,
      UNIQUE(offer_id, visitor_hash)
    );
  `);
  db.prepare("DELETE FROM golden_sessions WHERE expires_at <= ?").run(
    new Date().toISOString(),
  );
  if (development) {
    const salt = randomBytes(16).toString("hex");
    db.prepare(
      "INSERT OR IGNORE INTO golden_partners VALUES (?, ?, ?, ?, ?, 1)",
    ).run(
      "demo-stefanshus",
      "demo@sunspot.local",
      "osm-335962972",
      salt,
      scryptSync("sunspot-local-demo", salt, 64).toString("hex"),
    );
    db.prepare(
      "INSERT OR IGNORE INTO golden_offers VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)",
    ).run(
      "demo-stefanshus-beer",
      "demo-stefanshus",
      "Demo · Golden hour-öl",
      "Lokalt testtilbud. Ikke et rigtigt tilbud fra Café Stefanshus.",
      "beer",
      3500,
      new Date().toISOString(),
    );
  }
  const dummySalt = randomBytes(16).toString("hex");
  const dummyHash = scryptSync(token(), dummySalt, 64);
  const respond = (body, status = 200, extra = {}) =>
    json({ ...body, serverNow: new Date().toISOString() }, status, extra);
  const fail = (message, status, code = "common.error", params = {}) => respond({ error: message, code, params }, status);
  const cookie = (name, value, maxAge) =>
    `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${development ? "" : "; Secure"}`;
  const visitor = (request) => {
    const existing = cookieValue(request, "sunspot_visitor");
    const value = /^[A-Za-z0-9_-]{43}$/.test(existing || "")
      ? existing
      : token();
    return {
      hash: hash(value),
      headers:
        existing === value
          ? {}
          : { "Set-Cookie": cookie("sunspot_visitor", value, 30 * 86400) },
    };
  };
  const partnerView = (partner) => ({
    id: partner.id,
    email: partner.email,
    placeId: partner.place_id,
    placeName:
      places.find((place) => place.id === partner.place_id)?.name ||
      "Okänd plats",
    demo: Boolean(partner.demo),
  });
  const offerQuery = `SELECT o.*, p.place_id, p.demo FROM golden_offers o JOIN golden_partners p ON p.id = o.partner_id`;
  const voucherQuery = `SELECT v.*, o.partner_id, o.title, o.kind, o.price_ore, p.place_id, p.demo
    FROM golden_vouchers v JOIN golden_offers o ON o.id = v.offer_id JOIN golden_partners p ON p.id = o.partner_id`;
  const currentPartner = (request) => {
    const session = cookieValue(request, "sunspot_partner");
    if (!session) return null;
    const partner = db
      .prepare(
        `SELECT p.* FROM golden_sessions s JOIN golden_partners p ON p.id = s.partner_id WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(hash(session), new Date().toISOString());
    return partner && (development || !partner.demo) ? partner : null;
  };
  const allowedDemo = (row) => row && (development || !row.demo);
  const checkSun = async (placeId) => {
    const checkedAt = new Date();
    const eligibility = await getSunEligibility(placeId, checkedAt);
    const deadline =
      eligibility.allowed &&
      Number.isFinite(eligibility.until) &&
      eligibility.until > 0
        ? checkedAt.getTime() + eligibility.until * 60000
        : 0;
    return {
      ...eligibility,
      deadline: Number.isFinite(new Date(deadline).getTime()) ? deadline : 0,
    };
  };
  const currentSun = (checked, now = Date.now()) => {
    const allowed = Boolean(checked && now < checked.deadline);
    return {
      allowed,
      reason:
        !allowed && checked?.allowed
          ? "Sol og åbningstid skal kontrolleres igen. Prøv en gang til."
          : checked?.reason || "Sol og åbningstid kan ikke bekræftes lige nu.",
      reasonCode: !allowed && checked?.allowed ? "error.sunRecheck" : checked?.reasonCode || (allowed ? "eligibility.confirmed" : "error.sunUnconfirmed"),
      params: checked?.params || {},
      until: allowed ? (checked.deadline - now) / 60000 : 0,
    };
  };
  const offerView = (row, checked) => {
    const now = Date.now(),
      eligibility = currentSun(checked, now);
    return {
      id: row.id,
      placeId: row.place_id,
      placeName:
        places.find((place) => place.id === row.place_id)?.name ||
        "Okänd plats",
      title: row.title,
      description: row.description,
      kind: row.kind,
      priceDkk: row.price_ore / 100,
      state: !row.active_until
        ? "draft"
        : Date.parse(row.active_until) > now
          ? "active"
          : "expired",
      activeUntil: row.active_until,
      eligibleUntil: eligibility.allowed
        ? new Date(checked.deadline).toISOString()
        : null,
      claimable: Boolean(
        row.active_until &&
          Date.parse(row.active_until) > now &&
          eligibility.allowed,
      ),
      demo: Boolean(row.demo),
    };
  };
  const voucherView = (row) => ({
    id: row.id,
    offerId: row.offer_id,
    placeId: row.place_id,
    placeName:
      places.find((place) => place.id === row.place_id)?.name || "Okänd plats",
    title: row.title,
    kind: row.kind,
    priceDkk: row.price_ore / 100,
    claimedAt: row.claimed_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
    demo: Boolean(row.demo),
  });

  return async function handleGoldenHour(request, path, method) {
    if (
      !path.startsWith("/api/golden-hour/") &&
      !path.startsWith("/api/partner/")
    )
      return null;
    const now = new Date();
    if (path === "/api/partner/login") {
      if (method !== "POST") return fail("Metoden stöds inte.", 405, "error.method");
      const { email, password } = await readBody(request);
      if (!text(email, 254) || !text(password, 200))
        return fail("Fel e-post eller lösenord.", 401, "error.credentials");
      const partner = db
        .prepare("SELECT * FROM golden_partners WHERE email = ?")
        .get(email.trim().toLowerCase());
      const candidate = scryptSync(
        password,
        partner?.password_salt || dummySalt,
        64,
      );
      const expected = partner
        ? Buffer.from(partner.password_hash, "hex")
        : dummyHash;
      if (!timingSafeEqual(candidate, expected) || !allowedDemo(partner))
        return fail("Fel e-post eller lösenord.", 401, "error.credentials");
      const session = token();
      db.prepare("INSERT INTO golden_sessions VALUES (?, ?, ?)").run(
        hash(session),
        partner.id,
        new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString(),
      );
      return respond({ partner: partnerView(partner) }, 200, {
        "Set-Cookie": cookie("sunspot_partner", session, SESSION_SECONDS),
      });
    }
    if (path === "/api/partner/logout") {
      if (method !== "POST") return fail("Metoden stöds inte.", 405, "error.method");
      const session = cookieValue(request, "sunspot_partner");
      if (session)
        db.prepare("DELETE FROM golden_sessions WHERE token_hash = ?").run(
          hash(session),
        );
      return respond({ ok: true }, 200, {
        "Set-Cookie": cookie("sunspot_partner", "", 0),
      });
    }
    if (path.startsWith("/api/partner/")) {
      const partner = currentPartner(request);
      if (!partner) return fail("Logga in som partner för att fortsätta.", 401, "error.loginRequired");
      if (path === "/api/partner/dashboard") {
        if (method !== "GET") return fail("Metoden stöds inte.", 405, "error.method");
        const checked = await checkSun(partner.place_id);
        const offers = db
          .prepare(
            `${offerQuery} WHERE o.partner_id = ? ORDER BY o.created_at DESC LIMIT 100`,
          )
          .all(partner.id);
        const vouchers = db
          .prepare(
            `${voucherQuery} WHERE o.partner_id = ? ORDER BY v.claimed_at DESC LIMIT 100`,
          )
          .all(partner.id);
        return respond({
          partner: partnerView(partner),
          offers: offers.map((row) => offerView(row, checked)),
          vouchers: vouchers.map(voucherView),
          eligibility: currentSun(checked),
        });
      }
      if (path === "/api/partner/offers") {
        if (method !== "POST") return fail("Metoden stöds inte.", 405, "error.method");
        const { title, description, kind, priceDkk } = await readBody(request);
        const price =
          typeof priceDkk === "number" ? Math.round(priceDkk * 100) : NaN;
        if (
          !text(title, 80) ||
          !text(description, 300) ||
          !["beer", "cocktail"].includes(kind) ||
          !Number.isFinite(priceDkk) ||
          priceDkk <= 0 ||
          priceDkk > 1000 ||
          Math.abs(priceDkk * 100 - price) > 0.000001
        )
          return fail(
            "Ange titel, beskrivning, öl eller cocktail och ett pris mellan 0,01 och 1000 DKK (högst två decimaler).",
            400,
            "error.offerInvalid",
          );
        const id = token();
        db.prepare(
          "INSERT INTO golden_offers VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)",
        ).run(
          id,
          partner.id,
          title.trim(),
          description.trim(),
          kind,
          price,
          now.toISOString(),
        );
        const row = db.prepare(`${offerQuery} WHERE o.id = ?`).get(id);
        return respond({ offer: offerView(row) }, 201);
      }
      const activation =
        /^\/api\/partner\/offers\/([A-Za-z0-9_-]+)\/activate$/.exec(path);
      if (activation) {
        if (method !== "POST") return fail("Metoden stöds inte.", 405, "error.method");
        const row = db
          .prepare(`${offerQuery} WHERE o.id = ? AND o.partner_id = ?`)
          .get(activation[1], partner.id);
        if (!row) return fail("Tilbuddet kunne ikke findes.", 404, "error.offerNotFound");
        const checked = await checkSun(row.place_id),
          eligibility = currentSun(checked);
        if (!eligibility.allowed)
          return fail(
            eligibility.reason ||
              "Tilbud kan kun aktiveres, når stedet er åbent og har sol nu.",
            409,
            eligibility.reasonCode || "error.activationUnavailable",
            eligibility.params,
          );
        const activatedAt = new Date();
        if (
          row.active_until &&
          Date.parse(row.active_until) <= activatedAt.getTime()
        )
          return fail("Kampagnen er afsluttet. Opret et nyt tilbud.", 409, "error.offerExpired");
        if (!row.active_until) {
          row.active_at = activatedAt.toISOString();
          row.active_until = new Date(
            activatedAt.getTime() + HOUR,
          ).toISOString();
          db.prepare(
            "UPDATE golden_offers SET active_at = ?, active_until = ? WHERE id = ? AND active_until IS NULL AND unixepoch('subsec') * 1000 < ?",
          ).run(row.active_at, row.active_until, row.id, checked.deadline);
        }
        const active = db.prepare(`${offerQuery} WHERE o.id = ?`).get(row.id);
        if (!active.active_until) {
          const current = currentSun(checked);
          return fail(current.reason, 409, current.reasonCode, current.params);
        }
        return respond({ offer: offerView(active, checked) });
      }
      const redemption =
        /^\/api\/partner\/vouchers\/([A-Za-z0-9_-]+)\/redeem$/.exec(path);
      if (redemption) {
        if (method !== "POST") return fail("Metoden stöds inte.", 405, "error.method");
        const row = db
          .prepare(`${voucherQuery} WHERE v.id = ? AND o.partner_id = ?`)
          .get(redemption[1], partner.id);
        if (!row) return fail("Kuponen kunne ikke findes.", 404, "error.voucherNotFound");
        if (row.redeemed_at) return fail("Kuponen er allerede indløst.", 409, "error.voucherRedeemed");
        if (Date.parse(row.expires_at) <= now.getTime())
          return fail("Kuponen er udløbet.", 410, "error.voucherExpired");
        const changed = db
          .prepare(
            "UPDATE golden_vouchers SET redeemed_at = ? WHERE id = ? AND redeemed_at IS NULL AND expires_at > ?",
          )
          .run(now.toISOString(), row.id, now.toISOString());
        if (!changed.changes)
          return fail("Kuponen kan ikke længere indløses.", 409, "error.voucherUnavailable");
        row.redeemed_at = now.toISOString();
        return respond({ voucher: voucherView(row) });
      }
      return fail("Sidan finns inte.", 404, "error.notFound");
    }
    if (path === "/api/golden-hour/offers") {
      if (method !== "GET") return fail("Metoden stöds inte.", 405, "error.method");
      const identity = visitor(request);
      const rows = db
        .prepare(
          `${offerQuery} WHERE o.active_until > ? ORDER BY o.active_at DESC LIMIT 50`,
        )
        .all(now.toISOString())
        .filter(allowedDemo);
      const eligibility = new Map();
      for (const row of rows) {
        if (!eligibility.has(row.place_id))
          eligibility.set(row.place_id, await checkSun(row.place_id));
      }
      const offers = rows
        .map((row) => offerView(row, eligibility.get(row.place_id)))
        .filter((offer) => offer.claimable);
      return respond({ offers }, 200, identity.headers);
    }
    const offerMatch =
      /^\/api\/golden-hour\/offers\/([A-Za-z0-9_-]+)(\/claim)?$/.exec(path);
    if (offerMatch) {
      const claiming = Boolean(offerMatch[2]);
      if (method !== (claiming ? "POST" : "GET"))
        return fail("Metoden stöds inte.", 405, "error.method");
      const row = db.prepare(`${offerQuery} WHERE o.id = ?`).get(offerMatch[1]);
      if (!allowedDemo(row) || !row.active_until)
        return fail("Tilbuddet kunne ikke findes.", 404, "error.offerNotFound");
      const identity = visitor(request);
      if (claiming) {
        const previous = db
          .prepare(
            `${voucherQuery} WHERE v.offer_id = ? AND v.visitor_hash = ?`,
          )
          .get(row.id, identity.hash);
        if (previous)
          return respond(
            { voucher: voucherView(previous) },
            200,
            identity.headers,
          );
      }
      const checked = await checkSun(row.place_id),
        eligibility = currentSun(checked);
      const offer = offerView(row, checked);
      if (!claiming)
        return respond(
          {
            offer,
            eligibilityReason: offer.claimable
              ? ""
              : !eligibility.allowed
                ? eligibility.reason
                : "Kampagnen er afsluttet.",
            eligibilityCode: offer.claimable ? "" : !eligibility.allowed ? eligibility.reasonCode : "error.campaignFinished",
            eligibilityParams: !eligibility.allowed ? eligibility.params : {},
          },
          200,
          identity.headers,
        );
      if (!offer.claimable)
        return fail(
          !eligibility.allowed ? eligibility.reason : "Kampagnen er afsluttet.",
          409,
          !eligibility.allowed ? eligibility.reasonCode : "error.campaignFinished",
          eligibility.params,
        );
      const id = token(),
        claimedAt = new Date();
      const inserted = db
        .prepare(
          `INSERT INTO golden_vouchers
        SELECT ?, ?, ?, ?, ?, NULL WHERE EXISTS
          (SELECT 1 FROM golden_offers WHERE id = ? AND active_until > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          AND unixepoch('subsec') * 1000 < ?
        ON CONFLICT(offer_id, visitor_hash) DO NOTHING`,
        )
        .run(
          id,
          row.id,
          identity.hash,
          claimedAt.toISOString(),
          new Date(claimedAt.getTime() + HOUR).toISOString(),
          row.id,
          checked.deadline,
        );
      const voucher = db
        .prepare(`${voucherQuery} WHERE v.offer_id = ? AND v.visitor_hash = ?`)
        .get(row.id, identity.hash);
      if (!voucher) {
        const current = currentSun(checked);
        return fail(
          current.allowed
            ? "Kampagnen er afsluttet."
            : current.reason,
          409,
          current.allowed ? "error.campaignFinished" : current.reasonCode,
          current.params,
        );
      }
      return respond(
        { voucher: voucherView(voucher) },
        inserted.changes ? 201 : 200,
        identity.headers,
      );
    }
    const voucherMatch =
      /^\/api\/golden-hour\/vouchers\/([A-Za-z0-9_-]+)$/.exec(path);
    if (voucherMatch) {
      if (method !== "GET") return fail("Metoden stöds inte.", 405, "error.method");
      const row = db
        .prepare(`${voucherQuery} WHERE v.id = ?`)
        .get(voucherMatch[1]);
      if (!allowedDemo(row)) return fail("Kuponen kunne ikke findes.", 404, "error.voucherNotFound");
      return respond({ voucher: voucherView(row) });
    }
    return fail("Sidan finns inte.", 404, "error.notFound");
  };
}
