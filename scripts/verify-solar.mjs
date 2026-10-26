import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const ready = () =>
  page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
const clearWeather = {
  available: true,
  stale: false,
  timeseries: Array.from({ length: 48 }, (_, hour) => ({
    time: new Date(
      Date.parse("2026-09-17T00:00:00Z") + hour * 3600000,
    ).toISOString(),
    data: {
      instant: {
        details: { air_temperature: 18, wind_speed: 3, cloud_area_fraction: 5 },
      },
      next_1_hours: {
        summary: { symbol_code: "clearsky_day" },
        details: { precipitation_amount: 0 },
      },
    },
  })),
};
try {
  // Historical geometry fixture: test the seat/warning independently of the strict defaults.
  await page.clock.setSystemTime(new Date("2026-09-17T12:00:00Z"));
  await page.addInitScript(() => {
    window.testNotifications = [];
    window.Notification = class {
      static permission = "granted";
      static async requestPermission() {
        return "granted";
      }
      constructor(title, options) {
        window.testNotifications.push({ title, options });
      }
    };
  });
  await page.route("**/api/weather", (route) =>
    route.fulfill({ json: clearWeather }),
  );
  await page.goto(process.env.SUNSPOT_URL || "http://localhost:3000", {
    waitUntil: "domcontentloaded",
  });
  await ready();
  await page.getByRole("button", { name: "Öppna filter", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Dölj skugga och osäkert solläge" })
    .uncheck();
  await page
    .getByRole("checkbox", { name: "Bara bekräftat öppet enligt OSM" })
    .uncheck();
  await page
    .getByRole("combobox", { name: "Tid på platsen" })
    .selectOption("30");
  await page
    .getByRole("textbox", { name: "Sök plats eller område" })
    .fill("Ølbaren");
  await page
    .getByRole("button", { name: "Använd filter", exact: true })
    .click();
  await page.getByLabel("Exakt klockslag").fill("16:40");
  await page
    .getByRole("button", { name: "Hitta min plats i solen", exact: true })
    .click();
  await ready();
  await expect(page.locator(".detail-card")).toContainText("Ølbaren");
  await page.getByText("Mer om platsen", { exact: true }).click();
  await page
    .getByRole("button", { name: "Välj min sittplats på kartan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Använd kartans mittpunkt", exact: true })
    .click();
  await ready();
  await expect(page.locator(".detail-card")).toContainText("Din valda punkt");
  const chosen = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("sunspot:seats:v1"))?.["osm-24958713"],
  );
  assert.ok(
    Array.isArray(chosen) && chosen.length === 2,
    "chosen seat is persisted",
  );
  await page
    .getByRole("button", { name: "Bevaka solen här", exact: true })
    .click();
  await expect(page.locator(".solar-watch")).toContainText(
    "Skuggan når din punkt om cirka",
  );
  await expect(page.locator(".next-places button").first()).toBeVisible();
  assert.equal(
    await page.evaluate(() => window.testNotifications.length),
    0,
    "planning never sends a system notification",
  );
  await page.clock.setSystemTime(new Date("2026-09-17T14:40:00Z"));
  await page
    .getByRole("button", { name: "Följ klockan nu", exact: true })
    .click();
  await ready();
  await page.waitForFunction(() => window.testNotifications.length === 1);
  await page
    .getByRole("button", { name: "Tillbaka till kartan", exact: true })
    .click();
  await expect(page.locator(".watch-panel")).toBeHidden();
  await page.clock.setSystemTime(new Date("2026-09-17T14:41:00Z"));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await ready();
  assert.equal(
    await page.evaluate(() => window.testNotifications.length),
    1,
    "same shadow arrival is notified once while minimized",
  );
  await page.locator(".watch-peek").click();
  await page
    .getByRole("button", { name: "Avsluta solbevakning", exact: true })
    .click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready();
  assert.deepEqual(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("sunspot:seats:v1"))?.["osm-24958713"],
    ),
    chosen,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "seat editing",
        "seat persistence after reload",
        "shadow warning and nearby alternatives",
        "no planning notification",
        "live notification",
        "deduplication while minimized",
      ],
    }),
  );
} finally {
  await browser.close();
}
