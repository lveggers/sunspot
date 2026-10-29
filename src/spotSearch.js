import { distanceMeters } from "./exposure.js";
import { normalizeSearch } from "./lib.js";

export function isCopenhagenPoint(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    point.every(Number.isFinite) &&
    point[0] >= 12.53 &&
    point[0] <= 12.632 &&
    point[1] >= 55.662 &&
    point[1] <= 55.711
  );
}

export function filterSpots(
  places,
  results,
  {
    categories = ["park", "bar", "restaurant"],
    query = "",
    district = "",
    onlySun = true,
    onlyOpen = true,
    origin = null,
  } = {},
) {
  if (origin && !isCopenhagenPoint(origin)) return [];
  const search = normalizeSearch(query);
  const distance = (place) => distanceMeters(origin, [place.lng, place.lat]);
  return places
    .filter((place) => {
      const result = results[place.id];
      return (
        categories.includes(place.category) &&
        (!district || district === "all" || place.district === district) &&
        normalizeSearch(`${place.name} ${place.district}`).includes(search) &&
        (!onlySun || (result?.eligible && result.state === "sun")) &&
        (!onlyOpen || result?.opening?.state === "open") &&
        (!origin || distance(place) <= 1500)
      );
    })
    .sort(
      (a, b) =>
        (origin ? distance(a) - distance(b) : 0) ||
        (results[b.id]?.until || 0) - (results[a.id]?.until || 0) ||
        a.name.localeCompare(b.name, "da"),
    );
}

export function getDirectionsUrl(place) {
  const parameters = new URLSearchParams({
    api: "1",
    destination: `${place.lat},${place.lng}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${parameters}`;
}
