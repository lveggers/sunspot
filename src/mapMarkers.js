// Only render markers in the visible map. Stable world-grid cells keep groups
// from jumping between buckets when the user pans.
import { translate } from "./i18n.js";

export function sunFocusPoints(places, results, { pending, weatherState, daylight }) {
  if (pending || weatherState !== "sun" || !daylight) return [];
  return places.flatMap((place) => {
    const result = results[place.id];
    if (result?.state !== "sun" || result.eligible !== true || result.opening?.state !== "open") return [];
    const [lng, lat] = result.point || [place.lng, place.lat];
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
    return [{ id: place.id, lat, lng }];
  });
}

export function groupMapMarkers(
  items,
  { project, bounds, zoom, selectedId, cellSize = 76, language = "da" },
) {
  const groups = new Map(),
    singles = [];
  for (const item of items) {
    if (
      item.lat < bounds.south ||
      item.lat > bounds.north ||
      item.lng < bounds.west ||
      item.lng > bounds.east
    )
      continue;
    if (zoom >= 17 || item.id === selectedId) {
      singles.push({ ...item, markerId: item.id });
      continue;
    }
    const p = project(item);
    const key = `cluster:${zoom}:${Math.floor(p.x / cellSize)}:${Math.floor(p.y / cellSize)}:${item.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const [key, members] of groups) {
    if (members.length === 1) {
      singles.push({ ...members[0], markerId: members[0].id });
      continue;
    }
    singles.push({
      markerId: key,
      id: key,
      category: members[0].category,
      members,
      name: translate(language, members[0].category === "park" ? "map.groupParks" : "map.groupPlaces", { count: members.length }),
      lat: members.reduce((n, p) => n + p.lat, 0) / members.length,
      lng: members.reduce((n, p) => n + p.lng, 0) / members.length,
      emoji: members[0].category === "park" ? "🌿" : members[0].emoji,
    });
  }
  return singles;
}
