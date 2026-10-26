import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const errors = [];
const expandFinder = async (target) => {
  const toggle = target.getByRole("button", {
    name: "Vælg sted og tid",
    exact: true,
  });
  if (await toggle.isVisible()) await toggle.click();
};

const clearWeather = {
  available: true,
  stale: false,
  timeseries: Array.from({ length: 24 * 8 }, (_, hour) => ({
    time: new Date(
      Date.parse("2026-10-27T00:00:00Z") + hour * 3600000,
    ).toISOString(),
    data: {
      instant: {
        details: { air_temperature: 14, wind_speed: 3, cloud_area_fraction: 5 },
      },
      next_1_hours: {
        summary: { symbol_code: "clearsky_day" },
        details: { precipitation_amount: 0 },
      },
    },
  })),
};
const ready = async (page) => {
  await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  await page.locator('.building-shadows[data-pending="false"]').waitFor();
};
const checksum = (page) =>
  page.locator(".building-shadows").evaluate((canvas) => {
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    return {
      alpha: Array.from(pixels).filter((_, index) => index % 4 === 3),
      width: canvas.width,
      height: canvas.height,
      mode: canvas.dataset.mode,
      buildings: canvas.dataset.buildings,
    };
  });
const view = (page) =>
  page.locator(".building-shadows").evaluate((canvas) => ({
    zoom: canvas.dataset.zoom,
    canvas: canvas.style.transform,
    pane: canvas.closest(".leaflet-map-pane").style.transform,
  }));
