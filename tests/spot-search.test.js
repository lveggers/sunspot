import test from "node:test";
import assert from "node:assert/strict";
import {
  filterSpots,
  getDirectionsUrl,
  isCopenhagenPoint,
} from "../src/spotSearch.js";

const places = [
  {
    id: "park",
    name: "Grøn park",
    category: "park",
    district: "Nørrebro",
    lat: 55.69,
    lng: 12.55,
  },
  {
    id: "bar",
    name: "Ølbar",
    category: "bar",
    district: "Nørrebro",
    lat: 55.69,
    lng: 12.552,
  },
  {
    id: "food",
    name: "Mat",
    category: "restaurant",
    district: "Indre By",
    lat: 55.68,
    lng: 12.58,
  },
];
const sunny = {
  state: "sun",
  eligible: true,
  opening: { state: "open" },
  until: 60,
};
const results = Object.fromEntries(places.map((p) => [p.id, { ...sunny }]));
const ids = (items) => items.map((place) => place.id).sort();

test("spot types toggle independently, including an empty selection", () => {
  assert.deepEqual(
    ids(filterSpots(places, results, { categories: ["park", "bar"] })),
    ["bar", "park"],
  );
  assert.deepEqual(
    ids(filterSpots(places, results, { categories: ["bar", "restaurant"] })),
    ["bar", "food"],
  );
  assert.deepEqual(filterSpots(places, results, { categories: [] }), []);
  assert.deepEqual(ids(filterSpots(places, results)), ["bar", "food", "park"]);
});

test("defaults require confirmed opening hours and weather-adjusted sunshine", () => {
  for (const state of [
    "shade",
    "unknown",
    "cloud",
    "rain",
    "weather-unknown",
  ]) {
    assert.deepEqual(
      ids(filterSpots(places, { ...results, bar: { ...sunny, state } })),
      ["food", "park"],
    );
  }
  for (const state of ["closed", "unknown"]) {
    assert.deepEqual(
      ids(
        filterSpots(places, {
          ...results,
          bar: { ...sunny, opening: { state } },
        }),
      ),
      ["food", "park"],
    );
  }
  assert.deepEqual(
    ids(
      filterSpots(places, { ...results, bar: { ...sunny, eligible: false } }),
    ),
    ["food", "park"],
  );
  assert.deepEqual(ids(filterSpots(places, { ...results, bar: undefined })), [
    "food",
    "park",
  ]);
  assert.deepEqual(
    ids(filterSpots(places, {}, { onlySun: false, onlyOpen: false })),
    ["bar", "food", "park"],
  );
});

test("district and spelling-normalized search both narrow the selected types", () => {
  assert.deepEqual(
    ids(filterSpots(places, results, { district: "Nørrebro", query: "olbar" })),
    ["bar"],
  );
  assert.deepEqual(
    filterSpots(places, results, { district: "Indre By", query: "olbar" }),
    [],
  );
  assert.deepEqual(ids(filterSpots(places, results, { query: "gron" })), [
    "park",
  ]);
});

test("nearby results stay within 1.5km and prioritize the nearest place", () => {
  const input = [...places];
  const ranked = filterSpots(
    places,
    { ...results, bar: { ...sunny, until: 300 } },
    { origin: [12.55, 55.69] },
  );
  assert.deepEqual(
    ranked.map((p) => p.id),
    ["park", "bar"],
  );
  assert.deepEqual(places, input);
  assert.deepEqual(filterSpots(places, results, { origin: [10, 56] }), []);
  assert.deepEqual(filterSpots(places, results, { origin: [NaN, 55.69] }), []);
});

test("supported coverage and walking directions use longitude/latitude correctly", () => {
  assert.equal(isCopenhagenPoint([12.55, 55.69]), true);
  for (const point of [null, [55.69, 12.55], [12.55], [12.55, Infinity]]) {
    assert.equal(isCopenhagenPoint(point), false);
  }
  const url = new URL(getDirectionsUrl(places[0]));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("destination"), "55.69,12.55");
  assert.equal(url.searchParams.get("travelmode"), "walking");
});
