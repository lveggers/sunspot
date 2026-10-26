import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApi } from "../server/api.js";

const DEMO_LOGIN = {
  email: "demo@sunspot.local",
  password: "sunspot-local-demo",
};
const offerInput = {
  title: "Test cocktail",
  description: "Synthetic local test offer",
  kind: "cocktail",
  priceDkk: 45.5,
};
const yes = async () => ({
  allowed: true,
  reason: "Sol og åbent nu",
  until: 30,
});

function browser(api) {
  const cookies = new Map();
  return async function request(
    path,
    { method = "GET", body, headers = {} } = {},
  ) {
    const response = await api.handle(
      new Request(`http://localhost:3085/api${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          cookie: [...cookies]
            .map(([key, value]) => `${key}=${value}`)
            .join("; "),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return {
      status: response.status,
      data: await response.json(),
      headers: response.headers,
    };
  };
}

async function createOffer(partner, body = offerInput) {
  const response = await partner("/partner/offers", { method: "POST", body });
  assert.equal(response.status, 201);
  return response.data.offer;
}

test("partner sessions keep credentials private, enforce expiry/logout and share origin/body guards", async (t) => {
  const api = createApi({ development: true, getSunEligibility: yes });
  t.after(() => api.db.close());
  const partner = browser(api);
  assert.equal((await partner("/partner/dashboard")).status, 401);
  assert.equal(
    (
      await partner("/partner/login", {
        method: "POST",
        body: { ...DEMO_LOGIN, password: "wrong" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await partner("/partner/login", {
        method: "POST",
        body: DEMO_LOGIN,
        headers: { origin: "https://elsewhere.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await partner("/partner/login", {
        method: "POST",
        body: { email: "a".repeat(9000), password: "wrong" },
      })
    ).status,
    413,
  );
  const login = await partner("/partner/login", {
    method: "POST",
    body: DEMO_LOGIN,
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.partner.placeId, "osm-335962972");
  assert.equal(login.data.partner.demo, true);
  assert.equal(login.data.partner.password, undefined);
  assert.equal(login.data.partner.password_hash, undefined);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  const sessionToken = cookie.split(";")[0].split("=")[1];
  assert.notEqual(
    api.db.prepare("SELECT token_hash FROM golden_sessions").get().token_hash,
    sessionToken,
  );
  assert.equal((await partner("/partner/dashboard")).status, 200);
  await partner("/partner/logout", { method: "POST" });
  assert.equal((await partner("/partner/dashboard")).status, 401);
  await partner("/partner/login", { method: "POST", body: DEMO_LOGIN });
  api.db
    .prepare("UPDATE golden_sessions SET expires_at = ?")
    .run("2000-01-01T00:00:00.000Z");
  assert.equal((await partner("/partner/dashboard")).status, 401);
});

test("drafts are private, inputs bounded and offer ownership cannot be forged", async (t) => {
  const api = createApi({ development: true, getSunEligibility: yes });
  t.after(() => api.db.close());
  const partner = browser(api),
    guest = browser(api);
  await partner("/partner/login", { method: "POST", body: DEMO_LOGIN });
  assert.deepEqual((await guest("/golden-hour/offers")).data.offers, []);
  assert.equal(
    (await guest("/golden-hour/offers/demo-stefanshus-beer")).status,
    404,
  );
  for (const body of [
    { ...offerInput, title: "" },
    { ...offerInput, kind: "wine" },
    { ...offerInput, priceDkk: "35" },
    { ...offerInput, priceDkk: -1 },
    { ...offerInput, priceDkk: 1.001 },
  ])
    assert.equal(
      (await partner("/partner/offers", { method: "POST", body })).status,
      400,
    );
  const offer = await createOffer(partner);
  assert.equal(offer.state, "draft");
  assert.equal(offer.claimable, false);
  assert.equal(
    (await guest(`/golden-hour/offers/${offer.id}/claim`, { method: "POST" }))
      .status,
    404,
  );
  api.db
    .prepare(
      `INSERT INTO golden_partners SELECT 'other', 'other@sunspot.local', place_id, password_salt, password_hash, 1 FROM golden_partners WHERE id = 'demo-stefanshus'`,
    )
    .run();
  const other = browser(api);
  await other("/partner/login", {
    method: "POST",
    body: { ...DEMO_LOGIN, email: "other@sunspot.local" },
  });
  assert.equal(
    (await other(`/partner/offers/${offer.id}/activate`, { method: "POST" }))
      .status,
    404,
  );
});

test("activation and claims fail closed without actual sun, including changed weather", async (t) => {
  let eligible = false;
  const checked = [];
  const api = createApi({
    development: true,
    getSunEligibility: async (placeId, now) => {
      checked.push({ placeId, now });
      return {
        allowed: eligible,
        reason: "Mulet väder",
        until: eligible ? 20 : 0,
      };
    },
  });
  t.after(() => api.db.close());
  const partner = browser(api),
    guest = browser(api);
  await partner("/partner/login", { method: "POST", body: DEMO_LOGIN });
  const offer = await createOffer(partner);
  const path = `/partner/offers/${offer.id}/activate`;
  assert.equal((await partner(path, { method: "POST" })).status, 409);
  eligible = true;
  const activated = await partner(path, { method: "POST" });
  assert.equal(activated.status, 200);
  assert.equal(activated.data.offer.claimable, true);
  const activeUntil = activated.data.offer.activeUntil;
  assert.equal(
    (await partner(path, { method: "POST" })).data.offer.activeUntil,
    activeUntil,
  );
  assert.equal((await guest("/golden-hour/offers")).data.offers.length, 1);
  eligible = false;
  assert.deepEqual((await guest("/golden-hour/offers")).data.offers, []);
  assert.equal(
    (await guest(`/golden-hour/offers/${offer.id}`)).data.offer.claimable,
    false,
  );
  assert.equal(
    (await guest(`/golden-hour/offers/${offer.id}/claim`, { method: "POST" }))
      .status,
    409,
  );
  assert.ok(
    checked.every(
      (call) => call.placeId === "osm-335962972" && call.now instanceof Date,
    ),
  );
});

test("an API without a server eligibility checker cannot activate an offer", async (t) => {
  const api = createApi({ development: true });
  t.after(() => api.db.close());
  const partner = browser(api);
  await partner("/partner/login", { method: "POST", body: DEMO_LOGIN });
  const offer = await createOffer(partner);
  assert.equal(
    (await partner(`/partner/offers/${offer.id}/activate`, { method: "POST" }))
      .status,
    409,
  );
});

test("slow eligibility checks cannot outlive their confirmed sunlight window", async (t) => {
  let shortWindow = true,
    calls = 0;
  const api = createApi({
    development: true,
    getSunEligibility: async () => {
      calls++;
      if (shortWindow) await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        allowed: true,
        reason: "Sol og åbent",
        until: shortWindow ? 0.0001 : 30,
      };
    },
  });
  t.after(() => api.db.close());
  const partner = browser(api),
    guest = browser(api);
  await partner("/partner/login", { method: "POST", body: DEMO_LOGIN });
  const offer = await createOffer(partner);
  assert.equal(
    (await partner(`/partner/offers/${offer.id}/activate`, { method: "POST" }))
      .status,
    409,
  );
  assert.equal(
    api.db
      .prepare("SELECT active_until FROM golden_offers WHERE id = ?")
      .get(offer.id).active_until,
    null,
  );
  assert.equal((await guest(`/golden-hour/offers/${offer.id}`)).status, 404);
  api.db
    .prepare(
      "UPDATE golden_offers SET active_at = ?, active_until = ? WHERE id = ?",
    )
    .run(
      new Date().toISOString(),
      new Date(Date.now() + 3600_000).toISOString(),
      offer.id,
    );
  assert.deepEqual((await guest("/golden-hour/offers")).data.offers, []);
  const detail = await guest(`/golden-hour/offers/${offer.id}`);
  assert.equal(detail.data.offer.claimable, false);
  assert.equal(detail.data.offer.eligibleUntil, null);
  assert.equal(
    (await partner("/partner/dashboard")).data.eligibility.allowed,
    false,
  );
  const claim = `/golden-hour/offers/${offer.id}/claim`;
  assert.equal((await guest(claim, { method: "POST" })).status, 409);
  assert.equal(
    api.db.prepare("SELECT count(*) AS total FROM golden_vouchers").get().total,
    0,
  );
  shortWindow = false;
  const accepted = await guest(claim, { method: "POST" });
  assert.equal(accepted.status, 201);
  shortWindow = true;
  const checkedBefore = calls;
  const repeated = await guest(claim, { method: "POST" });
  assert.deepEqual(repeated.data.voucher, accepted.data.voucher);
  assert.equal(calls, checkedBefore);
});

test("invalid eligibility durations fail closed and campaign time begins after a valid check", async (t) => {
  let until = 0,
    checkedAt,
    completedAt;
  const api = createApi({
    development: true,
    getSunEligibility: async (_placeId, now) => {
      checkedAt = now.getTime();
      await new Promise((resolve) => setTimeout(resolve, 25));
      completedAt = Date.now();
      return { allowed: true, reason: "Sol og åbent", until };
    },
  });
  t.after(() => api.db.close());
  const partner = browser(api),
    guest = browser(api);
  await partner("/partner/login", { method: "POST", body: DEMO_LOGIN });
  const offer = await createOffer(partner);
  for (until of [0, -1, NaN, Infinity]) {
    assert.equal(
      (
        await partner(`/partner/offers/${offer.id}/activate`, {
          method: "POST",
        })
      ).status,
      409,
    );
    assert.equal(
      api.db
        .prepare("SELECT active_until FROM golden_offers WHERE id = ?")
        .get(offer.id).active_until,
      null,
    );
  }
  until = 30;
  const activated = await partner(`/partner/offers/${offer.id}/activate`, {
    method: "POST",
  });
  assert.equal(activated.status, 200);
  const row = api.db
    .prepare("SELECT active_at, active_until FROM golden_offers WHERE id = ?")
    .get(offer.id);
  assert.ok(Date.parse(row.active_at) >= completedAt);
  assert.equal(
    Date.parse(row.active_until) - Date.parse(row.active_at),
    3600_000,
  );
  const detail = await guest(`/golden-hour/offers/${offer.id}`);
  assert.equal(
    Date.parse(detail.data.offer.eligibleUntil),
    checkedAt + until * 60000,
  );
  until = Infinity;
  assert.equal(
    (await guest(`/golden-hour/offers/${offer.id}/claim`, { method: "POST" }))
      .status,
    409,
  );
});

test("voucher expiry is one immutable hour and repeated or concurrent claims cannot reset it", async (t) => {
  const api = createApi({ development: true, getSunEligibility: yes });
  t.after(() => api.db.close());
  const partner = browser(api),
    guest = browser(api);
  await partner("/partner/login", { method: "POST", body: DEMO_LOGIN });
  const offer = await createOffer(partner);
  await partner(`/partner/offers/${offer.id}/activate`, { method: "POST" });
  api.db
    .prepare("UPDATE golden_offers SET active_until = ? WHERE id = ?")
    .run(new Date(Date.now() + 30000).toISOString(), offer.id);
  await guest(`/golden-hour/offers/${offer.id}`);
  const claim = `/golden-hour/offers/${offer.id}/claim`;
  const [first, concurrent] = await Promise.all([
    guest(claim, { method: "POST" }),
    guest(claim, { method: "POST" }),
  ]);
  const voucher = first.data.voucher;
  assert.equal(first.status, 201);
  assert.equal(concurrent.data.voucher.id, voucher.id);
  assert.equal(
    Date.parse(voucher.expiresAt) - Date.parse(voucher.claimedAt),
    3600_000,
  );
  assert.ok(Date.parse(voucher.expiresAt) > Date.now() + 3500_000);
  assert.equal(
    api.db.prepare("SELECT count(*) AS total FROM golden_vouchers").get().total,
    1,
  );
  assert.equal(
    (await guest(`/golden-hour/vouchers/${voucher.id}`)).data.voucher.expiresAt,
    voucher.expiresAt,
  );
  api.db
    .prepare("UPDATE golden_vouchers SET expires_at = ? WHERE id = ?")
    .run("2000-01-01T00:00:00.000Z", voucher.id);
  const repeated = await guest(claim, { method: "POST" });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.data.voucher.id, voucher.id);
  assert.equal(repeated.data.voucher.expiresAt, "2000-01-01T00:00:00.000Z");
  assert.equal(
    (
      await partner(`/partner/vouchers/${voucher.id}/redeem`, {
        method: "POST",
      })
    ).status,
    410,
  );
});

test("redemption is partner-owned and atomic, and expired campaigns cannot issue new vouchers", async (t) => {
  const api = createApi({ development: true, getSunEligibility: yes });
  t.after(() => api.db.close());
  const partner = browser(api),
    guest = browser(api);
  await partner("/partner/login", { method: "POST", body: DEMO_LOGIN });
  const offer = await createOffer(partner);
  await partner(`/partner/offers/${offer.id}/activate`, { method: "POST" });
  const claimed = await guest(`/golden-hour/offers/${offer.id}/claim`, {
    method: "POST",
  });
  const voucherId = claimed.data.voucher.id;
  const redemption = `/partner/vouchers/${voucherId}/redeem`;
  assert.equal(
    (await browser(api)(redemption, { method: "POST" })).status,
    401,
  );
  api.db
    .prepare(
      `INSERT INTO golden_partners SELECT 'other', 'other@sunspot.local', place_id, password_salt, password_hash, 1 FROM golden_partners WHERE id = 'demo-stefanshus'`,
    )
    .run();
  const other = browser(api);
  await other("/partner/login", {
    method: "POST",
    body: { ...DEMO_LOGIN, email: "other@sunspot.local" },
  });
  assert.equal((await other(redemption, { method: "POST" })).status, 404);
  const redemptions = await Promise.all([
    partner(redemption, { method: "POST" }),
    partner(redemption, { method: "POST" }),
  ]);
  assert.deepEqual(
    redemptions.map((result) => result.status).sort(),
    [200, 409],
  );
  assert.ok(
    (await guest(`/golden-hour/vouchers/${voucherId}`)).data.voucher.redeemedAt,
  );
  api.db
    .prepare("UPDATE golden_offers SET active_until = ? WHERE id = ?")
    .run("2000-01-01T00:00:00.000Z", offer.id);
  assert.equal(
    (
      await browser(api)(`/golden-hour/offers/${offer.id}/claim`, {
        method: "POST",
      })
    ).status,
    409,
  );
  assert.equal(
    (await partner(`/partner/offers/${offer.id}/activate`, { method: "POST" }))
      .status,
    409,
  );
});

test("production rejects persisted development accounts, sessions, offers and vouchers", async () => {
  const directory = mkdtempSync(join(tmpdir(), "sunspot-golden-hour-"));
  const database = join(directory, "test.sqlite");
  let api = createApi({ database, development: true, getSunEligibility: yes });
  try {
    const partner = browser(api),
      guest = browser(api);
    const login = await partner("/partner/login", {
      method: "POST",
      body: DEMO_LOGIN,
    });
    const authCookie = login.headers.get("set-cookie").split(";")[0];
    const offer = await createOffer(partner);
    await partner(`/partner/offers/${offer.id}/activate`, { method: "POST" });
    const claimed = await guest(`/golden-hour/offers/${offer.id}/claim`, {
      method: "POST",
    });
    api.db.close();
    api = createApi({ database, development: false, getSunEligibility: yes });
    const production = browser(api);
    assert.equal(
      (await production("/partner/login", { method: "POST", body: DEMO_LOGIN }))
        .status,
      401,
    );
    assert.equal(
      (
        await production("/partner/dashboard", {
          headers: { cookie: authCookie },
        })
      ).status,
      401,
    );
    assert.deepEqual((await production("/golden-hour/offers")).data.offers, []);
    assert.equal(
      (await production(`/golden-hour/offers/${offer.id}`)).status,
      404,
    );
    assert.equal(
      (await production(`/golden-hour/vouchers/${claimed.data.voucher.id}`))
        .status,
      404,
    );
  } finally {
    api.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
