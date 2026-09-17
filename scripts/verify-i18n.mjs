import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const errors = [];
try {
  const context = await browser.newContext({
    locale: "en-GB",
    viewport: { width: 390, height: 844 },
    storageState: process.env.SUNSPOT_STORAGE_STATE || undefined,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setSystemTime(new Date("2026-09-17T14:00:00Z"));
  await page.route("**/api/events?**", (r) =>
    r.fulfill({ json: { events: [], available: true, stale: false } }),
  );
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const ready = () =>
    page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  await ready();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator(".days button").nth(1).click();
  await page.getByRole("slider").fill("960");
  await page.getByRole("button", { name: "Bar", exact: true }).click();
  await page.getByRole("button", { name: "Open filters", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("da");
  await expect(page.locator("html")).toHaveAttribute("lang", "da");
  await expect(
    page.getByRole("combobox", { name: "Sprog", exact: true }),
  ).toHaveValue("da");
  await page.keyboard.press("Escape");
  await ready();
  await expect(page.locator(".days button").nth(1)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("slider")).toHaveValue("960");
  await expect(
    page.getByRole("button", { name: "Bar", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/language-danish-map.png" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "da");
  await page.getByRole("button", { name: "Åbn filtre", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sprog", exact: true })
    .selectOption("sv");
  await expect(
    page.getByRole("combobox", { name: "Språk", exact: true }),
  ).toHaveValue("sv");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Öppna filter", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Språk", exact: true })
    .selectOption("en");
  await page.screenshot({ path: "artifacts/language-english-filters.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search places or areas").fill("Too Old");
  await page
    .getByRole("button", { name: "Show place list", exact: true })
    .click();
  await page.locator(".place-list h3").first().click();
  await expect(page.locator(".detail-card")).toContainText(
    "Estimated seating point",
  );
  await page.getByText("More about this place", { exact: true }).click();
  await expect(page.locator(".place-more")).toContainText("2026-09-17");
  await page.screenshot({ path: "artifacts/language-english-place.png" });
  await page.getByRole("button", { name: "Close place", exact: true }).click();
  await page.getByRole("button", { name: "Sun near me", exact: true }).click();
  await page.getByRole("button", { name: "Nørrebro", exact: true }).click();
  await expect(page.locator(".nearby-context")).toContainText("area centre");
  await page.screenshot({ path: "artifacts/language-english-nearby.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 667 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const pill = await page.locator(".nearby-launch").boundingBox(),
    dock = await page.locator(".time-dock").boundingBox();
  assert.ok(pill.y + pill.height <= dock.y);
  await context.close();
  const danish = await browser.newContext({
    locale: "da-DK",
    storageState: process.env.SUNSPOT_STORAGE_STATE || undefined,
  });
  const fresh = await danish.newPage();
  await fresh.goto(base, { waitUntil: "domcontentloaded" });
  await expect(
    fresh.getByRole("button", { name: "Åbn filtre", exact: true }),
  ).toBeVisible();
  await expect(fresh.locator("html")).toHaveAttribute("lang", "da");
  await danish.close();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "browser default",
        "Danish/Swedish/English switching",
        "preserved day/time/category",
        "persisted preference",
        "localized place evidence",
        "localized nearby area",
        "small mobile layout",
        "fresh Danish browser",
      ],
      errors,
    }),
  );
} finally {
  await browser.close();
}
