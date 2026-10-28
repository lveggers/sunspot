import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { atHour, clock, localDate } from "../src/lib.js";

const base = process.env.SUNSPOT_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.SUNSPOT_BROWSER_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  timezoneId: "Europe/Copenhagen",
});
await context.addCookies([{ name: "sunspot-language", value: "sv", url: base }]);
const errors = [];
const expandFinder = async (target) => {
  const toggle = target.getByRole("button", {
    name: "Välj plats och tid",
    exact: true,
  });
  if (await toggle.isVisible()) await toggle.click();
};

const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
const eventRequests = [];
page.on("request", (request) => {
  if (request.url().includes("/api/events")) eventRequests.push(request.url());
});
let weatherMode = "clear";
function forecast(mode = weatherMode) {
  if (mode === "missing") return { available: false };
  return {
    available: true,
    stale: false,
    updatedAt: "2026-10-27T11:00:00Z",
    timeseries: Array.from({ length: 168 }, (_, hour) => ({
      time: new Date(
        Date.parse("2026-10-27T00:00:00Z") + hour * 3600_000,
      ).toISOString(),
      data: {
        instant: {
          details: {
            air_temperature: 18,
            wind_speed: 2,
            cloud_area_fraction: mode === "cloud" ? 100 : 5,
          },
        },
        next_1_hours: {
          summary: {
            symbol_code:
              mode === "rain"
                ? "rain"
                : mode === "cloud"
                  ? "cloudy"
                  : "clearsky_day",
          },
          details: { precipitation_amount: mode === "rain" ? 2 : 0 },
        },
      },
    })),
  };
}
await context.route("**/api/weather", (route) =>
  route.fulfill({ json: forecast() }),
);
const ready = async () => {
  await page.locator('.map-workspace[data-solar-pending="false"]').waitFor();
  await expect(page.locator(".finder-submit")).toBeEnabled();
};
const open = async () => {
  await page.clock.setSystemTime(new Date("2026-10-27T11:00:00Z"));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await ready();
};
const find = () =>
  page
    .getByRole("button", { name: "Hitta min plats i solen", exact: true })
    .click();
const invitationTime = new Date(
  Math.max(Date.now() + 86400_000, Date.parse("2026-10-28T12:30:00Z")),
);
const meetingInput = `${localDate(invitationTime)}T${clock(invitationTime)}`;
const [meetingHour, meetingMinute] = clock(invitationTime)
  .split(":")
  .map(Number);
