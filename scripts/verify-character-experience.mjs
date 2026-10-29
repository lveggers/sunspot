import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { verifyOpeningMotion, openingForecast, openingOffer, openingTime, assertOpeningControls, assertCharacterScope, assertOpeningBackdrop } from "./verify-character-motion.mjs";

const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 360, height: 640 }, timezoneId: "Europe/Copenhagen", reducedMotion: "reduce" });
await context.addCookies([{ name: "sunspot-language", value: "da", url: base }]);
let page;
const errors = [];
let mode = "sun", offers = [], heldWeather;
await context.route("**/api/weather", (route) => {
  if (mode === "loading") { heldWeather = route; return; }
  return route.fulfill({ json: openingForecast(mode) });
});
await context.route("**/api/golden-hour/offers", (route) => route.fulfill({ json: { offers, serverNow: openingTime } }));
const checks = [];
async function freshPage(at = openingTime) {
  await page?.close();
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setSystemTime(new Date(at));
}
async function open(nextMode, expected, kind, at = openingTime) {
  mode = nextMode;
  offers = kind ? [openingOffer(kind)] : [];
  if (kind === "beer") offers[0].demo = true;
  await freshPage(at);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  await expect(page.locator(".opening-theatre")).toHaveAttribute("data-scene", expected);
  await assertOpeningControls(page);
  await assertCharacterScope(page);
  assert.equal(await page.locator(".opening-theatre").evaluate((node) => node.getAnimations({ subtree: true }).length), 0, "reduced motion starts no decorative animation");
  await expect(page.locator(".opening-theatre .cast-character")).toHaveCount(1);
  checks.push([nextMode, kind || "none", expected]);
}
try {
  await mkdir("artifacts", { recursive: true });
  await open("sun", "opening.sun");
  await expect(page.locator(".opening-theatre .lucide-sun")).toHaveCount(1);
  await page.screenshot({ path: "artifacts/opening-sun-mobile.png" });
  for (const kind of ["beer", "cocktail"]) {
    await open("sun", "opening.golden-hour", kind);
    await expect(page.locator(`.opening-theatre [data-pose='${kind}-seated']`)).toHaveCount(1);
    if (kind === "beer") await expect(page.locator(".opening-demo")).toHaveText("LOKALT DEMOTILBUD · IKKE ET RIGTIGT TILBUD");
    await page.screenshot({ path: `artifacts/opening-${kind}-mobile.png` });
  }
  for (const nextMode of ["cloud", "rain", "missing", "stale", "unknown"]) {
    await open(nextMode, "opening.no-sun", "beer");
    await expect(page.locator(".opening-theatre .lucide-sun")).toHaveCount(0);
    await expect(page.locator(".opening-theatre [data-pose='beer-seated'], .opening-theatre [data-pose='cocktail-seated']")).toHaveCount(0);
    await expect(page.locator(".opening-demo")).toHaveCount(0);
    await expect(page.locator(".sun-focus-color-pane")).toHaveAttribute("data-active-count", "0");
    if (["missing", "stale", "unknown"].includes(nextMode)) await expect(page.locator(".opening-weather-prop")).toHaveCount(0);
    if (nextMode === "cloud") {
      await expect(page.locator(".opening-theatre .lucide-cloud")).toHaveCount(1);
      await page.screenshot({ path: "artifacts/opening-cloud-mobile.png" });
      await page.locator(".finder-toggle").click();
      await expect(page.locator(".opening-theatre")).toHaveCount(0);
      await assertOpeningBackdrop(page, false);
    }
  }
  await open("sun", "opening.no-sun", "beer", "2026-10-27T22:00:00Z");
  await expect(page.locator(".opening-theatre .lucide-moon")).toHaveCount(1);
  mode = "loading";
  await freshPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await expect.poll(() => Boolean(heldWeather)).toBe(true);
  await expect(page.locator(".opening-theatre .cast-character")).toHaveCount(0);
  await expect(page.locator(".finder-submit")).toBeDisabled();
  mode = "sun";
  await heldWeather.fulfill({ json: openingForecast(mode) });
  heldWeather = undefined;
  await expect(page.locator(".opening-theatre")).toHaveAttribute("data-scene", "opening.golden-hour", { timeout: 20000 });
  assert.deepEqual(errors, []);
  await context.close();
  const motionChecks = await verifyOpeningMotion(browser, base);
  console.log(JSON.stringify({ passed: true, checks, motionChecks, facts: ["three opening cases only", "no drink/sun signal for uncertain weather", "computed-visible copy and unobstructed mobile CTA", "opening consumed after first search"] }));
} finally {
  await heldWeather?.abort().catch(() => {});
  await browser.close();
}
