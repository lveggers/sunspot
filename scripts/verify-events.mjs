import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { curatedEvents } from "../src/curatedEvents.js";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const event = curatedEvents[0];
try {
  await page.addInitScript(() => localStorage.setItem("sunspot:language", "sv"));
  await page.clock.setSystemTime(new Date("2026-09-16T12:00:00Z"));
  await page.route("**/api/events?**", (route) =>
    route.fulfill({ json: { events: [event], available: true, stale: false } }),
  );
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Visa veckans event" }),
  ).toContainText("0 event nu");
  await expect(page.locator(".event-pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Visa veckans event" }).click();
  await page
    .getByRole("dialog", { name: "Event denna vecka" })
    .getByRole("button", { name: /Food Circularity/ })
    .click();
  const card = page.getByRole("dialog", { name: "Valt event" });
  await expect(card.getByRole("heading", { name: event.name })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stäng event" })).toBeFocused();
  const close = await page
    .getByRole("button", { name: "Stäng event" })
    .boundingBox();
  assert.ok(
    await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest("button")
          ?.getAttribute("aria-label") === "Stäng event",
      { x: close.x + 10, y: close.y + 10 },
    ),
    "close button is not hidden beneath map toolbar",
  );
  const box = await card.boundingBox(),
    dock = await page.locator(".time-dock").boundingBox();
  assert.ok(box.y + box.height <= dock.y, "details leave timeline usable");
  await expect(
    card.getByRole("link", { name: /Se event & anmälan/ }),
  ).toHaveAttribute("href", event.sourceUrl);
  await expect(card).toContainText("Program");
  await expect(card).toContainText("18:00");
  await expect(card).toContainText("19:00");
  await card.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: "artifacts/event-sheet-mobile.png" });
  await card.getByRole("heading", { name: "Program" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/event-sheet-program.png" });
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await page
    .getByRole("button", { name: `Visa ${event.name}`, exact: true })
    .click();
  await expect(card).toBeVisible();
  await page
    .getByRole("slider", { name: "Tid på dagen" })
    .fill(String(18 * 60));
  await expect(card).toHaveCount(0);
  await expect(page.locator(".event-pin")).toHaveCount(0);
  // Weekly discovery includes upcoming events even when no marker is active.
  await page.getByRole("button", { name: "Visa veckans event" }).click();
  await page
    .getByRole("dialog", { name: "Event denna vecka" })
    .getByRole("button", { name: /Food Circularity/ })
    .click();
  await expect(page.getByLabel("Exakt klockslag")).toHaveValue("14:00");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/event-sheet-desktop.png" });
  await page.locator(".days button").nth(2).click();
  await page.getByRole("slider").fill(String(14 * 60));
  await expect(page.locator(".event-pin")).toHaveCount(0);
  await page.unroute("**/api/events?**");
  await page.route("**/api/events?**", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Visa veckans event" }),
  ).toContainText("Eventkälla saknas");
  await expect(page.locator(".event-pin")).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "rich event detail and public registration link",
        "weekly discovery jumps to event time",
        "mobile close control and timeline remain usable",
        "description and agenda",
        "Escape and map marker reopen",
        "event expiry and next day",
        "source failure never becomes demo data",
        "desktop and mobile",
      ],
    }),
  );
} finally {
  await browser.close();
}