const expectedStart = atHour(
  localDate(invitationTime),
  meetingHour + meetingMinute / 60,
).toISOString();
let gatheringId;
let hostToken;
try {
  await mkdir("artifacts", { recursive: true });
  await open();
  await expandFinder(page);
  await expect(
    page.getByRole("combobox", { name: "Dag", exact: true }),
  ).toHaveValue("2026-10-27");
  await expect(
    page
      .getByRole("textbox", { name: "Exakt klockslag" })
      .or(page.locator('input[type="time"]')),
  ).toHaveValue("12:00");
  await expect(page.locator(".place-pin")).toHaveCount(0);
  for (const name of ["Park", "Bar", "Mat"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Event", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Öppna filter", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Dölj skugga och osäkert solläge" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Bara bekräftat öppet enligt OSM" }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/finder-desktop.png" });

  await page.getByRole("button", { name: "Bar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Park", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Mat", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const name of ["Park", "Mat"])
    await page.getByRole("button", { name, exact: true }).click();
  await find();
  await expect(page.locator('.finder-empty[data-experience="empty.no-types"] > p')).toHaveText(
    "Välj park, bar eller mat för att se platser.",
  );
  await expect(page.locator(".finder-empty").getByRole("button", { name: "Välj område och typer", exact: true })).toBeVisible();
  await expect(page.locator(".place-pin")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ändra sökning", exact: true })
    .click();
  await expandFinder(page);
  await page.getByRole("button", { name: "Bar", exact: true }).click();
  await page.locator("#district").selectOption("Nørrebro");
  await find();
  await expect(page.locator(".finder-summary")).toContainText("2 match");
  await expect(page.locator(".detail-card")).toContainText("Café Stefanshus");
  const sunFocus = page.locator(".sun-focus-color-pane");
  await expect(sunFocus).toHaveCount(1);
  await expect(sunFocus).toHaveCSS("pointer-events", "none");
  await expect.poll(async () => Number(await sunFocus.getAttribute("data-active-count"))).toBeGreaterThan(0);
  const direction = new URL(
    await page.getByRole("link", { name: "Ta mig dit" }).getAttribute("href"),
  );
  assert.equal(direction.origin, "https://www.google.com");
  assert.equal(direction.searchParams.get("travelmode"), "walking");
  await page
    .getByRole("button", { name: "Visa platslista", exact: true })
    .click();
  await expect(page.locator(".place-list h3")).toHaveCount(2);
  assert.deepEqual(
    await page
      .locator(".place-art")
      .evaluateAll((items) => [
        ...new Set(items.map((item) => item.dataset.category)),
      ]),
    ["bar"],
  );
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "artifacts/finder-results-desktop.png" });
  weatherMode = "cloud";
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.locator('.finder-empty[data-experience="weather.cloud"] > p')).toHaveText("Prognosen visar moln. Prova en annan tid för att hitta sol.");
  await expect(page.locator(".place-pin")).toHaveCount(0);
  weatherMode = "clear";
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.locator(".finder-summary")).toContainText("2 match");

  await page
    .getByRole("button", { name: "Ses här med vänner", exact: true })
    .click();
  await page.locator("#meeting-time").fill(meetingInput);
  await page.locator("#host").fill("Testvärd");
  await page
    .getByRole("button", { name: "Skapa inbjudan", exact: true })
    .click();
  await page.waitForURL("**/invite/**");
  gatheringId = page.url().split("/").at(-1);
  hostToken = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`sunspot:host:${id}`)),
    gatheringId,
  );
  const invitation = await (
    await page.request.get(`${base}/api/gatherings/${gatheringId}`)
  ).json();
  assert.equal(invitation.starts_at || invitation.startsAt, expectedStart);
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await guestContext.addCookies([{ name: "sunspot-language", value: "sv", url: base }]);
  const guest = await guestContext.newPage();
  guest.on("pageerror", (error) => errors.push(error.message));
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
  await guestContext.close();

  for (const [mode, moment, message, action] of [
    ["cloud", "weather.cloud", "Prognosen visar moln. Prova en annan tid för att hitta sol.", "Välj en annan tid"],
    ["rain", "weather.rain", "Prognosen visar nederbörd. Prova en annan tid.", "Välj en annan tid"],
    ["missing", "weather.missing", "Det finns ingen väderprognos för den valda tiden. Försök hämta vädret igen.", "Hämta vädret igen"],
  ]) {
    weatherMode = mode;
    await open();
    await find();
    await expect(page.locator(`.finder-empty[data-experience="${moment}"] > p`)).toHaveText(message);
    await expect(page.locator(".finder-empty").getByRole("button", { name: action, exact: true })).toBeVisible();
    await expect(page.locator(".place-pin")).toHaveCount(0);
    await expect(page.locator(".detail-card")).toHaveCount(0);
  }
  weatherMode = "clear";
  await open();
  await page.setViewportSize({ width: 390, height: 667 });
  await expect(page.locator(".finder-submit")).toBeInViewport();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "artifacts/finder-mobile.png" });
  await find();
  await expect(page.locator(".finder-summary")).toContainText("match");
  for (const action of [
    page.getByRole("link", { name: "Ta mig dit", exact: true }),
    page.getByRole("button", { name: "Ses här med vänner", exact: true }),
  ]) {
    await expect(action).toBeInViewport({ ratio: 1 });
    assert.ok(
      await action.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        ));
      }),
      "mobile result actions remain unobstructed without scrolling",
    );
  }
  const mapShare = await page.evaluate(() => {
    const map = document.querySelector(".leaflet-container");
    let exposed = 0;
    let sampled = 0;
    for (let y = 20; y < innerHeight - 20; y += 40) {
      for (let x = 20; x < innerWidth - 20; x += 40) {
        const hit = document.elementFromPoint(x, y);
        sampled += 1;
        if (map && hit && (hit === map || map.contains(hit))) exposed += 1;
      }
    }
    return sampled ? exposed / sampled : 0;
  });
  assert.ok(
    mapShare >= 0.25,
    `mobile results leave at least 25% clickable map (${Math.round(mapShare * 100)}% exposed)`,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "artifacts/finder-results-mobile.png" });

  const geoContext = await browser.newContext({
    geolocation: { latitude: 55.69, longitude: 12.55 },
    permissions: ["geolocation"],
    viewport: { width: 390, height: 844 },
  });
  await geoContext.addCookies([{ name: "sunspot-language", value: "sv", url: base }]);
  await geoContext.route("**/api/weather", (route) =>
    route.fulfill({ json: forecast("clear") }),
  );
  const nearby = await geoContext.newPage();
  nearby.on("pageerror", (error) => errors.push(error.message));
  await nearby.clock.setSystemTime(new Date("2026-10-27T11:00:00Z"));
  await nearby.goto(base, { waitUntil: "domcontentloaded" });
  await nearby.getByRole("button", { name: "Nära mig", exact: true }).click();
  await expect(
    nearby.getByRole("button", { name: "Inom 1,5 km från dig" }),
  ).toBeVisible();
  await geoContext.close();
  for (const [position, permissions, moment, message] of [
    [{ latitude: 56, longitude: 10 }, ["geolocation"], "empty.outside", "SunSpot täcker Köpenhamn. Välj ett område i staden."],
    [{ latitude: 55.69, longitude: 12.55 }, [], "empty.location", "Välj ett område manuellt eller tillåt åtkomst till din plats."],
  ]) {
    const scenario = await browser.newContext({
      geolocation: position,
      permissions,
    });
    await scenario.addCookies([{ name: "sunspot-language", value: "sv", url: base }]);
    await scenario.route("**/api/weather", (route) =>
      route.fulfill({ json: forecast("clear") }),
    );
    const locationPage = await scenario.newPage();
    locationPage.on("pageerror", (error) => errors.push(error.message));
    await locationPage.clock.setSystemTime(new Date("2026-10-27T11:00:00Z"));
    await locationPage.goto(base, { waitUntil: "domcontentloaded" });
    await locationPage
      .getByRole("button", { name: "Nära mig", exact: true })
      .click();
    await expect(locationPage.locator(`.experience-hero[data-experience="${moment}"] .hero-invitation`)).toHaveText(message, {
      timeout: 15000,
    });
    await scenario.close();
  }

  const delayedContext = await browser.newContext();
  await delayedContext.addCookies([{ name: "sunspot-language", value: "sv", url: base }]);
  await delayedContext.route("**/api/weather", (route) =>
    route.fulfill({ json: forecast("clear") }),
  );
  await delayedContext.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) => {
      window.releaseLocation = () =>
        success({ coords: { longitude: 12.55, latitude: 55.69 } });
    };
  });
  const delayed = await delayedContext.newPage();
  await delayed.goto(base, { waitUntil: "domcontentloaded" });
  await delayed.getByRole("button", { name: "Nära mig", exact: true }).click();
  await expect(delayed.locator("#district")).toBeDisabled();
  await delayed.evaluate(() => window.releaseLocation());
  await expect(delayed.locator("#district")).toBeEnabled();
  await delayedContext.close();

  await open();
  await page.route("**/data/copenhagen-buildings.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Skuggdata kunde inte laddas.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/data/copenhagen-buildings.json");
  await page
    .getByRole("button", { name: "Ladda skuggdata igen", exact: true })
    .click();
  await ready();
  assert.deepEqual(eventRequests, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "today/now and safe defaults",
        "independent category toggles",
        "empty search",
        "district selection and focused results",
        "directions",
        "future invitation and guest RSVP/update",
        "host cancellation",
        "cloud/rain/missing forecast",
        "mobile result actions and at least 25% clickable map without scrolling",
        "nearby/coverage/permission denial",
        "no external event requests",
        "building data retry",
      ],
    }),
  );
} finally {
  if (gatheringId && hostToken)
    await context.request
      .patch(`${base}/api/gatherings/${gatheringId}`, {
        headers: { "x-host-token": hostToken },
        data: { cancelled: true },
      })
      .catch(() => {});
  await browser.close();
}
