import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { formatOfferPrice } from "../src/offerExperience.js";
import { assertCharacterScope } from "./verify-character-motion.mjs";

const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const copy = {
  da: {
    language: "Sprog", find: "Find min plads i solen", near: "Nær mig", today: "I dag",
    claim: "Hent min kupon · 1 time", code: "Kuponkode", locale: "da-DK",
    locationError: "Vælg et område manuelt, eller tillad adgang til din position.",
    openFields: "Vælg sted og tid",
  },
  en: {
    language: "Language", find: "Find my spot in the sun", near: "Near me", today: "Today",
    claim: "Get my voucher · 1 hour", code: "Voucher code", locale: "en-GB",
    locationError: "Choose an area manually or allow access to your location.",
    openFields: "Choose place and time",
  },
  sv: {
    language: "Språk", find: "Hitta min plats i solen", near: "Nära mig", today: "Idag",
    claim: "Hämta min kupong · 1 timme", code: "Kupongkod", locale: "sv-SE",
    locationError: "Välj ett område manuellt eller tillåt åtkomst till din plats.",
    openFields: "Välj plats och tid",
  },
};
const browser = await chromium.launch({ executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  locale: "en-US",
  timezoneId: "Europe/Copenhagen",
});
const page = await context.newPage();
const errors = [];
const unexpectedMutations = [];
const mutations = { claims: 0, rsvp: 0, login: 0 };
page.on("pageerror", (error) => errors.push(error.message));
const now = "2026-10-28T11:00:00Z";
const offer = {
  id: "language-offer", placeId: "osm-335962972", placeName: "Café Stefanshus",
  title: "Language fixture beer", description: "Synthetic test offer", kind: "beer", priceDkk: 123.5,
  state: "active", claimable: true, demo: true, activeUntil: "2026-10-28T12:00:00Z", eligibleUntil: "2026-10-28T11:30:00Z",
};
const voucher = {
  ...offer, id: "language-voucher", offerId: offer.id, claimedAt: now,
  expiresAt: "2026-10-28T12:00:00Z", redeemedAt: null,
};
const invitation = {
  id: "language-invite", host: "Ida", activity: "bar", startsAt: "2026-10-29T12:30:00Z", duration: 90,
  message: "This user message must remain unchanged.", cancelled: false, isHost: false, answers: [],
  counts: { yes: 0, maybe: 0, no: 0 },
  place: { id: offer.placeId, name: offer.placeName, meeting: "Synthetic meeting point", category: "bar" },
};
const weather = {
  available: true, stale: false,
  timeseries: Array.from({ length: 192 }, (_, hour) => ({
    time: new Date(Date.parse("2026-10-28T00:00:00Z") + hour * 3600000).toISOString(),
    data: {
      instant: { details: { air_temperature: 14, wind_speed: 2, cloud_area_fraction: 5 } },
      next_1_hours: { summary: { symbol_code: "clearsky_day" }, details: { precipitation_amount: 0 } },
    },
  })),
};
await context.route("**/api/**", async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const respond = (body, status = 200) => route.fulfill({ status, json: { ...body, serverNow: now } });
  if (path === "/api/weather") return respond(weather);
  if (path === "/api/golden-hour/offers") return respond({ offers: [offer] });
  if (path === `/api/golden-hour/offers/${offer.id}`) return respond({ offer, eligibilityReason: "" });
  if (path === `/api/golden-hour/offers/${offer.id}/claim`) {
    mutations.claims += 1;
    return respond({ voucher }, 201);
  }
  if (path === `/api/golden-hour/vouchers/${voucher.id}`) return respond({ voucher });
  if (path === `/api/gatherings/${invitation.id}`) return respond(invitation);
  if (path === `/api/gatherings/${invitation.id}/rsvp`) {
    mutations.rsvp += 1;
    assert.deepEqual(request.postDataJSON(), { name: "Freja", answer: "maybe" });
    return respond({ error: "Synthetic RSVP rejection", code: "error.rsvpInvalid" }, 400);
  }
  if (path === "/api/partner/dashboard") return respond({ error: "Synthetic sign-in required", code: "error.loginRequired" }, 401);
  if (path === "/api/partner/login") {
    mutations.login += 1;
    return respond({ error: "Synthetic invalid credentials", code: "error.credentials" }, 401);
  }
  if (request.method() !== "GET") {
    unexpectedMutations.push(path);
    return respond({ error: "Unexpected test mutation" }, 500);
  }
  return route.continue();
});
await page.clock.setSystemTime(new Date(now));
await page.addInitScript(() => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (_success, failure) => failure({ code: 1 }) },
  });
});
const languageSelect = async () => {
  const dialog = page.getByRole("dialog");
  const scope = await dialog.count() ? dialog.last() : page;
  return scope.getByRole("combobox", { name: /^(Sprog|Language|Språk)$/ }).last();
};
const setLanguage = async (language) => {
  await (await languageSelect()).selectOption(language);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(await languageSelect()).toHaveAccessibleName(copy[language].language);
};
const assertFinderCopy = async (language) => {
  await expect(page.locator(".finder-submit")).toHaveAccessibleName(copy[language].find);
  if (await page.locator(".nearby-button").isVisible()) await expect(page.locator(".nearby-button")).toHaveAccessibleName(copy[language].near);
  else await expect(page.locator(".finder-toggle")).toHaveAccessibleName(copy[language].openFields);
  await expect(page.locator(".finder-date-time select option").first()).toContainText(copy[language].today);
};
const finderValues = () => page.evaluate(() => ({
  district: document.querySelector("#district").value,
  day: document.querySelector(".finder-date-time select").value,
  time: document.querySelector('input[type="time"]').value,
  categories: [...document.querySelectorAll(".finder-types [data-category]")].map((button) => [button.dataset.category, button.getAttribute("aria-pressed")]),
}));
const money = (language) => {
  const value = formatOfferPrice(offer.priceDkk, language);
  assert.ok(value.includes(language === "da" ? "kr." : "DKK"), `${language} identifies Danish kroner`);
  assert.match(value, /123[,.]5(?:\D|$)/, `${language} preserves the actual decimal price`);
  return value;
};
const assertInviteDate = (language) => expect(page.locator(".invite-facts p").first()).toHaveText(
  new Intl.DateTimeFormat(copy[language].locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Copenhagen" }).format(new Date(invitation.startsAt)),
);

try {
  await mkdir("artifacts", { recursive: true });
  assert.equal((await context.cookies(base)).find((cookie) => cookie.name === "sunspot-language"), undefined);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  await expect(page.locator("html")).toHaveAttribute("lang", "da");
  await expect(await languageSelect()).toHaveAccessibleName("Sprog");
  assert.deepEqual(await (await languageSelect()).locator("option").evaluateAll((options) => options.map((option) => [option.value, option.textContent])), [["da", "Dansk"], ["en", "English"], ["sv", "Svenska"]]);
  await assertFinderCopy("da");
  await page.locator(".finder-toggle").click();
  await page.locator("#district").selectOption("Nørrebro");
  await page.locator(".finder-date-time select").selectOption("2026-10-29");
  await page.locator('input[type="time"]').fill("13:15");
  await page.locator('.finder-types [data-category="restaurant"]').click();
  await page.locator(".nearby-button").click();
  const locationNotice = page.locator('.finder-notice[data-reason="empty.location"]');
  await expect(locationNotice).toHaveText(copy.da.locationError);
  const values = await finderValues();
  for (const language of ["en", "sv"]) {
    await setLanguage(language);
    await assertFinderCopy(language);
    assert.deepEqual(await finderValues(), values, "language changes preserve the chosen place, date, time and categories");
    await expect(locationNotice).toHaveText(copy[language].locationError);
    await page.screenshot({ path: `artifacts/language-finder-${language}.png` });
  }
  assert.equal(mutations.claims, 0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  assert.equal((await context.cookies(base)).find((cookie) => cookie.name === "sunspot-language")?.value, "sv");

  await page.goto(`${base}/?offer=${offer.id}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.locator(".golden-price")).toHaveText(money("sv"));
  await expect(page.locator(".golden-offer-detail .cast-character")).toHaveCount(0);
  await setLanguage("en");
  await expect(page.locator(".golden-price")).toHaveText(money("en"));
  await setLanguage("da");
  await page.setViewportSize({ width: 390, height: 667 });
  await expect(page.getByRole("button", { name: copy.da.claim, exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: "artifacts/language-offer-da-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setLanguage("en");
  await page.getByRole("button", { name: copy.en.claim, exact: true }).click();
  await expect(page.getByRole("textbox", { name: copy.en.code, exact: true })).toHaveValue(voucher.id);
  assert.equal(mutations.claims, 1);
  await setLanguage("da");
  await expect(page.getByRole("textbox", { name: copy.da.code, exact: true })).toHaveValue(voucher.id);
  await expect(page.locator(".golden-voucher .cast-character")).toHaveCount(0);
  await expect(page.locator(".golden-voucher-summary")).toContainText(money("da"));
  assert.equal(mutations.claims, 1, "switching an open voucher does not claim another voucher");

  await page.goto(`${base}/voucher/${voucher.id}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "da");
  await expect(page.getByRole("textbox", { name: copy.da.code, exact: true })).toHaveValue(voucher.id);
  await setLanguage("en");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("textbox", { name: copy.en.code, exact: true })).toHaveValue(voucher.id);
  assert.equal(mutations.claims, 1);

  await page.goto(`${base}/invite/${invitation.id}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await assertInviteDate("en");
  await expect(page.locator("blockquote")).toHaveText(invitation.message);
  await expect(page.locator(".invite-page .cast-character")).toHaveCount(0);
  await page.locator("#guest-name").fill("Freja");
  await page.locator('input[name="answer"][value="maybe"]').check();
  await page.locator(".rsvp-form button.primary").click();
  const inviteError = page.locator(".invite-card").getByRole("alert");
  await expect(inviteError).toHaveText("Enter your name and choose a response.");
  await setLanguage("sv");
  await assertInviteDate("sv");
  await expect(page.locator("blockquote")).toHaveText(invitation.message);
  await expect(page.locator("#guest-name")).toHaveValue("Freja");
  await expect(page.getByRole("radio", { name: "Kanske", exact: true })).toBeChecked();
  await expect(inviteError).toHaveText("Ange ditt namn och välj ett svar.");
  await setLanguage("da");
  await assertInviteDate("da");
  await expect(inviteError).toHaveText("Angiv dit navn, og vælg et svar.");
  assert.equal(mutations.rsvp, 1, "language changes do not resubmit a failed RSVP");

  await page.goto(`${base}/partner`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "da");
  await page.locator("#partner-email").fill("language@example.test");
  await page.locator("#partner-password").fill("synthetic-language-password");
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
  const partnerError = page.locator(".partner-page").getByRole("alert");
  await expect(partnerError).toBeVisible();
  await expect(partnerError).toHaveText("Forkert e-mail eller adgangskode.");
  await expect(page.locator(".partner-page .cast-character")).toHaveCount(0);
  await page.locator("#partner-password").fill("synthetic-language-password");
  await setLanguage("sv");
  await expect(page.locator("#partner-email")).toHaveValue("language@example.test");
  await expect(page.locator("#partner-password")).toHaveValue("synthetic-language-password");
  await expect(partnerError).toHaveText("Fel e-post eller lösenord.");
  assert.equal(mutations.login, 1, "language changes do not repeat a failed sign-in");

  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 390, height: 667 });
  await setLanguage("en");
  await expect(page.locator(".finder-submit")).toHaveAccessibleName(copy.en.find);
  await expect(page.locator(".finder-submit")).toBeInViewport({ ratio: 1 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "English mobile controls fit the viewport");
  assert.equal(mutations.claims, 1);
  await assertCharacterScope(page);
  assert.deepEqual(unexpectedMutations, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, mutations, checks: ["Danish default independent of browser locale", "Danish/English/Swedish labels, aria, dates and DKK prices", "cookie persists across reload and partner/invite/voucher navigation", "open finder values and errors survive language changes", "open voucher and failed RSVP/login survive changes without extra mutations", "English mobile search remains visible"] }));
} finally {
  await browser.close();
}
