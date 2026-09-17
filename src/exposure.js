import * as SunCalc from "suncalc";
import { coverageBounds, shadowOffset } from "./shadows.js";
import { placeOpening } from "./venueEvidence.js";
const R = 6378137,
  RAD = Math.PI / 180,
  LAT = 55.6865,
  SCALE = Math.cos(LAT * RAD),
  CELL = 150;
export const project = ([lon, lat]) => [
  R * SCALE * lon * RAD,
  R * SCALE * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)),
];
export const unproject = ([x, y]) => [
  x / (R * SCALE) / RAD,
  (2 * Math.atan(Math.exp(y / (R * SCALE))) - Math.PI / 2) / RAD,
];
export function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export const inPolygon = (p, rings) =>
  inRing(p, rings[0]) && !rings.slice(1).some((r) => inRing(p, r));
function intersects(a, b, c, d) {
  const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
  const r = [b[0] - a[0], b[1] - a[1]],
    s = [d[0] - c[0], d[1] - c[1]],
    q = [c[0] - a[0], c[1] - a[1]],
    den = cross(r, s);
  if (Math.abs(den) < 1e-10) return false;
  const t = cross(q, s) / den,
    u = cross(q, r) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
export function rayHitsPolygon(a, b, polygon) {
  if (inPolygon(a, polygon) || inPolygon(b, polygon)) return true;
  return polygon.some((r) =>
    r.some((p, i) => i > 0 && intersects(a, b, r[i - 1], p)),
  );
}
export function createExposureModel(data) {
  const grid = new Map();
  const sampleCache = new WeakMap(),
    waterCache = new WeakMap();
  const buildings = data.buildings.map((b) => {
    const polygons = b.polygons.map((p) => p.map((r) => r.map(project)));
    const flat = polygons.flat(2);
    const bounds = [
      Math.min(...flat.map((p) => p[0])),
      Math.min(...flat.map((p) => p[1])),
      Math.max(...flat.map((p) => p[0])),
      Math.max(...flat.map((p) => p[1])),
    ];
    return { ...b, polygons, bounds };
  });
  function keys(bounds) {
    const result = [];
    for (
      let x = Math.floor(bounds[0] / CELL);
      x <= Math.floor(bounds[2] / CELL);
      x++
    )
      for (
        let y = Math.floor(bounds[1] / CELL);
        y <= Math.floor(bounds[3] / CELL);
        y++
      )
        result.push(`${x}:${y}`);
    return result;
  }
  buildings.forEach((b, i) =>
    keys(b.bounds).forEach((k) => {
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }),
  );
  function nearby(bounds) {
    const ids = new Set();
    for (const k of keys(bounds))
      for (const id of grid.get(k) || []) ids.add(id);
    return [...ids].map((i) => buildings[i]);
  }
  const indoor = (p) =>
    nearby([p[0], p[1], p[0], p[1]]).some((b) =>
      b.polygons.some((poly) => inPolygon(p, poly)),
    );
  function frame(instant) {
    const position = SunCalc.getPosition(new Date(instant), LAT, 12.581);
    return {
      position,
      coverage: coverageBounds(data.bounds, data.maxHeight, position),
    };
  }
  function state(lonlat, f) {
    const { position, coverage } = f;
    if (position.altitude <= 0) return "shade";
    if (
      !coverage ||
      lonlat[0] < coverage[0] ||
      lonlat[0] > coverage[2] ||
      lonlat[1] < coverage[1] ||
      lonlat[1] > coverage[3]
    )
      return "unknown";
    const p = project(lonlat),
      offset = shadowOffset(data.maxHeight, position),
      end = [p[0] - offset.east, p[1] - offset.north];
    const candidates = nearby([
      Math.min(p[0], end[0]),
      Math.min(p[1], end[1]),
      Math.max(p[0], end[0]),
      Math.max(p[1], end[1]),
    ]);
    for (const b of candidates) {
      const o = shadowOffset(b.height, position),
        q = [p[0] - o.east, p[1] - o.north];
      // Grid cells contain many unrelated buildings. Reject those outside the
      // ray's bounding box before inspecting every wall of every footprint.
      if (
        b.bounds[2] < Math.min(p[0], q[0]) ||
        b.bounds[0] > Math.max(p[0], q[0]) ||
        b.bounds[3] < Math.min(p[1], q[1]) ||
        b.bounds[1] > Math.max(p[1], q[1])
      )
        continue;
      if (b.polygons.some((poly) => rayHitsPolygon(p, q, poly))) return "shade";
    }
    return "sun";
  }
  function defaultPoint(place) {
    const origin = project([place.lng, place.lat]);
    if (!indoor(origin)) return [place.lng, place.lat];
    // A visible, editable proxy outside the building, never a verified terrace.
    const options = [];
    for (const b of nearby([
      origin[0] - 60,
      origin[1] - 60,
      origin[0] + 60,
      origin[1] + 60,
    ]))
      for (const poly of b.polygons)
        for (const ring of poly)
          for (let i = 1; i < ring.length; i++) {
            const a = ring[i - 1],
              v = [ring[i][0] - a[0], ring[i][1] - a[1]],
              len = Math.hypot(...v);
            if (!len) continue;
            const t = Math.max(
              0,
              Math.min(
                1,
                ((origin[0] - a[0]) * v[0] + (origin[1] - a[1]) * v[1]) /
                  (len * len),
              ),
            );
            for (const side of [-1, 1]) {
              const p = [
                a[0] + t * v[0] - ((side * v[1]) / len) * 3,
                a[1] + t * v[1] + ((side * v[0]) / len) * 3,
              ];
              const distance = Math.hypot(p[0] - origin[0], p[1] - origin[1]);
              if (distance < 60) options.push({ p, distance });
            }
          }
    options.sort((a, b) => a.distance - b.distance);
    const candidate = options.find((o) => !indoor(o.p));
    return candidate ? unproject(candidate.p) : null;
  }
  function parkSamples(polygons, water = []) {
    if (!polygons?.length) return [];
    const cached = sampleCache.get(polygons);
    if (cached?.water === water) return cached.samples;
    if (!waterCache.has(water)) {
      waterCache.set(
        water,
        water.map((polygon) => {
          const xs = polygon[0].map((p) => p[0]),
            ys = polygon[0].map((p) => p[1]);
          return {
            polygon,
            bounds: [
              Math.min(...xs),
              Math.min(...ys),
              Math.max(...xs),
              Math.max(...ys),
            ],
          };
        }),
      );
    }
    const projected = polygons.map((p) => p.map((r) => r.map(project))),
      flat = projected.flatMap((p) => p[0]);
    const xs = flat.map((p) => p[0]),
      ys = flat.map((p) => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys),
      samples = [];
    for (let x = 0; x < 10; x++)
      for (let y = 0; y < 10; y++) {
        const p = [
            minX + ((x + 0.5) * (maxX - minX)) / 10,
            minY + ((y + 0.5) * (maxY - minY)) / 10,
          ],
          ll = unproject(p);
        if (
          projected.some((polygon) => inPolygon(p, polygon)) &&
          !indoor(p) &&
          !waterCache
            .get(water)
            .some(
              ({ polygon, bounds: [w, s, e, n] }) =>
                ll[0] >= w &&
                ll[0] <= e &&
                ll[1] >= s &&
                ll[1] <= n &&
                inPolygon(ll, polygon),
            )
        )
          samples.push(ll);
      }
    sampleCache.set(polygons, { water, samples });
    return samples;
  }
  return {
    state,
    frame,
    defaultPoint,
    parkSamples,
    indoor: (ll) => indoor(project(ll)),
  };
}
export function sampleState(model, points, frame) {
  // Night is known even for a very narrow park with no land grid samples.
  if (frame.position?.altitude <= 0) return { state: "shade", fraction: 0 };
  if (!points.length) return { state: "unknown", fraction: null };
  const states = points.map((p) => model.state(p, frame));
  const known = states.filter((s) => s !== "unknown").length;
  if (known !== points.length) return { state: "unknown", fraction: null };
  const sun = states.filter((s) => s === "sun").length;
  return { state: sun ? "sun" : "shade", fraction: sun / points.length };
}
export function analyzePlaces(
  model,
  places,
  areas,
  instant,
  overrides = {},
  duration = 90,
) {
  const start = Number(new Date(instant)),
    frames = new Map();
  const getFrame = (m) => {
    if (!frames.has(m)) frames.set(m, model.frame(start + m * 60000));
    return frames.get(m);
  };
  const results = {};
  for (const place of places) {
    const custom = overrides[place.id];
    const point = custom || model.defaultPoint(place);
    const park = place.category === "park";
    const points = park
      ? model.parkSamples(areas.parks[place.id], areas.water)
      : point && !model.indoor(point)
        ? [point]
        : [];
    const current = sampleState(model, points, getFrame(0));
    let until = 0,
      reason = current.state,
      timeline = [];
    const horizon = 180;
    for (let m = 0; m <= horizon; m += park ? 5 : 1) {
      const status =
        m === 0 ? current : sampleState(model, points, getFrame(m));
      timeline.push({ minute: m, ...status });
    }
    if (current.state === "sun") {
      const end = timeline.find((t) => t.state !== "sun");
      until = end ? end.minute : horizon;
      reason = end?.state || "horizon";
      if (reason === "unknown") until = Math.max(0, until - (park ? 5 : 1));
      if (end && !park && end.state !== "unknown")
        for (let m = Math.max(1, end.minute - 4); m <= end.minute; m++) {
          const status = sampleState(model, points, getFrame(m));
          if (status.state !== "sun") {
            until = m;
            reason = status.state;
            break;
          }
        }
    }
    results[place.id] = {
      ...current,
      point,
      pointSource: custom ? "chosen" : "estimated",
      sampleCount: points.length,
      until,
      reason,
      timeline,
      opening: placeOpening(place, new Date(start), duration),
      outdoor: place.outdoor,
      eligible: place.outdoor !== "no",
      park,
    };
  }
  return results;
}
export function distanceMeters(a, b) {
  const p = project(a),
    q = project(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
}
export function recommendNext(places, results, originId, instant, duration) {
  const origin = results[originId];
  if (!origin?.point) return [];
  const originPlace = places.find((p) => p.id === originId);
  return places
    .filter((p) => p.id !== originId && p.category === originPlace.category)
    .flatMap((p) => {
      const r = results[p.id];
      if (!r?.point || !r.eligible) return [];
      const distance = distanceMeters(origin.point, r.point);
      if (distance > 1500) return [];
      // Straight-line distance with 1.3 detour factor at 75m/min: estimate, no routing.
      const walk = Math.max(1, Math.ceil((distance * 1.3) / 75)),
        arrival = p.category === "park" ? Math.ceil(walk / 5) * 5 : walk,
        end = arrival + duration;
      if (end > 180) return [];
      const coverage = r.timeline.filter(
        (t) => t.minute >= arrival && t.minute <= end,
      );
      if (!coverage.length || coverage.some((t) => t.state !== "sun"))
        return [];
      const opening = placeOpening(
        p,
        new Date(Number(new Date(instant)) + arrival * 60000),
        duration,
      );
      if (
        opening.state === "closed" ||
        (opening.state === "open" && opening.remaining < duration)
      )
        return [];
      return [
        {
          place: p,
          distance: Math.round(distance),
          walk,
          opening,
          pointSource: r.pointSource,
        },
      ];
    })
    .sort(
      (a, b) =>
        (a.opening.state === "open" ? 0 : 1) -
          (b.opening.state === "open" ? 0 : 1) || a.walk - b.walk,
    )
    .slice(0, 3);
}