async function open(fallback = false) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setSystemTime(new Date("2026-10-27T11:00:00Z"));
  if (fallback)
    await page.addInitScript(() => {
      window.OffscreenCanvas = undefined;
    });
  await page.route("**/api/weather", (route) =>
    route.fulfill({ json: clearWeather }),
  );
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await ready(page);
  return page;
}
async function filters(page, action) {
  await page.getByRole("button", { name: "Öppna filter", exact: true }).click();
  await action();
  await page
    .getByRole("button", { name: "Använd filter", exact: true })
    .click();
  await ready(page);
}
try {
  await mkdir("artifacts", { recursive: true });
  const page = await open();
  await expect(page.locator(".place-pin")).toHaveCount(0);
  await expect(page.locator(".building-shadows")).toHaveAttribute(
    "data-renderer",
    "worker",
  );
  const pixels = await checksum(page);
  const fallback = await open(true);
  await expect(fallback.locator(".building-shadows")).toHaveAttribute(
    "data-renderer",
    "main",
  );
  const fallbackPixels = await checksum(fallback);
  const differences = pixels.alpha.map((value, index) =>
    Math.abs(value - fallbackPixels.alpha[index]),
  );
  const rasterDifference = {
    averageAlpha:
      differences.reduce((sum, value) => sum + value, 0) / differences.length,
    significantPixels:
      differences.filter((value) => value > 8).length / differences.length,
  };
  for (const key of ["buildings", "mode", "width", "height"])
    assert.equal(fallbackPixels[key], pixels[key]);
  assert.ok(
    rasterDifference.averageAlpha < 1 &&
      rasterDifference.significantPixels < 0.005,
    "worker/fallback geometry agrees within canvas anti-aliasing tolerance",
  );
  await fallback.close();
  await page
    .getByRole("button", { name: "Hitta min plats i solen", exact: true })
    .click();
  await ready(page);
  const markerCount = await page.locator(".place-pin").count();
  assert.ok(
    markerCount > 0 && markerCount <= 8,
    `bounded result pins: ${markerCount}`,
  );
  await expect(page.locator(".venue-focus-veil")).toHaveCount(1);
  await expect(page.locator(".park-focus-outline")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Zooma in", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Kartverktyg", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Zooma in", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kartverktyg", exact: true }).click();
  await page.screenshot({ path: "artifacts/finder-map-mobile.png" });

  // Opt out of availability for a deterministic geometry fixture, then focus one park.
  await filters(page, async () => {
    await page
      .getByRole("checkbox", { name: "Dölj skugga och osäkert solläge" })
      .uncheck();
    await page
      .getByRole("checkbox", { name: "Bara bekräftat öppet enligt OSM" })
      .uncheck();
    await page
      .getByRole("textbox", { name: "Sök plats eller område" })
      .fill("faelledsparken");
  });
  await page
    .getByRole("button", { name: "Ändra sökning", exact: true })
    .click();
  await expandFinder(page);
  await page.getByRole("button", { name: "Bar", exact: true }).click();
  await page.getByRole("button", { name: "Mat", exact: true }).click();
  await page
    .getByRole("button", { name: "Hitta min plats i solen", exact: true })
    .click();
  await ready(page);
  await expect(page.locator(".detail-card")).toContainText("Fælledparken");
  await expect(page.locator(".park-focus-outline")).toHaveCount(1);
  await expect(page.locator(".venue-focus-veil")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Visa Fælledparken", exact: true }),
  ).toBeVisible();
  const focusedView = await view(page);
  await filters(page, () =>
    page
      .getByRole("textbox", { name: "Sök plats eller område" })
      .fill("no-match-anywhere"),
  );
  await expect(page.locator(".park-focus-outline")).toHaveCount(0);
  await expect(page.locator(".place-pin")).toHaveCount(0);
  assert.deepEqual(
    await view(page),
    focusedView,
    "filter updates do not fit the map again",
  );
  await filters(page, () =>
    page
      .getByRole("textbox", { name: "Sök plats eller område" })
      .fill("faelledsparken"),
  );
  await expect(page.locator(".park-focus-outline")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Ändra sökning", exact: true })
    .click();
  await ready(page);
  const beforeWorker = await view(page);
  await expandFinder(page);
  await page.getByLabel("Exakt klockslag").fill("13:00");
  await expect(page.locator(".building-shadows")).toHaveAttribute(
    "data-instant",
    "2026-10-27T12:00:00.000Z",
  );
  await ready(page);
  assert.deepEqual(
    await view(page),
    beforeWorker,
    "worker updates do not fit the map again",
  );

  // Dispatch the real time field quickly; the latest requested frame must win.
  const metrics = await page.evaluate(async () => {
    const durations = [];
    const observer = new PerformanceObserver((list) =>
      durations.push(...list.getEntries().map((entry) => entry.duration)),
    );
    observer.observe({ type: "longtask", buffered: false });
    const input = document.querySelector('input[type="time"]');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    for (let index = 0; index < 45; index++) {
      const minute = 600 + index * 10;
      setter.call(
        input,
        `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    observer.disconnect();
    return {
      longTasks: durations.length,
      longTaskMs: Math.round(durations.reduce((sum, value) => sum + value, 0)),
    };
  });
  await expect(page.locator(".building-shadows")).toHaveAttribute(
    "data-instant",
    "2026-10-27T16:20:00.000Z",
  );
  await ready(page);
  assert.deepEqual(
    await view(page),
    beforeWorker,
    "rapid time updates preserve the chosen view",
  );
  await page.getByLabel("Exakt klockslag").fill("00:00");
  await ready(page);
  await expect(page.locator(".building-shadows")).toHaveAttribute(
    "data-mode",
    "night",
  );
  await filters(page, () =>
    page.getByRole("textbox", { name: "Sök plats eller område" }).fill(""),
  );
  await expandFinder(page);
  await page
    .getByRole("combobox", { name: "Var?", exact: true })
    .selectOption("Kvæsthusbroen");
  await page
    .getByRole("button", { name: "Hitta min plats i solen", exact: true })
    .click();
  await ready(page);
  await expect(page.locator(".detail-card")).toContainText("Ofelia Plads");
  await expect(
    page.getByRole("button", { name: "Visa Ofelia Plads", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".venue-focus-veil")).toHaveCount(1);
  await expect(page.locator(".park-focus-outline")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 667 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "small viewport does not scroll sideways",
  );
  assert.deepEqual(errors, []);
  const report = {
    passed: true,
    markerCount,
    rasterDifference,
    ...metrics,
    checks: [
      "empty initial map",
      "bounded result pins",
      "mixed focus",
      "filtered park polygons",
      "point-only park fallback",
      "stable map on filters and workers",
      "mobile tools",
      "worker/fallback coverage",
      "latest time field frame",
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
