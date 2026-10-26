import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// UI contract fixtures; server authorization and solar checks have separate Node regressions.
const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let serverTime = Date.parse("2026-10-27T11:00:00Z");
const iso = () => new Date(serverTime).toISOString();
const place = {
  placeId: "osm-335962972",
  placeName: "Café Stefanshus",
  demo: true,
};
const makeOffer = (id, kind) => ({
  ...place,
  id,
  kind,
  title: `Demo ${kind}`,
  description: "Synthetic browser regression offer, not a real business offer.",
  priceDkk: 10,
  state: "active",
  activeUntil: "2026-10-27T12:00:00Z",
  eligibleUntil: "2026-10-27T11:30:00Z",
  claimable: true,
});
const offers = [
  makeOffer("fixture-beer", "beer"),
  makeOffer("fixture-cocktail", "cocktail"),
];
const voucher = {
  ...place,
  id: "fixture-voucher",
  offerId: offers[0].id,
  title: offers[0].title,
  kind: "beer",
  priceDkk: 10,
  claimedAt: iso(),
  expiresAt: "2026-10-27T12:00:00Z",
  redeemedAt: null,
};
let claimed = false;
let authenticated = false;
let eligibility = { allowed: false, reason: "Moln i prognosen", until: 0 };
let partnerOffers = [];
let partnerVouchers = [{ ...voucher }];
await context.addInitScript(() => {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: async (data) => {
      window.lastShare = data;
    },
  });
});
await context.route("**/api/**", async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const method = request.method();
  let status = 200;
  let body;
  if (path === "/api/weather") body = { available: false };
  else if (path === "/api/golden-hour/offers") body = { offers };
  else if (path === "/api/golden-hour/vouchers/fixture-voucher")
    body = { voucher };
  else if (path === "/api/golden-hour/offers/fixture-beer/claim") {
    claimed = true;
    body = { voucher };
    status = 201;
  } else if (path.startsWith("/api/golden-hour/offers/fixture-"))
    body = {
      offer: offers.find((offer) => path.endsWith(offer.id)),
      eligibilityReason: "",
    };
  else if (path === "/api/partner/login") {
    authenticated = true;
    body = {
      partner: { ...place, id: "fixture-partner", email: "demo@sunspot.local" },
    };
  } else if (path === "/api/partner/logout") {
    authenticated = false;
    body = { ok: true };
  } else if (!authenticated && path.startsWith("/api/partner/")) {
    status = 401;
    body = { error: "Logga in som partner för att fortsätta." };
  } else if (path === "/api/partner/dashboard")
    body = {
      partner: { ...place, id: "fixture-partner", email: "demo@sunspot.local" },
      offers: partnerOffers,
      vouchers: partnerVouchers,
      eligibility,
    };
  else if (path === "/api/partner/offers" && method === "POST") {
    const input = request.postDataJSON();
    assert.equal(input.priceDkk, 10);
    const offer = {
      ...place,
      ...input,
      id: "fixture-new",
      state: "draft",
      claimable: false,
      activeUntil: null,
      eligibleUntil: null,
    };
    partnerOffers = [offer];
    body = { offer };
    status = 201;
  } else if (path.endsWith("/fixture-new/activate")) {
    assert.equal(eligibility.allowed, true);
    partnerOffers = [
      {
        ...partnerOffers[0],
        state: "active",
        claimable: true,
        activeUntil: "2026-10-27T12:00:00Z",
      },
    ];
    body = { offer: partnerOffers[0] };
  } else if (path.endsWith("/fixture-voucher/redeem")) {
    partnerVouchers = [{ ...partnerVouchers[0], redeemedAt: iso() }];
    body = { voucher: partnerVouchers[0] };
  } else {
    await route.continue();
    return;
  }
  await route.fulfill({ status, json: { ...body, serverNow: iso() } });
});
try {
  await mkdir("artifacts", { recursive: true });
  await page.clock.setSystemTime(new Date(serverTime));
  await page.goto(`${base}/?offer=fixture-beer`, {
    waitUntil: "domcontentloaded",
  });
  const detail = page.getByRole("dialog", {
    name: "Din golden hour",
    exact: true,
  });
  await expect(detail.getByText("Demo beer", { exact: true })).toBeVisible();
  await expect(detail.locator(".golden-offer-art.beer svg")).toBeVisible();
  await expect(detail.locator(".golden-demo")).toBeVisible();
  await page
    .getByRole("button", { name: "Dela erbjudandet med vänner" })
    .click();
  const share = await page.evaluate(() => window.lastShare);
  assert.equal(share.url, `${base}/?offer=fixture-beer`);
  await page.screenshot({ path: "artifacts/golden-hour-offer.png" });
  await page
    .getByRole("button", { name: "Hämta min kupong · 1 timme" })
    .click();
  await expect(
    page.getByRole("timer", { name: "Tid kvar på kupongen" }),
  ).toHaveText(/^(60:00|59:\d{2})$/);
  assert.equal(claimed, true);
  await expect(
    page.getByRole("textbox", { name: "Kupongkod", exact: true }),
  ).toHaveValue(voucher.id);
  await page.clock.setSystemTime(new Date("2099-01-01T00:00:00Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("timer", { name: "Tid kvar på kupongen" }),
  ).toHaveText(/^(60:00|59:\d{2})$/);
  serverTime += 15 * 60_000;
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("timer", { name: "Tid kvar på kupongen" }),
  ).toHaveText(/^(45:00|44:\d{2})$/);
  await page.setViewportSize({ width: 390, height: 667 });
  await page.screenshot({ path: "artifacts/golden-hour-voucher-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  serverTime = Date.parse(voucher.expiresAt) + 1000;
  await page.goto(`${base}/voucher/${voucher.id}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("timer", { name: "Tid kvar på kupongen" }),
  ).toHaveText("Tiden har gått ut");
  serverTime = Date.parse("2026-10-27T11:00:00Z");
  voucher.redeemedAt = iso();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("timer", { name: "Tid kvar på kupongen" }),
  ).toHaveText("Inlöst");
  await page.goto(`${base}/?offer=fixture-cocktail`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".golden-offer-art.cocktail svg")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("blocked for regression");
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "Dela erbjudandet med vänner" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Länk till erbjudandet" }),
  ).toHaveValue(`${base}/?offer=fixture-cocktail`);

  await page.goto(`${base}/partner`, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Fyll i lokal demoinloggning" })
    .click();
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(page.locator(".partner-place h2")).toHaveText(place.placeName);
  await page.locator("#offer-title").fill("Demo browser cocktail");
  await page
    .locator("#offer-description")
    .fill("Synthetic browser regression draft");
  await page
    .getByRole("combobox", { name: "Dryck", exact: true })
    .selectOption("cocktail");
  await page.getByRole("spinbutton", { name: "Pris i DKK" }).fill("10");
  await page.getByRole("button", { name: "Spara utkast" }).click();
  await expect(
    page.getByRole("button", { name: "Aktivera golden hour" }),
  ).toBeDisabled();
  eligibility = { allowed: true, reason: "Öppet och sol", until: 30 };
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    page.getByRole("button", { name: "Aktivera golden hour" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Aktivera golden hour" }).click();
  await expect(page.locator(".partner-offer .golden-state")).toContainText(
    "AKTIVT",
  );
  await page.locator("#redeem-id").fill(voucher.id);
  await page
    .locator(".partner-redeem")
    .getByRole("button", { name: "Lös in", exact: true })
    .click();
  await expect(page.locator(".partner-voucher-list button")).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/golden-hour-partner.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Logga ut", exact: true }).click();
  await expect(page.locator("#partner-email")).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "offer deep links and drink artwork",
        "public offer sharing",
        "immutable server-anchored countdown and reload",
        "expiry and redeemed states",
        "mobile voucher",
        "clipboard denial fallback",
        "partner login/draft/solar block/activate/redeem/logout",
      ],
    }),
  );
} finally {
  await browser.close();
}
