import test from "node:test";
import assert from "node:assert/strict";
import { createSunEligibility } from "../server/sun-eligibility.js";

const now = new Date("2026-10-27T11:30:00Z");
const placeId = "osm-335962972";
function weather(symbol = "clearsky_day") {
  return {
    available: true,
    stale: false,
    timeseries: [
      {
        time: "2026-10-27T11:00:00Z",
        data: {
          instant: { details: { cloud_area_fraction: 5 } },
          next_1_hours: {
            summary: { symbol_code: symbol },
            details: { precipitation_amount: 0 },
          },
        },
      },
    ],
  };
}

test("server verifies real building exposure, opening hours and the forecast interval", async () => {
  const check = createSunEligibility(async () => weather());
  const result = await check(placeId, now);
  assert.equal(result.allowed, true);
  assert.ok(result.until > 0 && result.until <= 30);
  assert.equal(
    (await check(placeId, new Date("2026-10-27T04:00:00Z"))).allowed,
    false,
  );
  assert.equal((await check("kongens-have", now)).allowed, false);
  assert.equal((await check("not-a-place", now)).allowed, false);
});

test("no sunlight offer is authorized from cloudy, rainy, expired or missing weather", async () => {
  for (const forecast of [
    weather("cloudy"),
    weather("rain"),
    { ...weather(), stale: true },
    { available: false },
  ]) {
    const check = createSunEligibility(async () => forecast);
    assert.equal((await check(placeId, now)).allowed, false);
  }
  const failing = createSunEligibility(async () => {
    throw new Error("private upstream detail");
  });
  const result = await failing(placeId, now);
  assert.equal(result.allowed, false);
  assert.ok(!result.reason.includes("private upstream detail"));
});

test("a clear forecast never overrides actual building shade or night at an open bar", async () => {
  for (const [id, instant] of [
    ["osm-24958713", "2026-09-17T15:00:00Z"],
    [placeId, "2026-10-27T23:30:00Z"],
  ]) {
    const forecast = weather();
    forecast.timeseries[0].time = instant;
    const check = createSunEligibility(async () => forecast);
    const result = await check(id, new Date(instant));
    assert.equal(result.allowed, false);
    assert.equal(result.until, 0);
    assert.match(result.reason, /byggnadsskugga|gått ner/);
  }
});
