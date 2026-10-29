import test from "node:test";
import assert from "node:assert/strict";
import { selectWeatherMoment, selectEmptyMoment } from "../src/characterExperience.js";

const clear = { loading: false, night: false, available: true, stale: false, condition: "sun", hasSun: true };
const cases = [
  [{ loading: true }, "weather.loading", "green-jacket"],
  [{ night: true, available: false }, "weather.night", "turtleneck"],
  [{ available: false }, "weather.missing", "green-jacket"],
  [{ stale: true }, "weather.stale", "green-jacket"],
  [{ condition: "unknown" }, "weather.unknown", "green-jacket"],
  [{ condition: "rain" }, "weather.rain", "stripes", "rain-bag"],
  [{ condition: "cloud" }, "weather.cloud", "blue-shirt", "cloud-angry"],
  [{ hasSun: false }, "weather.no-spot", "cyclist", "cycling"],
  [{}, "weather.sun", "football"],
  [{ planned: true }, "planned.sun", "stripes"],
  [{ planned: true, condition: "cloud" }, "planned.grey", "blue-shirt", "cloud-angry"],
  [{ planned: true, condition: "rain" }, "planned.grey", "blue-shirt", "cloud-angry"],
];

test("weather moments follow real normalized conditions, with deterministic priority and poses", () => {
  for (const [input, id, character, pose] of cases) {
    const result = selectWeatherMoment({ ...clear, ...input });
    assert.equal(result.id, id);
    assert.equal(result.character, character);
    assert.equal(result.pose, pose);
    assert.deepEqual(result, selectWeatherMoment({ ...clear, ...input }));
  }
});

test("an unavailable, stale, unknown, rainy or cloudy forecast cannot present a sunny character", () => {
  for (const input of [{ available: false }, { stale: true }, { condition: "unknown" }, { condition: "rain" }, { condition: "cloud" }, { night: true }, { hasSun: false }]) {
    for (const planned of [false, true]) {
      const result = selectWeatherMoment({ ...clear, ...input, planned });
      assert.ok(!["weather.sun", "planned.sun"].includes(result.id));
      assert.notEqual(result.character, "football");
    }
  }
  assert.equal(selectWeatherMoment({ ...clear, stale: true, condition: "unknown" }).id, "weather.stale");
  assert.equal(selectWeatherMoment({ ...clear, loading: true, night: true }).id, "weather.loading");
});

test("empty and permission states explain the actual cause before offering another choice", () => {
  const sun = selectWeatherMoment(clear);
  for (const [input, id, character] of [
    [{ noTypes: true, outsideCoverage: true }, "empty.no-types", "curls"],
    [{ outsideCoverage: true, locationError: true }, "empty.outside", "cyclist"],
    [{ locationError: true }, "empty.location", "curls"],
    [{ unconfirmedOpen: true }, "empty.unconfirmed-open", "turtleneck"],
    [{}, "empty.no-match", "curls"],
  ]) {
    const result = selectEmptyMoment({ weatherMoment: sun, ...input });
    assert.equal(result.id, id);
    assert.equal(result.character, character);
  }
  for (const condition of ["cloud", "rain", "unknown"]) {
    const weatherMoment = selectWeatherMoment({ ...clear, condition });
    assert.deepEqual(selectEmptyMoment({ weatherMoment }), weatherMoment);
  }
});
