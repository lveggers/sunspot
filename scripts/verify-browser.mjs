import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { places } from "../src/places.js";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const host = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await host.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const ready = () =>
  page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
const slider = () => page.getByRole("slider", { name: "Tid på dagen" });
let gatheringId;
try {
  await page.route("**/api/events?**", (route) =>
    route.fulfill({ json: { events: [], available: true, stale: false } }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("sunspot:demo-events", "true"),
  );
  await page.addInitScript(() => localStorage.setItem("sunspot:language", "sv"));
  await page.clock.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await ready();
  await expect(page.locator(".detail-card")).toHaveCount(0);
  await expect(page.locator(".shadow-legend")).toHaveCount(0);
  await expect(page.getByRole("slider")).toBeVisible();
  await page.screenshot({ path: "artifacts/map-first-desktop.png" });
  await page.getByRole("button", { name: "Om kartan", exact: true }).click();
  await expect(page.locator(".shadow-legend")).toBeVisible();
  await page.getByRole("button", { name: "Om kartan", exact: true }).click();
  await page.getByRole("button", { name: "Öppna filter", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Bara öppet enligt tillgängliga tider" })
    .check();
  await page.getByRole("button", { name: "Visa kartan", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Sök plats eller område" })
    .fill("ingenting");
  await page.getByRole("button", { name: "Alla", exact: true }).click();
  await page
    .getByRole("button", { name: "Visa platslista", exact: true })
    .click();
  await expect(page.locator(".place-list h3")).toHaveCount(places.length);
  await page.keyboard.press("Escape");
  assert.ok(
    (await page.locator(".place-pin:not(.event-pin)").count()) < places.length,
    "city overview groups places",
  );
  for (const [label, category] of [
    ["Bar", "bar"],
    ["Mat", "restaurant"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".venue-focus-veil")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Visa platslista", exact: true })
      .click();
    await expect(page.locator(".place-list h3")).toHaveCount(
      places.filter((p) => p.category === category).length,
    );
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Touchgrass", exact: true }).click();
  await expect(page.locator(".park-focus-outline")).toHaveCount(
    places.filter((p) => p.greenSpace).length,
  );
  await page
    .getByRole("textbox", { name: "Sök plats eller område" })
    .fill("faelledsparken");
  await page
    .getByRole("button", { name: "Visa platslista", exact: true })
    .click();
  await page
    .locator(".place-list")
    .getByRole("heading", { name: "Fælledparken", exact: true })
    .click();
  await expect(page.locator(".detail-card")).toContainText("Fælledparken");
  await page.getByRole("button", { name: "Stäng plats", exact: true }).click();
  await page.getByRole("button", { name: "Alla", exact: true }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.locator(".days button").nth(0).click();
  await slider().fill("895");
  await expect(
    page.getByRole("button", { name: "Visa Måndagshäng · demo", exact: true }),
  ).toHaveCount(0);
  await slider().fill("900");
  await expect(
    page.getByRole("button", { name: "Visa Måndagshäng · demo", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Visa Måndagshäng · demo", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Valt event" })).toContainText(
    "inget verkligt evenemang",
  );
  await page.screenshot({ path: "artifacts/event-desktop.png" });
  await slider().fill("1020");
  await expect(page.locator(".event-pin")).toHaveCount(0);
  await expect(page.locator(".event-card")).toHaveCount(0);
  await slider().fill("960");
  await page.locator(".days button").nth(1).click();
  await slider().fill("960");
  await expect(
    page.getByRole("button", { name: "Visa Måndagshäng · demo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Visa Livemusik · demo", exact: true }),
  ).toHaveCount(1);
  // Invitations use the real server clock; event fixtures above use a fixed Monday.
  await page.clock.setSystemTime(new Date());
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await ready();
  await page.locator(".days button").nth(1).click();
  await slider().fill("960");
  await ready();
  await page.getByRole("button", { name: "Alla", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Sök plats eller område" })
    .fill("Kayak");
  await page
    .getByRole("button", { name: "Visa platslista", exact: true })
    .click();
  await page
    .locator(".place-list")
    .getByRole("heading", { name: "Kayak Bar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ses här med vänner", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Ditt namn", exact: true })
    .fill("Testvärd");
  await page
    .getByRole("button", { name: "Skapa inbjudan", exact: true })
    .click();
  await page.waitForURL("**/invite/**");
  gatheringId = page.url().split("/").at(-1);
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const guest = await guestContext.newPage();
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.addInitScript(() => localStorage.setItem("sunspot:language", "sv"));
  await guest.goto(page.url(), { waitUntil: "domcontentloaded" });
  await guest
    .getByRole("textbox", { name: "Ditt namn", exact: true })
    .fill("Testgäst");
  await guest.getByRole("radio", { name: "Jag kommer", exact: true }).check();
  await guest
    .getByRole("button", { name: "Spara mitt svar", exact: true })
    .click();
  await expect(
    guest.getByText("Ditt svar är sparat.", { exact: false }),
  ).toBeVisible();
  await guest.reload({ waitUntil: "domcontentloaded" });
  await expect(guest.getByText("1 kommer", { exact: true })).toBeVisible();
  await guest.getByRole("radio", { name: "Kanske", exact: true }).check();
  await guest
    .getByRole("button", { name: "Spara mitt svar", exact: true })
    .click();
  await expect(guest.getByText("1 kanske", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Ställ in träffen", exact: true })
    .click();
  await page.getByRole("button", { name: "Ja, ställ in", exact: true }).click();
  await expect(page.getByText("TRÄFFEN ÄR INSTÄLLD")).toBeVisible();
  await page.clock.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await ready();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".detail-card")).toHaveCount(0);
  for (const height of [844, 667]) {
    await page.setViewportSize({ width: 390, height });
    const box = await slider().boundingBox();
    assert.ok(
      box.y + box.height < height && box.y > height / 2,
      "slider stays at bottom of viewport",
    );
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/map-first-mobile.png" });
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page
    .getByRole("button", { name: "Visa platslista", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Livemusik · demo/ })
    .click();
  await expect(page.locator(".event-card")).toBeVisible();
  const eventBox = await page.locator(".event-card").boundingBox(),
    dockBox = await page.locator(".time-dock").boundingBox();
  assert.ok(
    eventBox.y + eventBox.height <= dockBox.y,
    "event detail does not cover time slider",
  );
  await page.screenshot({ path: "artifacts/event-mobile.png" });
  await slider().fill("1140");
  await expect(page.locator(".event-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Öppna filter", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.route("**/data/copenhagen-buildings.json", (r) =>
    r.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Skuggdata kunde inte laddas.", { exact: true }),
  ).toBeVisible();
  // The active demo is outside the initial mobile viewport; discovery still
  // works without shadow data and selecting it brings its marker into view.
  await page.getByRole("button", { name: "Visa veckans event" }).click();
  await page
    .getByRole("dialog", { name: "Event denna vecka" })
    .getByRole("button", { name: /Livemusik · demo/ })
    .click();
  await expect(page.locator(".event-pin")).toHaveCount(1);
  await page.getByRole("button", { name: "Stäng event" }).click();
  await page.unroute("**/data/copenhagen-buildings.json");
  await page.getByRole("button", { name: "Försök igen", exact: true }).click();
  await ready();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "map-first desktop and mobile",
        "compact controls and dismissible details",
        "category focus and filter reset",
        "event start/end and Monday/Tuesday boundaries",
        "event detail removed at expiry",
        "event independent of shadow loading",
        "invitation and independent guest RSVP",
        "host cancellation",
        "small viewport and no overflow",
        "modal keyboard and data retry",
      ],
      gatheringId,
    }),
  );
} finally {
  await browser.close();
}
