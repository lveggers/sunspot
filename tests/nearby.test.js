import test from "node:test";
import assert from "node:assert/strict";
import { nearbyRecommendations, validNearbyLocation } from "../src/nearby.js";
import { placeOpening, venueEvidence } from "../src/venueEvidence.js";
import { places } from "../src/places.js";
const origin = [12.5558, 55.6919];
const instant = "2026-09-17T14:00:00Z";
const place = { id: "test", category: "bar", openingHours: "24/7" };
const result = {
  point: origin,
  eligible: true,
  pointSource: "estimated",
  timeline: Array.from({ length: 181 }, (_, minute) => ({
    minute,
    state: "sun",
  })),
};
const recommend = (p = place, r = result, duration = 30, onlyOpen = false) =>
  nearbyRecommendations(
    [p],
    { [p.id]: r },
    origin,
    instant,
    duration,
    onlyOpen,
  );
test("nearby requires sun for arrival and entire stay, excludes missing samples and unknown coverage", () => {
  assert.equal(recommend().length, 1);
  assert.equal(recommend()[0].walk, 1);
  assert.equal(recommend()[0].sunMinutes, 179);
  for (const state of ["shade", "unknown"])
    assert.equal(
      recommend(place, {
        ...result,
        timeline: result.timeline.map((t) =>
          t.minute === 25 ? { ...t, state } : t,
        ),
      }).length,
      0,
    );
  assert.equal(
    recommend(place, {
      ...result,
      timeline: result.timeline.filter((t) => t.minute !== 25),
    }).length,
    0,
  );
  assert.equal(recommend(place, result, 180).length, 0);
});
test("opening evaluated at arrival with enough time to stay; unknown is explicit and respects filter", () => {
  assert.equal(
    recommend({ ...place, openingHours: "Mo-Su 16:00-16:20" }).length,
    0,
  );
  assert.equal(
    recommend({ ...place, openingHours: "Mo-Su 17:00-20:00" }).length,
    0,
  );
  assert.equal(
    recommend({ ...place, openingHours: null })[0].opening.state,
    "unknown",
  );
  assert.equal(
    recommend({ ...place, openingHours: null }, result, 30, true).length,
    0,
  );
});
test("park uses samples bracketing arrival, never skips a shadow before rounded arrival", () => {
  const park = { ...place, category: "park" };
  const r = {
    ...result,
    timeline: result.timeline.filter((t) => t.minute % 5 === 0),
  };
  assert.equal(recommend(park, r).length, 1);
  assert.equal(
    recommend(park, {
      ...r,
      timeline: r.timeline.map((t) =>
        t.minute === 0 ? { ...t, state: "shade" } : t,
      ),
    }).length,
    0,
  );
});
test("nearby ranks known opening before unknown, then walking time; limits to three", () => {
  const ps = Array.from({ length: 5 }, (_, i) => ({
    ...place,
    id: String(i),
    openingHours: i === 0 ? null : "24/7",
  }));
  const rs = Object.fromEntries(
    ps.map((p, i) => [
      p.id,
      { ...result, point: [origin[0] + i * 0.001, origin[1]] },
    ]),
  );
  assert.deepEqual(
    nearbyRecommendations(ps, rs, origin, instant).map((r) => r.place.id),
    ["1", "2", "3"],
  );
  assert.equal(
    recommend(place, { ...result, point: [12.62, 55.67] }).length,
    0,
  );
  assert.equal(recommend(place, { ...result, eligible: false }).length, 0);
});
test("GPS validates bounds, coordinates and accuracy", () => {
  assert.equal(validNearbyLocation(origin, 30), true);
  for (const [point, accuracy] of [
    [[18, 59], 1],
    [origin, 501],
    [[NaN, 55.68], 1],
    [origin, -1],
    [origin, Infinity],
  ])
    assert.equal(validNearbyLocation(point, accuracy), false);
});
test("20 Nørrebro audit entries distinguish web evidence from OSM and never claim a verified point", () => {
  const pilot = places.filter(
    (p) => p.category !== "park" && p.district === "Nørrebro",
  );
  assert.equal(pilot.length, 20);
  for (const p of pilot) {
    const evidence = venueEvidence[p.id];
    assert.ok(evidence?.note);
    if (evidence.url) assert.equal(new URL(evidence.url).protocol, "https:");
    assert.equal(evidence.point, undefined);
  }
  assert.equal(
    Object.values(venueEvidence).filter((e) => e.outdoorConfirmed).length,
    1,
  );
  const baest = places.find((p) => p.id === "osm-3659148934");
  assert.equal(
    placeOpening(baest, new Date("2026-09-19T10:30:00Z")).state,
    "open",
  );
  assert.equal(
    placeOpening(baest, new Date("2026-09-19T10:30:00Z")).label,
    "Öppet enligt stället",
  );
  assert.equal(
    placeOpening(baest, new Date("2027-09-18T10:30:00Z")).state,
    "unknown",
  );
});
