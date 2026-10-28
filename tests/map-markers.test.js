import test from "node:test";
import assert from "node:assert/strict";
import { groupMapMarkers, sunFocusPoints } from "../src/mapMarkers.js";
import { projectPoint } from "../src/shadowRenderer.js";
const items = Array.from({ length: 120 }, (_, i) => ({
  id: `park-${i}`,
  lat: 55.68 + i * 0.00001,
  lng: 12.57 + i * 0.00001,
  category: "park",
}));
const options = {
  zoom: 14,
  bounds: { south: 55.66, north: 55.7, west: 12.55, east: 12.6 },
  project: (p) => projectPoint(p.lat, p.lng, 14),
};
const unpack = (markers) =>
  markers
    .flatMap((m) => m.members || [m])
    .map((m) => m.id)
    .sort();
test("city-scale groups retain every park and release individual places on zoom", () => {
  const grouped = groupMapMarkers(items, options);
  assert.ok(grouped.length < 10);
  assert.deepEqual(unpack(grouped), items.map((p) => p.id).sort());
  assert.equal(groupMapMarkers(items, { ...options, zoom: 17 }).length, 120);
});
test("selected places remain accessible; offscreen places are culled", () => {
  const outside = { ...items[0], id: "outside", lat: 56 };
  const result = groupMapMarkers([...items, outside], {
    ...options,
    selectedId: "park-0",
  });
  assert.ok(result.some((m) => m.markerId === "park-0" && !m.members));
  assert.ok(!unpack(result).includes("outside"));
  assert.equal(new Set(unpack(result)).size, 120);
});
test("group identities are stable when input order changes", () => {
  assert.deepEqual(
    groupMapMarkers(items, options)
      .map((p) => p.markerId)
      .sort(),
    groupMapMarkers([...items].reverse(), options)
      .map((p) => p.markerId)
      .sort(),
  );
});
test("worker projection preserves Mercator origin, scale and Copenhagen location", () => {
  assert.deepEqual(projectPoint(0, 0, 0), { x: 128, y: 128 });
  const a = projectPoint(55.6865, 12.581, 14),
    b = projectPoint(55.6865, 12.581, 15);
  assert.equal(b.x, 2 * a.x);
  assert.equal(b.y, 2 * a.y);
  assert.ok(Number.isFinite(projectPoint(90, 0, 18).y));
});

test("map colour requires fresh sunny weather, daylight, an eligible sunny place and confirmed opening", () => {
  const place = { id: "focus", lat: 55.68, lng: 12.57 };
  const result = { state: "sun", eligible: true, point: [12.58, 55.69], opening: { state: "open" } };
  const input = { pending: false, weatherState: "sun", daylight: true };
  const focused = (changes = {}, options = {}) => sunFocusPoints([place], { focus: { ...result, ...changes } }, { ...input, ...options });
  assert.deepEqual(focused(), [{ id: "focus", lat: 55.69, lng: 12.58 }]);
  for (const weatherState of ["cloud", "rain", "unknown", "loading", "stale", undefined]) assert.deepEqual(focused({}, { weatherState }), []);
  assert.deepEqual(focused({}, { pending: true }), []);
  assert.deepEqual(focused({}, { daylight: false }), []);
  for (const state of ["shade", "unknown", "weather-unknown", "cloud", "rain"]) assert.deepEqual(focused({ state }), []);
  for (const state of ["closed", "unknown", undefined]) assert.deepEqual(focused({ opening: { state } }), []);
  assert.deepEqual(focused({ eligible: false }), []);
  assert.deepEqual(focused({ point: [NaN, 55.69] }), []);
  assert.deepEqual(sunFocusPoints([], { focus: result }, input), []);
  assert.deepEqual(sunFocusPoints([place], {}, input), []);
});
