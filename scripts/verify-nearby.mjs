import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  storageState: process.env.SUNSPOT_STORAGE_STATE || undefined,
  permissions: ["geolocation"],
  geolocation: { longitude: 12.5558, latitude: 55.6919, accuracy: 30 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ready = () =>
  page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
try {
  await page.addInitScript(() => localStorage.setItem("sunspot:language", "sv"));
  await page.clock.setSystemTime(new Date("2026-09-17T14:00:00Z"));
  await page.addInitScript(() => {
    window.locationRequests = 0;
    const locate = navigator.geolocation.getCurrentPosition.bind(
      navigator.geolocation,
    );
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition(success, failure, options) {
          window.locationRequests++;
          if (window.gpsDenied) failure({ code: 1 });
          else locate(success, failure, options);
        },
      },
    });
  });
  await page.route("**/api/events?**", (r) =>
    r.fulfill({ json: { events: [], available: true, stale: false } }),
  );
  await page.goto(process.env.SUNSPOT_URL || "http://localhost:3000", {
    waitUntil: "domcontentloaded",
  });
  await ready();
  await expect(page.locator(".days button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Exakt klockslag")).toHaveValue("16:00");
  await expect(
    page.getByRole("button", { name: "Nu", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  assert.equal(await page.evaluate(() => window.locationRequests), 0);
  await page.locator(".days button").nth(2).click();
  await page.getByRole("slider").fill("1439");
  await ready();
  await expect(page.getByLabel("Exakt klockslag")).toHaveValue("23:59");
  await expect(page.locator(".days button").nth(2)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Nu", exact: true }).click();
  await ready();
  await expect(page.getByLabel("Exakt klockslag")).toHaveValue("16:00");
  await expect(page.locator(".days button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Sol nära mig", exact: true }).click();
  assert.equal(await page.evaluate(() => window.locationRequests), 0);
  await page
    .getByRole("button", { name: "Använd min position & tid nu" })
    .click();
  await ready();
  await expect(page.locator(".nearby-context")).toContainText("din position");
  await expect(page.locator(".nearby-result").first()).toBeVisible();
  const count = await page.locator(".nearby-result").count();
  assert.ok(count > 0 && count <= 3);
  await expect(page.locator(".nearby-result").first()).toContainText(
    "efter ankomst",
  );
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/nearby-mobile.png" });
  await page.locator(".nearby-result").first().click();
  await expect(page.locator(".detail-card")).toBeVisible();
  await page.getByRole("button", { name: "Stäng plats", exact: true }).click();
  await page.getByRole("button", { name: "Sol nära mig", exact: true }).click();
  await page.evaluate(() => {
    window.gpsDenied = true;
  });
  await page
    .getByRole("button", { name: "Använd min position & tid nu" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Platsdelning är avstängd",
  );
  await page.getByRole("button", { name: "Nørrebro", exact: true }).click();
  await expect(page.locator(".nearby-context")).toContainText("områdesmitt");
  await expect(page.locator(".nearby-result").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Alla", exact: true }).click();
  await page.getByLabel("Sök plats eller område").fill("Too Old");
  await page
    .getByRole("button", { name: "Visa platslista", exact: true })
    .click();
  await page.locator(".place-list h3").first().click();
  await expect(page.locator(".place-confidence")).toContainText(
    "Uteservering beskriven av stället",
  );
  await expect(page.locator(".place-confidence")).toContainText(
    "Uppskattad sittpunkt",
  );
  await page.getByText("Mer om platsen", { exact: true }).click();
  await expect(page.locator(".place-more")).toContainText("2026-09-17");
  await page.getByRole("button", { name: "Stäng plats", exact: true }).click();
  await page.getByRole("button", { name: "Alla", exact: true }).click();
  await page.clock.setSystemTime(new Date("2026-09-17T22:01:00Z"));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await ready();
  await expect(page.getByLabel("Exakt klockslag")).toHaveValue("00:01");
  await expect(page.locator(".days button").first()).toContainText("18");
  await page.getByRole("button", { name: "Sol nära mig", exact: true }).click();
  await page.getByRole("button", { name: "Nørrebro", exact: true }).click();
  await expect(page.locator(".nearby-results")).toContainText(
    "Inga matchande platser",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 667 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const pill = await page.locator(".nearby-launch").boundingBox(),
    dock = await page.locator(".time-dock").boundingBox();
  assert.ok(
    pill.y + pill.height <= dock.y,
    "nearby action leaves timeline visible",
  );
  await page.screenshot({ path: "artifacts/daily-timeline-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      count,
      checks: [
        "today and live start",
        "independent day/time and Nu",
        "GPS only after user action",
        "three arrival-aware recommendations",
        "permission denial and manual area",
        "explicit evidence and unverified point",
        "midnight rollover",
        "night empty state",
        "small mobile",
      ],
    }),
  );
} finally {
  await browser.close();
}
