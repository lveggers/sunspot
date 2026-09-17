import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ready = () =>
  page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
const time = async (hour) => {
  await page.getByRole("slider").fill(String(Math.round(hour * 60)));
  await ready();
};
const filter = async (action) => {
  await page.getByRole("button", { name: "Öppna filter", exact: true }).click();
  await action();
  await page.getByRole("button", { name: "Visa kartan", exact: true }).click();
};
const choose = async (name) => {
  await page
    .getByRole("textbox", { name: "Sök plats eller område" })
    .fill(name);
  await page
    .getByRole("button", { name: "Visa platslista", exact: true })
    .click();
  await page
    .locator(".place-list")
    .getByRole("heading", { name, exact: true })
    .click();
};
try {
  await page.route("**/api/events?**", (route) =>
    route.fulfill({ json: { events: [], available: true, stale: false } }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("sunspot:demo-events", "true"),
  );
  await page.addInitScript(() => localStorage.setItem("sunspot:language", "sv"));
  await page.clock.setSystemTime(new Date("2026-09-16T12:00:00Z"));
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
  await page.goto(process.env.SUNSPOT_URL || "http://localhost:3000", {
    waitUntil: "domcontentloaded",
  });
  await ready();
  await page.locator(".days button").nth(1).click();
  await time(16);
  await choose("Kayak Bar");
  await time(17);
  await expect(
    page.getByRole("button", { name: "Visa Kayak Bar", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".detail-card")).toContainText("I byggnadsskugga");
  await page.getByRole("textbox", { name: "Sök plats eller område" }).fill("");
  await expect(
    page.getByRole("button", { name: "Visa Kongens Have", exact: true }),
  ).toHaveCount(1);
  await filter(() =>
    page
      .getByRole("checkbox", { name: "Dölj skugga och stängda platser" })
      .uncheck(),
  );
  await expect(
    page.getByRole("button", { name: "Visa Kayak Bar", exact: true }),
  ).toHaveCount(1);
  await filter(() =>
    page
      .getByRole("checkbox", { name: "Dölj skugga och stängda platser" })
      .check(),
  );
  await time(16);
  await page.getByRole("button", { name: "Bar", exact: true }).click();
  await choose("Ølbaren");
  await page.getByText("Mer om platsen", { exact: true }).click();
  await page
    .getByRole("button", { name: "Välj min sittplats på kartan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Använd kartans mittpunkt", exact: true })
    .click();
  await ready();
  await expect(page.locator(".detail-card")).toContainText("Din valda punkt");
  assert.ok(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("sunspot:seats:v1"))?.["osm-24958713"],
    ),
  );
  await filter(() =>
    page.getByRole("combobox", { name: "Tid tillsammans" }).selectOption("30"),
  );
  await time(16 + 40 / 60);
  await page
    .getByRole("button", { name: "Bevaka solen här", exact: true })
    .click();
  await expect(page.locator(".solar-watch")).toContainText(
    "Skuggan når din punkt om cirka",
  );
  await expect(page.locator(".next-places button").first()).toBeVisible();
  assert.equal(await page.evaluate(() => window.testNotifications.length), 0);
  await page.clock.setSystemTime(new Date("2026-09-17T14:40:00Z"));
  await page
    .locator(".solar-watch")
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
  assert.equal(await page.evaluate(() => window.testNotifications.length), 1);
  await time(16 + 50 / 60);
  await expect(
    page.getByRole("button", { name: "Visa Ølbaren", exact: true }),
  ).toHaveCount(0);
  await page.locator(".watch-peek").click();
  await expect(page.locator(".solar-watch")).toContainText("I byggnadsskugga");
  await page
    .getByRole("button", { name: "Avsluta solbevakning", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Sök plats eller område" }).fill("");
  for (const hour of [9, 18, 12, 17, 16])
    await page.getByRole("slider").fill(String(hour * 60));
  await ready();
  await time(0);
  await expect(page.locator(".place-pin:not(.event-pin)")).toHaveCount(0);
  await time(16);
  await filter(() =>
    page
      .getByRole("checkbox", { name: "Bara öppet enligt tillgängliga tider" })
      .check(),
  );
  await page
    .getByRole("button", { name: "Visa platslista", exact: true })
    .click();
  await expect(
    page.locator(".place-list").getByText("Öppettider okända", { exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready();
  assert.ok(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("sunspot:seats:v1"))?.["osm-24958713"],
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "shadow filters and partial parks",
        "seat editing and persistence",
        "10-minute warning and alternatives",
        "no planning notification",
        "live notification and deduplication while panel minimized",
        "night and opening filters",
        "rapid slider changes",
        "mobile",
      ],
    }),
  );
} finally {
  await browser.close();
}
