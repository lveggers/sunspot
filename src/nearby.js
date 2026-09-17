import { distanceMeters } from "./exposure.js";
import { placeOpening } from "./venueEvidence.js";

export const nearbyAreas = [
  { name: "Nørrebro", point: [12.5558, 55.6919] },
  { name: "Indre By", point: [12.5799, 55.6851] },
];
export function validNearbyLocation(point, accuracy = 0) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    point.every(Number.isFinite) &&
    point[0] >= 12.53 &&
    point[0] <= 12.632 &&
    point[1] >= 55.662 &&
    point[1] <= 55.711 &&
    Number.isFinite(accuracy) &&
    accuracy >= 0 &&
    accuracy <= 500
  );
}

// Distances are straight-line estimates, not route-provider travel times.
// Require every sample covering arrival and stay, including the sample before arrival.
export function nearbyRecommendations(
  places,
  results,
  origin,
  instant,
  duration = 30,
  onlyOpen = false,
) {
  if (
    !validNearbyLocation(origin) ||
    !Number.isFinite(Date.parse(instant)) ||
    !Number.isFinite(duration) ||
    duration <= 0
  )
    return [];
  return places
    .flatMap((place) => {
      const result = results[place.id];
      if (!result?.point || !result.eligible || !result.timeline?.length)
        return [];
      const distance = distanceMeters(origin, result.point);
      if (distance > 1500) return [];
      const walk = Math.max(1, Math.ceil((distance * 1.3) / 75));
      const step = place.category === "park" ? 5 : 1;
      const first = Math.floor(walk / step) * step;
      const end = Math.ceil((walk + duration) / step) * step;
      const samples = new Map(
        result.timeline.map((sample) => [sample.minute, sample]),
      );
      for (let minute = first; minute <= end; minute += step) {
        if (samples.get(minute)?.state !== "sun") return [];
      }
      const opening = placeOpening(
        place,
        new Date(Date.parse(instant) + walk * 60000),
        duration,
      );
      if (
        opening.state === "closed" ||
        (onlyOpen && opening.state !== "open") ||
        (opening.state === "open" && opening.remaining < duration)
      )
        return [];
      let lastSun = end;
      while (samples.get(lastSun + step)?.state === "sun") lastSun += step;
      const next = samples.get(lastSun + step);
      const sunMinutes = Math.max(duration, lastSun - walk);
      return [
        {
          place,
          walk,
          opening,
          sunMinutes,
          horizon: !next,
          pointSource: result.pointSource,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.opening.state === "open") -
          Number(a.opening.state === "open") ||
        a.walk - b.walk ||
        b.sunMinutes - a.sunMinutes,
    )
    .slice(0, 3);
}
