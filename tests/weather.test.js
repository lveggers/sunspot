import test from "node:test";
import assert from "node:assert/strict";
import {
  applySunshineWeather,
  sunshineWeather,
  weatherAt,
} from "../src/lib.js";

const instant = "2026-10-26T12:30:00Z";
function weather({
  symbol = "clearsky_day",
  cloud = 5,
  rain = 0,
  ...rest
} = {}) {
  return {
    available: true,
    timeseries: [
      {
        time: "2026-10-26T12:00:00Z",
        data: {
          instant: { details: { cloud_area_fraction: cloud } },
          next_1_hours: {
            summary: { symbol_code: symbol },
            details: { precipitation_amount: rain },
          },
        },
      },
    ],
    ...rest,
  };
}

test("sunshine requires a fresh daytime forecast in its actual interval", () => {
  assert.equal(sunshineWeather(weather(), instant).state, "sun");
  assert.equal(
    sunshineWeather(weather({ symbol: "fair_day" }), instant).state,
    "sun",
  );
  assert.equal(
    sunshineWeather(weather({ symbol: "partlycloudy_day" }), instant).state,
    "sun",
  );
  for (const value of [
    null,
    { available: false },
    weather({ stale: true }),
    weather({ symbol: "clearsky_night" }),
    weather({ symbol: "unknown" }),
  ]) {
    assert.equal(sunshineWeather(value, instant).state, "unknown");
  }
  assert.equal(
    sunshineWeather(weather(), "2026-10-26T11:59:00Z").state,
    "unknown",
  );
  assert.equal(
    sunshineWeather(weather(), "2026-10-26T13:00:00Z").state,
    "unknown",
  );
  assert.equal(weatherAt(weather(), instant).cloud, 5);
});

test("cloud cover, fog and precipitation override clear building exposure", () => {
  for (const input of [{ cloud: 80 }, { symbol: "cloudy" }, { symbol: "fog" }])
    assert.equal(sunshineWeather(weather(input), instant).state, "cloud");
  for (const input of [
    { rain: 0.01 },
    { symbol: "lightrainshowers_day" },
    { symbol: "snow" },
    { symbol: "sleet" },
    { symbol: "rainandthunder" },
  ])
    assert.equal(sunshineWeather(weather(input), instant).state, "rain");
});

test("weather adjustment preserves physical results and never makes shade sunny", () => {
  const results = {
    park: {
      state: "sun",
      fraction: 0.6,
      timeline: [{ minute: 0, state: "sun" }],
    },
    shaded: { state: "shade" },
    missing: { state: "unknown" },
  };
  for (const state of ["cloud", "rain", "unknown"]) {
    const adjusted = applySunshineWeather(results, { state });
    assert.equal(
      adjusted.park.state,
      state === "unknown" ? "weather-unknown" : state,
    );
    assert.equal(adjusted.shaded.state, "shade");
    assert.equal(adjusted.missing.state, "unknown");
    assert.equal(results.park.state, "sun");
    assert.deepEqual(adjusted.park.timeline, results.park.timeline);
  }
  assert.equal(applySunshineWeather(results, { state: "sun" }), results);
});
