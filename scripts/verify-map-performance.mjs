import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const errors = [];
const ready = async (page) => {
  await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  await page.locator('.building-shadows[data-pending="false"]').waitFor();
};
const checksum = (page) =>
  page.locator(".building-shadows").evaluate((canvas) => {
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619);
    return {
      hash,
      alpha: Array.from(pixels).filter((_, i) => i % 4 === 3),
      width: canvas.width,
      height: canvas.height,
      mode: canvas.dataset.mode,
      buildings: canvas.dataset.buildings,
    };
  });
async function open(fallback = false) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    storageState: process.env.SUNSPOT_STORAGE_STATE || undefined,
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("sunspot:language", "sv"));
  await page.clock.setSystemTime(new Date("2026-09-17T12:00:00Z"));
  if (fallback)
    await page.addInitScript(() => {
      window.OffscreenCanvas = undefined;
    });
  await page.route("**/api/events?**", (r) =>
    r.fulfill({ json: { events: [], available: true, stale: false } }),
  );
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await ready(page);
  await page.locator(".days button").nth(1).click();
  await page.getByRole("slider").fill("960");
  await ready(page);
  return page;
}
try {
  await mkdir("artifacts", { recursive: true });
  const page = await open();
  await expect(page.locator(".building-shadows")).toHaveAttribute(
    "data-renderer",
    "worker",
  );
  const pixels = await checksum(page);
  const markerCount = await page.locator(".place-pin").count();
  assert.ok(
    markerCount > 0 && markerCount < 35,
    `quiet mobile overview: ${markerCount} markers`,
  );
  await expect(page.locator(".cluster-pin").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zooma in", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Kartverktyg", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Zooma in", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kartverktyg", exact: true }).click();
  await page.screenshot({ path: "artifacts/quiet-map-mobile.png" });
  // A comparison of the same frame also checks the fallback's geometry and coverage.
  const fallback = await open(true);
  await expect(fallback.locator(".building-shadows")).toHaveAttribute(
    "data-renderer",
    "main",
  );
  const fallbackPixels = await checksum(fallback);
  const differences = pixels.alpha.map((v, i) =>
    Math.abs(v - fallbackPixels.alpha[i]),
  );
  const rasterDifference = {
    averageAlpha: differences.reduce((a, b) => a + b, 0) / differences.length,
    significantPixels:
      differences.filter((v) => v > 8).length / differences.length,
  };
  console.log(JSON.stringify({ rasterDifference }));
  assert.equal(fallbackPixels.buildings, pixels.buildings);
  assert.equal(fallbackPixels.mode, pixels.mode);
  assert.equal(fallbackPixels.width, pixels.width);
  assert.equal(fallbackPixels.height, pixels.height);
  assert.ok(
    rasterDifference.averageAlpha < 1 &&
      rasterDifference.significantPixels < 0.005,
    "worker/fallback coverage agrees within canvas anti-aliasing tolerance",
  );
  await fallback.close();
  const cluster = page.locator(".cluster-pin").first();
  const previousZoom = Number(
    await page.locator(".building-shadows").getAttribute("data-zoom"),
  );
  await cluster.click();
  await ready(page);
  assert.ok(
    Number(await page.locator(".building-shadows").getAttribute("data-zoom")) >
      previousZoom,
    "cluster opens at a closer zoom",
  );
  // Every park remains discoverable, even if offscreen or grouped.
  await page.getByRole("button", { name: "Alla", exact: true }).click();
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
  await expect(
    page.getByRole("button", { name: "Visa Fælledparken", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".detail-card")).toContainText("Fælledparken");
  await page.getByRole("button", { name: "Stäng plats", exact: true }).click();
  await page.getByRole("button", { name: "Alla", exact: true }).click();
  await ready(page);
  // Observe main-thread responsiveness while dispatching real React range inputs.
  const metrics = await page.evaluate(async () => {
    const durations = [];
    const observer = new PerformanceObserver((list) =>
      durations.push(...list.getEntries().map((e) => e.duration)),
    );
    observer.observe({ type: "longtask", buffered: false });
    const slider = document.querySelector("#time");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    for (let i = 0; i < 45; i++) {
      setter.call(slider, 600 + i * 10);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
    }
    await new Promise((r) => setTimeout(r, 500));
    observer.disconnect();
    return {
      longTasks: durations.length,
      longTaskMs: Math.round(durations.reduce((a, b) => a + b, 0)),
    };
  });
  await ready(page);
  await expect(page.locator(".building-shadows")).toHaveAttribute(
    "data-instant",
    "2026-09-18T15:20:00.000Z",
  );
  await page.getByRole("slider", { name: "Tid på dagen" }).fill("0");
  await ready(page);
  await expect(page.locator(".building-shadows")).toHaveAttribute(
    "data-mode",
    "night",
  );
  await page.setViewportSize({ width: 390, height: 667 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const dock = await page.locator(".time-dock").boundingBox();
  assert.ok(dock.y + dock.height <= 667);
  assert.deepEqual(errors, []);
  const report = {
    passed: true,
    markerCount,
    ...metrics,
    checks: [
      "viewport culling and grouping",
      "search and selection",
      "mobile tools",
      "worker/fallback shadow coverage",
      "latest slider frame",
      "night and small viewport",
    ],
  };
  await writeFile(
    "artifacts/map-performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
